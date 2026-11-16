import {PanelOrder} from './panelOrder.js';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

// Separate hit targets; native hardware controls stay in their original grid.
export class StatusButtons {
    constructor(owner) {
        this.owner = owner;
        this.panel = owner.panel;
        this.buttons = [];
        this.mask = [];
        this.closedSignal = this.panel.menu.connect('open-state-changed', (_m, open) => {
            if (!open) this.restore();
        });
        let attempts = 0;
        const ready = () => {
            if (this.panel._system) { this.install(); return false; }
            return ++attempts < 30;
        };
        if (ready()) this.timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            if (ready()) return GLib.SOURCE_CONTINUE;
            this.timer = 0; return GLib.SOURCE_REMOVE;
        });
    }

    install() {
        const box = this.panel._indicators;
        for (const [key, title] of [['_network', 'Network'], ['_bluetooth', 'Bluetooth'],
            ['_volumeOutput', 'Sound'], ['_system', 'Battery']]) {
            const indicator = this.panel[key];
            if (!indicator || indicator.get_parent() !== box) continue;
            const index = box.get_children().indexOf(indicator);
            const button = new PanelMenu.Button(0.5, title, true);
            button.add_style_class_name('familiarmac-status-single');
            box.remove_child(indicator);
            button.add_child(indicator);
            const sync = () => { button.visible = indicator.visible; };
            const signal = indicator.connect('notify::visible', sync);
            sync();
            // PanelMenu dispatches both mouse press and touch to menu.toggle.
            button.menu.toggle = () => this.open(key, button);
            button.connect('key-press-event', (_a, event) => {
                if (![Clutter.KEY_Return, Clutter.KEY_space, Clutter.KEY_Down].includes(event.get_key_symbol()))
                    return Clutter.EVENT_PROPAGATE;
                this.open(key, button); return Clutter.EVENT_STOP;
            });
            const position = Main.panel._rightBox.get_children().indexOf(this.panel.container);
            Main.panel.addToStatusArea(`familiarmac-status-${key}`, button, Math.max(0, position), 'right');
            this.buttons.push({indicator, index, button, signal});
        }
        this.panelOrder = new PanelOrder();
    }

    open(key, button) {
        const menu = this.panel.menu;
        const same = this.active === button && menu.isOpen;
        menu.close();
        this.restore();
        if (same) return;
        this.owner.arrange();
        const selected = new Set(this.panel[key]?.quickSettingsItems ?? []);
        for (const {label, item} of this.owner.labels) if (selected.has(item)) selected.add(label);
        for (const item of menu._grid.get_children()) {
            if (selected.has(item) || item === menu._grid.layout_manager._overlay) continue;
            const saved = {item, visible: item.visible, guard: false};
            saved.signal = item.connect('notify::visible', () => {
                if (saved.guard) return;
                saved.visible = item.visible;
                saved.guard = true; item.hide(); saved.guard = false;
            });
            saved.guard = true; item.hide(); saved.guard = false;
            this.mask.push(saved);
        }
        this.active = button;
        button.add_style_pseudo_class('active');
        menu.box.add_style_class_name('familiarmac-status-detail');
        menu.open();
        // Native QuickSettings marks its source active even for our detail view.
        // Only the independently clicked status button should be highlighted.
        this.panel.remove_style_pseudo_class('active');
    }

    restore() {
        for (const {item, signal, visible} of this.mask) {
            item.disconnect(signal); item.visible = visible;
        }
        this.mask = [];
        this.active?.remove_style_pseudo_class('active');
        this.active = null;
        this.panel.menu.box.remove_style_class_name('familiarmac-status-detail');
    }

    destroy() {
        this.panelOrder?.destroy();
        this.panelOrder = null;
        if (this.timer) GLib.source_remove(this.timer);
        this.timer = 0;
        this.panel.menu.close();
        this.panel.menu.disconnect(this.closedSignal);
        this.restore();
        const box = this.panel._indicators;
        for (const {indicator, index, button, signal} of this.buttons.reverse()) {
            indicator.disconnect(signal);
            button.remove_child(indicator);
            box.insert_child_at_index(indicator, Math.min(index, box.get_n_children()));
            button.destroy();
        }
        this.buttons = [];
    }
}
