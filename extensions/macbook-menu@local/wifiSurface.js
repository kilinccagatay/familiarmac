import {settingsCommand} from './settingsCommand.js';
import St from 'gi://St';
import Atk from 'gi://Atk';
import GLib from 'gi://GLib';
import {WifiGroups} from './wifiGroups.js';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';

// Borrow the live native list only while this detail is open. NetworkManager
// retains discovery, ordering, authentication, accessibility and activation.
export class WifiSurface {
    constructor(owner, tr) {
        this.owner = owner;
        this.tr = tr;
        this.wireless = owner.panel._network?._wirelessToggle;
        this.actor = new St.BoxLayout({vertical: true, style_class: 'fm-wifi', visible: false});
        this.toggleRow = new St.BoxLayout({style_class:'fm-wifi-toggle-row', reactive:false});
        const title = new St.Label({text:'Wi-Fi', x_expand:true, y_align:Clutter.ActorAlign.CENTER});
        this.toggle = new PopupMenu.Switch(false);
        this.toggleButton = new St.Button({style_class:'fm-wifi-switch-button',
            child:this.toggle, can_focus:true, reactive:true, toggle_mode:true,
            accessible_name:'Wi-Fi', accessible_role:Atk.Role.CHECK_BOX});
        this.toggleRow.add_child(title);
        this.toggleRow.add_child(this.toggleButton);
        this.actor.add_child(this.toggleRow);
        this.ethernet = new St.Label({style_class:'fm-network-heading', visible:false});
        this.actor.add_child(this.ethernet);
        this.toggleButton.connect('clicked', () => {
            const client = this.wireless?._client;
            if (client?.wireless_hardware_enabled && this.wireless?.reactive) {
                this.toggle.state = this.toggleButton.checked;
                client.wireless_enabled = this.toggleButton.checked;
            } else this.sync();
        });
        this.list = new St.BoxLayout({vertical: true, style_class: 'fm-wifi-networks'});
        this.scroll = new St.ScrollView({overlay_scrollbars: true,
            hscrollbar_policy: St.PolicyType.NEVER, vscrollbar_policy: St.PolicyType.AUTOMATIC,
            style_class: 'fm-wifi-scroll', child: this.list});
        this.actor.add_child(this.scroll);
        this.actor.add_child(new St.BoxLayout({style_class: 'fm-battery-separator'}));
        const networkSettings = new PopupMenu.PopupMenuItem(tr ? 'Ağ Ayarları…' : 'Network Settings…');
        networkSettings.connect('activate', () => {
            owner.panel.menu.close(); Util.spawn([settingsCommand(), 'network']);
        });
        this.actor.add_child(networkSettings);
        const settings = new PopupMenu.PopupMenuItem(tr ? 'Wi-Fi Ayarları…' : 'Wi-Fi Settings…');
        settings.connect('activate', () => {
            owner.panel.menu.close(); Util.spawn([settingsCommand(), 'wifi']);
        });
        this.actor.add_child(settings);
        if (this.wireless) {
            this.signals = ['notify::checked', 'notify::reactive'].map(name =>
                this.wireless.connect(name, () => this.sync()));
        }
        this.sync();
    }
    sync() {
        const primary = this.wireless?._client?.get_primary_connection?.();
        const wired = primary?.get_connection_type?.() === '802-3-ethernet';
        this.ethernet.visible = wired;
        if (wired) {
            const iface = primary.get_devices?.()[0]?.get_iface?.();
            this.ethernet.text = `Ethernet: ${primary.get_id()}${iface ? ` (${iface})` : ''}`;
        }
        this.toggle.state = Boolean(this.wireless?.checked);
        this.toggleButton.checked = this.toggle.state;
        const enabled = Boolean(this.wireless?.reactive && this.wireless?._client?.wireless_hardware_enabled);
        this.toggleButton.reactive = enabled;
        this.toggleButton.can_focus = enabled;
    }
    _alignTree(actor) {
        if (this._rowObservers.has(actor)) return;
        const added = actor.connect('child-added', (_parent, child) => this._alignTree(child));
        const destroyed = actor.connect('destroy', () => {
            this._rowObservers.delete(actor);
            this._rowGeometry.delete(actor);
        });
        this._rowObservers.set(actor, [added, destroyed]);
        if (actor.has_style_class_name?.('nm-network-item')) {
            const children = actor.get_children();
            const label = children.find(child => child instanceof St.Label);
            const tick = children.find(child => child.icon_name === 'object-select-symbolic');
            const icons = children.find(child => child !== label && child !== tick && child instanceof St.BoxLayout);
            const set = (child, properties) => {
                if (!child) return;
                this._rowGeometry.set(child, Object.fromEntries(Object.keys(properties).map(key => [key, child[key]])));
                Object.assign(child, properties);
            };
            set(label, {y_align: Clutter.ActorAlign.CENTER, x_expand: true});
            set(tick, {y_align: Clutter.ActorAlign.CENTER, x_align: Clutter.ActorAlign.END});
            set(icons, {y_align: Clutter.ActorAlign.CENTER});
        }
        for (const child of actor.get_children()) this._alignTree(child);
    }
    _restoreAlignment() {
        for (const [actor, signals] of this._rowObservers ?? [])
            for (const signal of signals) actor.disconnect(signal);
        for (const [actor, properties] of this._rowGeometry ?? []) Object.assign(actor, properties);
        this._rowObservers?.clear();
        this._rowGeometry?.clear();
    }
    show() {
        if (this.borrowed || this.groups || !this.wireless?._itemsSection?.actor) return;
        if (this.wireless._items) {
            this.groups = new WifiGroups(this.list, this.wireless, () => this.owner.panel.menu.close(), this.tr, () => {
                this.owner.panel.menu.close(); Util.spawn([settingsCommand(), 'wifi']);
            });
            this.wireless._startScanning();
            this.groups.sync(); this.sync();
            this.refresh = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
                this.groups.sync(); this.sync(); return GLib.SOURCE_CONTINUE;
            });
            return;
        }
        const section = this.wireless._itemsSection;
        const actor = section.actor, parent = actor.get_parent();
        this.borrowed = {actor, parent, index: parent.get_children().indexOf(actor), section};
        parent.remove_child(actor); this.list.add_child(actor);
        this._rowObservers = new Map();
        this._rowGeometry = new Map();
        this._alignTree(actor);
        this.activation = section.connect('activate', () => this.owner.panel.menu.close());
        this.wireless._startScanning();
        this.sync();
    }
    hide() {
        if (this.groups) {
            GLib.source_remove(this.refresh);this.refresh=0;
            this.wireless._stopScanning();this.groups.destroy();this.groups=null;
        }
        if (!this.borrowed) return;
        this.wireless._stopScanning();
        this._restoreAlignment();
        const {actor, parent, index, section} = this.borrowed;
        section.disconnect(this.activation);
        actor.get_parent().remove_child(actor); parent.insert_child_at_index(actor, index);
        this.borrowed = null;
    }
    destroy() {
        this.hide();
        for (const id of this.signals ?? []) this.wireless.disconnect(id);
        this.actor.destroy();
    }
}
