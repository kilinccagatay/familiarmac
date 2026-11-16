import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';

// Borrow the live native list only while this detail is open. NetworkManager
// retains discovery, ordering, authentication, accessibility and activation.
export class WifiSurface {
    constructor(owner, tr) {
        this.owner = owner;
        this.wireless = owner.panel._network?._wirelessToggle;
        this.actor = new St.BoxLayout({vertical: true, style_class: 'fm-wifi', visible: false});
        this.toggle = new PopupMenu.PopupSwitchMenuItem('Wi-Fi', false);
        this.toggle.add_style_class_name('fm-wifi-toggle');
        this.actor.add_child(this.toggle);
        this.toggle.connect('toggled', (_item, state) => {
            const client = this.wireless?._client;
            if (client?.wireless_hardware_enabled) client.wireless_enabled = state;
        });
        this.list = new St.BoxLayout({vertical: true, style_class: 'fm-wifi-networks'});
        this.scroll = new St.ScrollView({overlay_scrollbars: true,
            hscrollbar_policy: St.PolicyType.NEVER, vscrollbar_policy: St.PolicyType.AUTOMATIC,
            style_class: 'fm-wifi-scroll', child: this.list});
        this.actor.add_child(this.scroll);
        this.actor.add_child(new St.BoxLayout({style_class: 'fm-battery-separator'}));
        const settings = new PopupMenu.PopupMenuItem(tr ? 'Wi-Fi Ayarları…' : 'Wi-Fi Settings…');
        settings.connect('activate', () => {
            owner.panel.menu.close(); Util.spawn(['gnome-control-center', 'wifi']);
        });
        this.actor.add_child(settings);
        if (this.wireless) {
            this.signals = ['notify::checked', 'notify::reactive'].map(name =>
                this.wireless.connect(name, () => this.sync()));
        }
        this.sync();
    }
    sync() {
        this.toggle.setToggleState(Boolean(this.wireless?.checked));
        this.toggle.setSensitive(Boolean(this.wireless?.reactive));
    }
    show() {
        if (this.borrowed || !this.wireless?._itemsSection?.actor) return;
        const section = this.wireless._itemsSection;
        const actor = section.actor, parent = actor.get_parent();
        this.borrowed = {actor, parent, index: parent.get_children().indexOf(actor), section};
        parent.remove_child(actor); this.list.add_child(actor);
        this.activation = section.connect('activate', () => this.owner.panel.menu.close());
        this.wireless._startScanning();
        this.sync();
    }
    hide() {
        if (!this.borrowed) return;
        this.wireless._stopScanning();
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
