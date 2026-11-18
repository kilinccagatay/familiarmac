import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

// GNOME <49 associates tray activation tokens with an application startup.
// XWayland clients can ignore that token when restoring an existing window.
// Complete ONLY our recorded tray sequence after its app actually gains focus;
// never invalidate a Wayland token before the client has had a chance to use it.
export class TrayActivation {
    constructor() {
        this.records = new Map();
        this.pending = new Map();
        this.active = Number.parseInt(Config.PACKAGE_VERSION) < 49;
        if (!this.active) return;
        this.tracker = Shell.WindowTracker.get_default();
        this.focusSignal = global.display.connect('notify::focus-window', () => this.queue());
        this.trackerSignal = this.tracker.connect('tracked-windows-changed', () => this.queue());
    }
    track(indicator) {
        if (!this.active || !indicator || this.records.has(indicator) ||
            typeof indicator._getActivationToken !== 'function') return;
        const original = indicator._getActivationToken;
        const controller = this;
        const wrapper = function (...args) {
            const result = original.apply(this, args);
            const [context, token] = result;
            const appId = this._appInfo?.get_id?.();
            // No guessing from titles, fake AppInfos or process names.
            if (context && token && appId) {
                const entry = {context, appId, timer: 0};
                entry.timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16000, () => {
                    controller.pending.delete(token);
                    return GLib.SOURCE_REMOVE;
                });
                controller.pending.set(token, entry);
            }
            return result;
        };
        indicator._getActivationToken = wrapper;
        this.records.set(indicator, {original, wrapper});
    }
    untrack(indicator) {
        const saved = this.records.get(indicator);
        if (!saved) return;
        if (indicator._getActivationToken === saved.wrapper)
            indicator._getActivationToken = saved.original;
        this.records.delete(indicator);
    }
    queue() {
        if (this.idle || !this.pending.size) return;
        this.idle = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this.idle = 0;
            const window = global.display.focus_window;
            if (!window || window.minimized || window.is_override_redirect()) return GLib.SOURCE_REMOVE;
            const appId = this.tracker.get_window_app(window)?.get_id();
            for (const [token, entry] of this.pending) {
                if (entry.appId !== appId) continue;
                this.pending.delete(token);
                GLib.source_remove(entry.timer);
                // This API removes startup bookkeeping; it does not close the app.
                try { entry.context.launch_failed(token); }
                catch (error) { console.warn(`Tray activation cleanup: ${error.message}`); }
            }
            return GLib.SOURCE_REMOVE;
        });
    }
    destroy() {
        if (!this.active) return;
        if (this.idle) GLib.source_remove(this.idle);
        global.display.disconnect(this.focusSignal);
        this.tracker.disconnect(this.trackerSignal);
        for (const entry of this.pending.values()) GLib.source_remove(entry.timer);
        this.pending.clear();
        for (const [indicator, saved] of this.records)
            if (indicator._getActivationToken === saved.wrapper)
                indicator._getActivationToken = saved.original;
        this.records.clear();
    }
}
