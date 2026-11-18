import {TrayActivation} from './trayActivation.js';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Applications own the actions; Shell owns these StatusNotifier popup actors.
// Reuse the same compact light/dark menu surface as the Dock, without changing
// exported labels, callbacks, checkmarks, sensitivity or application state.
export class IndicatorMenus {
    constructor() {
        this.buttons = new Map();
        this.activation = new TrayActivation();
        this.boxes = [Main.panel._leftBox, Main.panel._centerBox, Main.panel._rightBox];
        this.signals = this.boxes.map(box => box.connect('child-added', () => this.queue()));
        this.sync();
    }
    queue() {
        if (this.idle) return;
        this.idle = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this.idle = 0;
            this.sync();
            return GLib.SOURCE_REMOVE;
        });
    }
    style(button, record) {
        if (record.actor) {
            record.actor.disconnect(record.actorDestroy);
            for (const name of record.added) record.actor.remove_style_class_name(name);
        }
        record.actor = button.menu?.actor;
        record.added = [];
        if (!record.actor) return;
        record.actorDestroy = record.actor.connect('destroy', () => { record.actor = null; record.added = []; });
        for (const name of ['fm-dock-menu', 'fm-indicator-menu']) {
            if (record.actor.has_style_class_name(name)) continue;
            record.actor.add_style_class_name(name);
            record.added.push(name);
        }
    }
    sync() {
        for (const [id, button] of Object.entries(Main.panel.statusArea)) {
            if (!id.startsWith('appindicator-') || this.buttons.has(button)) continue;
            this.activation.track(button._indicator);
            const record = {};
            record.menu = button.connect('menu-set', () => this.style(button, record));
            record.destroy = button.connect('destroy', () => {
                this.activation.untrack(button._indicator);
                this.buttons.delete(button);
            });
            this.buttons.set(button, record);
            this.style(button, record);
        }
    }
    destroy() {
        this.activation.destroy();
        if (this.idle) GLib.source_remove(this.idle);
        this.boxes.forEach((box, i) => box.disconnect(this.signals[i]));
        for (const [button, record] of this.buttons) {
            button.disconnect(record.menu);
            button.disconnect(record.destroy);
            if (record.actor) record.actor.disconnect(record.actorDestroy);
            for (const name of record.added) record.actor.remove_style_class_name(name);
        }
        this.buttons.clear();
    }
}
