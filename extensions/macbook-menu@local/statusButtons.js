import {PanelOrder} from './panelOrder.js';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

// Separate hit targets; native hardware controls stay in their original grid.
export class StatusButtons {
    constructor(owner) {
        this.owner = owner;
        this.panel = owner.panel;
        this.buttons = [];
        this.mask = [];
        this.spans = [];
        const menu = this.panel.menu;
        this.originalClose = menu.close;
        this.closeWrapper = animate => {
            // Hide before restoring the shared grid, including submenu collapse.
            // No full Control Center frame may paint while a detail closes.
            if (this.active) menu.actor.hide();
            this.originalClose.call(menu, this.active ? BoxPointer.PopupAnimation.NONE : animate);
        };
        menu.close = this.closeWrapper;
        this.closedSignal = menu.connect('open-state-changed', (_m, open) => {
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
            const content = new St.BoxLayout();
            button.add_child(content);
            content.add_child(indicator);
            let wirelessIcon = null;
            const wireless = key === '_network' ? indicator._wirelessToggle : null;
            const bindings = [];
            if (wireless) {
                // Wi-Fi status remains Wi-Fi when Ethernet owns the default route.
                indicator.hide();
                wirelessIcon = new St.Icon({style_class: 'system-status-icon'});
                content.add_child(wirelessIcon);
                const updateWifi = () => {
                    wirelessIcon.icon_name = wireless.icon_name;
                    wirelessIcon.visible = wireless.visible;
                    indicator.visible = !wireless.visible;
                    button.visible = Boolean(wireless.visible || indicator.visible);
                };
                bindings.push(wireless.connect('notify::icon-name', updateWifi),
                    wireless.connect('notify::visible', updateWifi));
                updateWifi();
            }
            const sync = () => {
                button.visible = Boolean(wireless?.visible || indicator.visible);
                if (wireless?.visible && indicator.visible) indicator.hide();
            };
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
            this.buttons.push({indicator, index, button, signal, wireless, bindings, wirelessIcon});
        }
        this.panelOrder = new PanelOrder();
    }

    open(key, button) {
        const menu = this.panel.menu;
        const same = this.active === button && menu.isOpen;
        menu.close();
        this.restore();
        if (same) return;
        this.owner.detail = key;
        this.owner.arrange();
        this.owner.syncSurface?.();
        const wireless = key === '_network' ? this.panel._network?._wirelessToggle : null;
        const selected = new Set(key === '_system' ? [] : wireless?.visible ? [wireless] : this.panel[key]?.quickSettingsItems ?? []);
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
        // All status details share the native controls, but their popup anchor
        // and focus return target must be the button actually used to open it.
        this.anchor = {source: menu.sourceActor, focus: menu.focusActor,
            alignment: menu._arrowAlignment};
        menu.sourceActor = button;
        menu.focusActor = button;
        menu._arrowAlignment = 0.5;
        for (const item of selected) {
            if (item.get_parent() !== menu._grid) continue;
            const meta = menu._grid.layout_manager.get_child_meta(menu._grid, item);
            this.spans.push({meta, span: meta.column_span});
            meta.column_span = 2;
        }
        this.active = button;
        button.add_style_pseudo_class('active');
        menu.box.add_style_class_name('familiarmac-status-detail');
        menu.open();
        if (wireless?.visible && wireless.menu) wireless.menu.open(BoxPointer.PopupAnimation.NONE);
        // Native QuickSettings marks its source active even for our detail view.
        // Only the independently clicked status button should be highlighted.
        this.panel.remove_style_pseudo_class('active');
    }

    restore() {
        for (const {item, signal, visible} of this.mask) {
            item.disconnect(signal); item.visible = visible;
        }
        this.mask = [];
        for (const {meta, span} of this.spans) meta.column_span = span;
        this.spans = [];
        if (this.anchor) {
            const menu = this.panel.menu;
            menu.sourceActor = this.anchor.source;
            menu.focusActor = this.anchor.focus;
            menu._arrowAlignment = this.anchor.alignment;
            this.anchor = null;
        }
        this.active?.remove_style_pseudo_class('active');
        this.active = null;
        this.owner.detail = false;
        this.owner.syncSurface?.();
        this.panel.menu.box.remove_style_class_name('familiarmac-status-detail');
    }

    destroy() {
        this.panelOrder?.destroy();
        this.panelOrder = null;
        if (this.timer) GLib.source_remove(this.timer);
        this.timer = 0;
        this.panel.menu.close();
        this.panel.menu.disconnect(this.closedSignal);
        if (this.panel.menu.close === this.closeWrapper) this.panel.menu.close = this.originalClose;
        this.restore();
        const box = this.panel._indicators;
        for (const {indicator, index, button, signal, wireless, bindings} of this.buttons.reverse()) {
            for (const id of bindings) wireless.disconnect(id);
            if (wireless) indicator.show();
            indicator.disconnect(signal);
            indicator.get_parent().remove_child(indicator);
            box.insert_child_at_index(indicator, Math.min(index, box.get_n_children()));
            button.destroy();
        }
        this.buttons = [];
    }
}
