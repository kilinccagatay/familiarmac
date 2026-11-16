import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export function moveBefore(order, source, target, after) {
    if (source === target || !order.includes(source) || !order.includes(target)) return [...order];
    const result = order.filter(id => id !== source);
    result.splice(result.indexOf(target) + Number(after), 0, source);
    return result;
}

export class PanelOrder {
    constructor() {
        this.box = Main.panel._rightBox;
        this.file = Gio.File.new_for_path(`${GLib.get_user_config_dir()}/familiarmac-panel-order.json`);
        this.original = this.order();
        this.signal = global.stage.connect('captured-event', (_stage, event) => this.event(event));
        this.file.load_contents_async(null, (file, result) => {
            try {
                const [, bytes] = file.load_contents_finish(result);
                const ids = JSON.parse(new TextDecoder().decode(bytes));
                if (!this.stopped && !this.touched && Array.isArray(ids) && ids.every(id => typeof id === 'string')) this.apply(ids);
            } catch (_) { /* First installation has no saved order. */ }
        });
    }
    entries() {
        return Object.entries(Main.panel.statusArea).map(([id, button]) => ({id, button, actor: button.container}))
            .filter(({actor}) => actor?.get_parent() === this.box);
    }
    order() {
        const entries = this.entries();
        return this.box.get_children().map(actor => entries.find(e => e.actor === actor)?.id).filter(Boolean);
    }
    apply(ids) {
        const entries = this.entries();
        const current = this.order();
        const ordered = [...new Set(ids)].filter(id => current.includes(id));
        ordered.push(...current.filter(id => !ordered.includes(id)));
        const slots = this.box.get_children().map((actor, i) => entries.some(e => e.actor === actor) ? i : -1).filter(i => i >= 0);
        ordered.forEach((id, i) => this.box.set_child_at_index(entries.find(e => e.id === id).actor, slots[i]));
    }
    hit(x, y) {
        return this.entries().find(({actor}) => {
            if (!actor.visible) return false;
            const [ax, ay] = actor.get_transformed_position();
            const [w, h] = actor.get_transformed_size();
            return x >= ax && x < ax + w && y >= ay && y < ay + h;
        });
    }
    event(event) {
        const type = event.type();
        if (this.drag && type === Clutter.EventType.KEY_PRESS && event.get_key_symbol() === Clutter.KEY_Escape) {
            this.apply(this.drag.before); this.drag = null; return Clutter.EVENT_STOP;
        }
        if (type === Clutter.EventType.BUTTON_PRESS && event.get_button() === 1 &&
            (event.get_state() & (Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.SUPER_MASK))) {
            // keyd maps this machine's physical Command to Control. Unmapped
            // keyboards can use Super; no keyboard/input configuration changes.
            const [x, y] = event.get_coords();
            const entry = this.hit(x, y);
            if (!entry) return Clutter.EVENT_PROPAGATE;
            this.touched = true;
            for (const {button} of this.entries()) button.menu?.close();
            this.drag = {id: entry.id, x, before: this.order(), moved: false};
            return Clutter.EVENT_STOP;
        }
        if (!this.drag) return Clutter.EVENT_PROPAGATE;
        if (type === Clutter.EventType.MOTION) {
            const [x, y] = event.get_coords();
            if (!this.drag.moved && Math.abs(x - this.drag.x) < 6) return Clutter.EVENT_STOP;
            this.drag.moved = true;
            const target = this.hit(x, y);
            if (target) {
                const [tx] = target.actor.get_transformed_position();
                const [width] = target.actor.get_transformed_size();
                this.apply(moveBefore(this.order(), this.drag.id, target.id, x > tx + width / 2));
            }
            return Clutter.EVENT_STOP;
        }
        if (type === Clutter.EventType.BUTTON_RELEASE && event.get_button() === 1) {
            const [x, y] = event.get_coords();
            if (!this.hit(x, y)) this.apply(this.drag.before);
            else if (this.drag.moved) this.save();
            this.drag = null; return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }
    save() {
        this.pending = JSON.stringify(this.order());
        this.flush();
    }
    flush() {
        if (this.writing || !this.pending) return;
        const data = this.pending; this.pending = null; this.writing = true;
        this.file.replace_contents_bytes_async(new GLib.Bytes(new TextEncoder().encode(data)), null, false,
            Gio.FileCreateFlags.PRIVATE, null, (file, result) => {
                try { file.replace_contents_finish(result); } catch (error) { console.warn(error.message); }
                this.writing = false;
                if (!this.stopped) this.flush();
            });
    }
    destroy() {
        this.stopped = true;
        global.stage.disconnect(this.signal);
        this.drag = null;
        this.apply(this.original);
    }
}
