import {StatusButtons} from './statusButtons.js';
import Gio from 'gi://Gio';
import St from 'gi://St';
import GLib from 'gi://GLib';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Style the native controls: retain hardware state, accessibility and submenus.
// No polling, duplicated settings service, or unsupported Apple-only controls.
export class ControlCenter {
    constructor(path) {
        this.panel = Main.panel.statusArea.quickSettings;
        if (!this.panel?._indicators || !this.panel.menu?.box) return;
        this.panel.add_style_class_name('familiarmac-status');
        this.panel.menu.box.add_style_class_name('familiarmac-control-center');
        this.icon = new St.Icon({
            gicon: new Gio.FileIcon({file: Gio.File.new_for_path(`${path}/controlCenter.svg`)}),
            icon_size: 18, style_class: 'system-status-icon familiarmac-control-icon',
        });
        this.panel._indicators.add_child(this.icon);
        this.originalOrder = null;
        this.labels = [];
        this.openSignal = this.panel.menu.connect('open-state-changed', (_menu, open) => {
            if (open) this.arrange();
        });
        this.statusButtons = new StatusButtons(this);
    }

    arrange() {
        const menu = this.panel.menu;
        const grid = menu._grid;
        if (this.originalOrder || !grid || !this.panel._system) return;
        this.originalOrder = grid.get_children();
        const tr = GLib.get_language_names()[0].startsWith('tr');
        this.notifications = new Gio.Settings({schema_id: 'org.gnome.desktop.notifications'});
        this.focus = new QuickSettings.QuickToggle({title: tr ? 'Rahatsız Etmeyin' : 'Do Not Disturb',
            iconName: 'notifications-disabled-symbolic', toggleMode: true});
        const sync = () => { this.focus.checked = !this.notifications.get_boolean('show-banners'); };
        this.notifySignal = this.notifications.connect('changed::show-banners', sync);
        this.focus.connect('clicked', () => this.notifications.set_boolean('show-banners', !this.focus.checked));
        sync();
        menu.addItem(this.focus, 1);
        const items = name => this.panel[name]?.quickSettingsItems ?? [];
        const ordered = [...items('_network'), this.focus, ...items('_bluetooth'), ...items('_darkMode'),
            ...items('_nightLight'), ...items('_backlight')];
        for (const [name, title] of [['_brightness', tr ? 'Ekran' : 'Display'], ['_volumeOutput', tr ? 'Ses' : 'Sound']]) {
            for (const item of items(name)) {
                const label = new St.Label({text: title, style_class: 'familiarmac-control-heading'});
                menu.addItem(label, 2);
                label.visible = item.visible;
                const signal = item.connect('notify::visible', () => { label.visible = item.visible; });
                this.labels.push({label, item, signal});
                ordered.push(label, item);
            }
        }
        // Keep the native submenu overlay and each item's grid metadata intact.
        // Unrecognized/privacy/extension controls remain available below the cards.
        ordered.push(...this.originalOrder.filter(item => !ordered.includes(item) && !items('_system').includes(item)),
            ...items('_system'));
        ordered.forEach((item, index) => {
            if (item.get_parent() === grid) grid.set_child_at_index(item, index);
        });
    }

    destroy() {
        this.statusButtons?.destroy();
        this.statusButtons = null;
        if (this.openSignal) this.panel.menu.disconnect(this.openSignal);
        this.openSignal = 0;
        if (this.notifySignal) this.notifications.disconnect(this.notifySignal);
        this.notifySignal = 0;
        for (const {label, item, signal} of this.labels ?? []) {
            item.disconnect(signal);
            label.destroy();
        }
        this.labels = [];
        this.focus?.destroy();
        this.focus = null;
        const grid = this.panel?.menu?._grid;
        this.originalOrder?.forEach((item, index) => {
            if (item.get_parent() === grid) grid.set_child_at_index(item, index);
        });
        this.originalOrder = null;
        this.icon?.destroy();
        this.icon = null;
        this.panel?.remove_style_class_name('familiarmac-status');
        this.panel?.menu?.box?.remove_style_class_name('familiarmac-control-center');
        this.panel = null;
    }
}
