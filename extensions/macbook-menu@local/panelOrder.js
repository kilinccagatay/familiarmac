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

export function panelItemId(id, button) {
    if (!id.startsWith('appindicator-')) return id;
    // D-Bus names (:1.101 etc.) change on every session/application launch.
    const indicator = button._indicator;
    const stable = indicator?.id;
    return stable ? `appindicator-stable:${stable}` : id;
}

export class PanelOrder {
    constructor() {
        this.box = Main.panel._rightBox;
        this.file = Gio.File.new_for_path(`${GLib.get_user_config_dir()}/familiarmac-panel-order.json`);
        this.original = this.order();
        this.preferred = [];
        this.signal = global.stage.connect('captured-event', (_stage, event) => this.event(event));
        // This small, local preference must be applied before the first paint.
        // An async read otherwise visibly shuffles the already displayed icons.
        try {
            const [, bytes] = this.file.load_contents(null);
            const ids = JSON.parse(new TextDecoder().decode(bytes));
            if (Array.isArray(ids) && ids.every(id => typeof id === 'string')) {
                this.preferred = ids.filter(id => !/^appindicator-:/.test(id));
                this.apply(this.preferred);
            }
        } catch (_) { /* First installation has no saved order. */ }
        this.childAdded = this.box.connect('child-added', () => {
            if (this.reorderIdle || this.stopped) return;
            // addToStatusArea registers the button after inserting its actor.
            this.reorderIdle = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this.reorderIdle = 0;
                if (!this.stopped && !this.drag) this.apply(this.preferred);
                return GLib.SOURCE_REMOVE;
            });
        });
    }
    entries() {
        return Object.entries(Main.panel.statusArea).map(([id, button]) => ({id: panelItemId(id, button), button, actor: button?.container}))
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
        for (const id of current.filter(id => !ordered.includes(id))) {
            if (id.startsWith('appindicator-')) {
                const anchor = ordered.findIndex(key => key.startsWith('familiarmac-status-') ||
                    ['quickSettings', 'familiarmac-focus', 'dateMenu'].includes(key));
                ordered.splice(anchor < 0 ? ordered.length : anchor, 0, id);
            } else ordered.push(id);
        }
        if (!ids.includes('familiarmac-focus') && ordered.includes('familiarmac-focus') && ordered.includes('dateMenu')) {
            ordered.splice(ordered.indexOf('familiarmac-focus'), 1);
            ordered.splice(ordered.indexOf('dateMenu'), 0, 'familiarmac-focus');
        }
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
    held(state) {
        return Boolean(state & Clutter.ModifierType.BUTTON1_MASK);
    }
    finish(commit = false) {
        const drag = this.drag;
        this.drag = null;
        if (this.dragWatch) GLib.source_remove(this.dragWatch);
        this.dragWatch = 0;
        if (!drag) return;
        if (commit && drag.moved) this.save();
        else this.apply(drag.before);
    }
    event(event) {
        const type = event.type();
        if (this.drag && type === Clutter.EventType.KEY_PRESS && event.get_key_symbol() === Clutter.KEY_Escape) {
            this.finish(); return Clutter.EVENT_STOP;
        }
        if (type === Clutter.EventType.BUTTON_PRESS && event.get_button() === 1 &&
            (event.get_state() & (Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.SUPER_MASK))) {
            // keyd maps this machine's physical Command to Control. Unmapped
            // keyboards can use Super; no keyboard/input configuration changes.
            const [x, y] = event.get_coords();
            const entry = this.hit(x, y);
            if (!entry) return Clutter.EVENT_PROPAGATE;
            this.finish();
            this.touched = true;
            for (const {button} of this.entries()) button.menu?.close();
            this.drag = {id: entry.id, x, before: this.order(), moved: false};
            // Never grab the panel: that excludes desktop/window input and
            // can also hide the release from the stage capture handler.
            // Observe only while the mouse is down; a missed release cancels.
            this.dragWatch = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                if (this.held(global.get_pointer()[2])) return GLib.SOURCE_CONTINUE;
                this.dragWatch = 0;
                this.finish();
                return GLib.SOURCE_REMOVE;
            });
            return Clutter.EVENT_STOP;
        }
        if (!this.drag) return Clutter.EVENT_PROPAGATE;
        if (type === Clutter.EventType.KEY_RELEASE &&
            [Clutter.KEY_Control_L, Clutter.KEY_Control_R, Clutter.KEY_Super_L, Clutter.KEY_Super_R, Clutter.KEY_Meta_L, Clutter.KEY_Meta_R].includes(event.get_key_symbol())) {
            this.finish(); return Clutter.EVENT_PROPAGATE;
        }
        if (type === Clutter.EventType.MOTION) {
            if (!this.held(event.get_state())) {
                this.finish(); return Clutter.EVENT_PROPAGATE;
            }
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
            this.finish(Boolean(this.hit(x, y)));
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }
    save() {
        const current = this.order();
        const remaining = [...current];
        // Preserve slots for applications that are temporarily not running.
        this.preferred = (this.preferred ?? []).map(id => current.includes(id) ? remaining.shift() : id);
        this.preferred.push(...remaining);
        this.pending = JSON.stringify(this.preferred);
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
        if (this.childAdded) this.box.disconnect(this.childAdded);
        if (this.reorderIdle) GLib.source_remove(this.reorderIdle);
        this.reorderIdle = 0;
        global.stage.disconnect(this.signal);
        this.finish();
        this.apply(this.original);
    }
}
