import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export function networkGroups(wireless) {
    const known = [], other = [];
    for (const device of wireless?._items?.values() ?? []) {
        for (const network of device._networkItems?.keys() ?? []) {
            if (!network.hasAccessPoints()) continue;
            (network.hasConnections() ? known : other).push(network);
        }
    }
    const sort = (a, b) => Number(b.is_active) - Number(a.is_active) || a.compare(b);
    return {known:known.sort(sort), other:other.sort(sort)};
}

// Render the native WirelessNetwork models; authentication/activation remain
// GNOME's own implementation. Never alter routes, saved profiles or priorities.
export class WifiGroups {
    constructor(parent, wireless, close, tr, openOther = null) {
        this.wireless = wireless;
        this.close = close;
        this.rows = new Map();
        this.actor = new St.BoxLayout({vertical:true});
        this.knownTitle = new St.Label({text:tr ? 'Bilinen Ağlar' : 'Known Networks', style_class:'fm-network-heading'});
        this.known = new St.BoxLayout({vertical:true});
        this.otherButton = new PopupMenu.PopupMenuItem(tr ? 'Diğer Ağlar' : 'Other Networks');
        this.arrow = new St.Icon({icon_name:'pan-end-symbolic', x_expand:true, x_align:Clutter.ActorAlign.END, style_class:'popup-menu-icon'});
        this.otherButton.add_child(this.arrow);
        this.other = new St.BoxLayout({vertical:true, visible:false});
        if (openOther) {
            const otherSettings = new PopupMenu.PopupMenuItem(tr ? 'Diğer…' : 'Other…');
            otherSettings.connect('activate', openOther);
            this.other.add_child(otherSettings);
        }
        this.otherButton.connect('activate', () => {
            this.other.visible = !this.other.visible;
            this.arrow.icon_name = this.other.visible ? 'pan-down-symbolic' : 'pan-end-symbolic';
        });
        for (const actor of [this.knownTitle,this.known,this.otherButton,this.other]) this.actor.add_child(actor);
        parent.add_child(this.actor);
    }
    sync() {
        const groups = networkGroups(this.wireless);
        const current = new Set([...groups.known,...groups.other]);
        for (const [network, row] of this.rows) {
            if (!current.has(network)) {row.item.destroy();this.rows.delete(network);}
        }
        for (const [key, networks] of Object.entries(groups)) {
            const box = this[key];
            networks.forEach((network, index) => {
                let row = this.rows.get(network);
                if (!row) {
                    const item = new PopupMenu.PopupMenuItem(network.name);
                    const signal = new St.Icon({style_class:'fm-wifi-signal', icon_size:16});
                    const badge = new St.Bin({style_class:'fm-wifi-badge', child:signal,
                        x_align:Clutter.ActorAlign.CENTER, y_align:Clutter.ActorAlign.CENTER});
                    item.insert_child_at_index(badge, 0);
                    item.label.x_expand = true;
                    const lock = new St.Icon({icon_name:'changes-prevent-symbolic',style_class:'popup-menu-icon'});
                    item.add_child(lock);
                    item.connect('activate', () => {network.activate();this.close();});
                    row = {item, signal, lock, badge};this.rows.set(network,row);
                }
                row.item.label.text = network.name;
                row.signal.icon_name = network.icon_name;
                row.lock.visible = Boolean(network.secure);
                row.badge.set_style_class_name(network.is_active ? 'fm-wifi-badge connected' : 'fm-wifi-badge');
                row.item.accessible_name = `${network.name}${network.is_active ? ', connected' : ''}${network.secure ? ', secured' : ''}`;
                if (row.item.get_parent() !== box) {
                    row.item.get_parent()?.remove_child(row.item);box.add_child(row.item);
                }
                box.set_child_at_index(row.item,index);
            });
        }
        this.knownTitle.visible = groups.known.length > 0;
        this.otherButton.visible = groups.other.length > 0 || this.other.get_children().length > 0;
        this.other.visible = this.other.visible && this.otherButton.visible;
    }
    destroy() {this.rows.clear();this.actor.destroy();}
}
