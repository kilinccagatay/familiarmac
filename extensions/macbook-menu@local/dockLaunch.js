import GLib from 'gi://GLib';
import Shell from 'gi://Shell';

// Preserve normal dock behavior. Only handle a click with no surviving windows.
export class DockLaunch {
    constructor() {
        this.closing = new WeakSet();
        this.icons = new Map();
        this.pending = new Map();
        this.signal = global.window_manager.connect('destroy', (_wm, actor) => {
            if (actor.meta_window) this.closing.add(actor.meta_window);
        });
    }
    windows(app) {
        return app.get_windows().filter(w => !this.closing.has(w) && !w.is_override_redirect());
    }
    track(icon) {
        if (this.icons.has(icon) || typeof icon._activate !== 'function') return;
        const original = icon._activate;
        const controller = this;
        const wrapper = function (event) {
            if (event.button !== 1 || event.modifiers || controller.windows(this.app).length)
                return original.call(this, event);
            controller.request(this.app);
        };
        icon._activate = wrapper;
        const signal = icon.connect('destroy', () => {
            if (icon._activate === wrapper) icon._activate = original;
            controller.icons.delete(icon);
        });
        this.icons.set(icon, {original, wrapper, signal});
    }
    request(app) {
        const id = app.get_id();
        if (this.pending.has(id)) return; // repeated clicks must not create duplicate windows
        const launch = () => {
            if (app.can_open_new_window()) app.open_new_window(-1);
            else app.activate();
        };
        if (app.state === Shell.AppState.STOPPED) { launch(); return; }
        // Closing the last window leaves RUNNING briefly while the process exits.
        // Launch once after STOPPED, or after a bounded wait for background apps.
        const deadline = GLib.get_monotonic_time() + 1500000;
        const timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            if (this.windows(app).length) {
                this.pending.delete(id);
                return GLib.SOURCE_REMOVE;
            }
            if (app.state !== Shell.AppState.STOPPED && GLib.get_monotonic_time() < deadline)
                return GLib.SOURCE_CONTINUE;
            this.pending.delete(id);
            launch();
            return GLib.SOURCE_REMOVE;
        });
        this.pending.set(id, timer);
    }
    destroy() {
        global.window_manager.disconnect(this.signal);
        for (const timer of this.pending.values()) GLib.source_remove(timer);
        this.pending.clear();
        for (const [icon, {original, wrapper, signal}] of this.icons) {
            icon.disconnect(signal);
            if (icon._activate === wrapper) icon._activate = original;
        }
        this.icons.clear();
    }
}
