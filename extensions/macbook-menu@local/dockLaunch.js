import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import {readProcessIdentity} from './processTracker.js';

// Preserve normal dock behavior. Only handle a click with no surviving windows.
export class DockLaunch {
    constructor(readProcess = readProcessIdentity, showApps = null) {
        this.showApps = showApps;
        this.readProcess = readProcess;
        this.closing = new WeakSet();
        this.icons = new Map();
        this.pending = new Map();
        this.apps = new Map();
        this.signal = global.window_manager.connect('destroy', (_wm, actor) => {
            if (!actor.meta_window) return;
            this.closing.add(actor.meta_window);
            for (const record of this.apps.values()) {
                if (record.app.get_windows().includes(actor.meta_window)) {
                    this._capture(record);
                    record.closing = true;
                }
            }
        });
    }
    windows(app) {
        return app.get_windows().filter(w => !this.closing.has(w) && !w.is_override_redirect());
    }
    _capture(record) {
        for (const pid of record.app.get_pids?.() ?? []) {
            const start = this.readProcess(pid);
            if (start !== null) record.pids.set(pid, start);
        }
        for (const [pid, start] of record.pids)
            if (this.readProcess(pid) !== start) record.pids.delete(pid);
    }
    _remember(app) {
        const id = app.get_id();
        let record = this.apps.get(id);
        if (record) return record;
        record = {app, pids: new Map(), closing: false, hadWindows: this.windows(app).length > 0};
        this._capture(record);
        record.signal = app.connect('windows-changed', () => {
            const hasWindows = this.windows(app).length > 0;
            if (hasWindows) {
                record.closing = false;
                this._capture(record);
            } else if (record.hadWindows) {
                // Shell may already have forgotten the PIDs. Retain their start times.
                record.closing = true;
            }
            record.hadWindows = hasWindows;
        });
        this.apps.set(id, record);
        return record;
    }
    track(icon) {
        if (this.icons.has(icon) || typeof icon._activate !== 'function') return;
        this._remember(icon.app);
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
        // Apps is a Shell dialog, not a window-producing process. Each click
        // must reach its toggle instead of waiting for a nonexistent window.
        if (id === 'org.familiarmac.Apps.desktop' && this.showApps) {
            this.showApps();
            return;
        }
        if (this.pending.has(id)) return;
        const record = this._remember(app);
        this._capture(record);
        const oldPids = new Map(record.pids);
        const wasClosing = record.closing || app.get_windows().some(w => this.closing.has(w));
        const entry = {timer: 0, launched: false, retried: false};
        const deadline = GLib.get_monotonic_time() + 15000000;
        this.pending.set(id, entry);
        const finish = () => { this.pending.delete(id); return GLib.SOURCE_REMOVE; };
        const launch = () => {
            if (app.can_open_new_window()) app.open_new_window(-1);
            else app.activate();
            entry.launched = true;
        };
        const advance = () => {
            try {
                if (this.windows(app).length) { app.activate(); return finish(); }
                const oldAlive = [...oldPids].some(([pid, start]) => this.readProcess(pid) === start);
                if (GLib.get_monotonic_time() >= deadline) {
                    console.warn(`Dock open request timed out: ${id}`);
                    return finish(); // Never kill a process or repeatedly spawn launchers.
                }
                if (!entry.launched) {
                    // Ask immediately: background applications can create a window
                    // without exiting. If shutdown swallows this request, retain it
                    // until the old process exits and then retry exactly once.
                    if (!wasClosing && app.state === Shell.AppState.STARTING)
                        return GLib.SOURCE_CONTINUE;
                    launch();
                } else if (!entry.retried && oldPids.size && !oldAlive &&
                    app.state === Shell.AppState.STOPPED) {
                    // A click can race the last-window notification. Retry once after
                    // the old process actually exits, not on an arbitrary delay.
                    entry.retried = true;
                    launch();
                }
                return GLib.SOURCE_CONTINUE;
            } catch (error) {
                console.warn(`Dock open request failed: ${id}: ${error.message}`);
                return finish();
            }
        };
        if (advance() === GLib.SOURCE_CONTINUE)
            entry.timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, advance);
    }
    destroy() {
        global.window_manager.disconnect(this.signal);
        for (const entry of this.pending.values()) if (entry.timer) GLib.source_remove(entry.timer);
        this.pending.clear();
        for (const record of this.apps.values()) record.app.disconnect(record.signal);
        this.apps.clear();
        for (const [icon, {original, wrapper, signal}] of this.icons) {
            icon.disconnect(signal);
            if (icon._activate === wrapper) icon._activate = original;
        }
        this.icons.clear();
    }
}
