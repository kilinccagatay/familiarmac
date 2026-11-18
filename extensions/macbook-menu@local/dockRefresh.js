import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

// Tray windows can reappear or clear skip-taskbar without an app-state change.
// Schedule with the compositor: normal-priority idles can starve during redraws.
export class DockRefresh {
    constructor() {
        this.dashes = new Map();
        this.windows = new Map();
        this.pending = 0;
        this.laters = global.compositor.get_laters();
        this.tracker = Shell.WindowTracker.get_default();
        this.signals = [
            [global.window_manager, global.window_manager.connect('map', (_wm, actor) => {
                this.watchWindow(actor.meta_window); this.queue();
            })],
            [global.window_manager, global.window_manager.connect('destroy', () => this.queue())],
            [this.tracker, this.tracker.connect('tracked-windows-changed', () => this.queue())],
            [this.tracker, this.tracker.connect('notify::focus-app', () => this.queue())],
        ];
        for (const actor of global.get_window_actors()) this.watchWindow(actor.meta_window);
    }
    watchWindow(window) {
        if (!window || this.windows.has(window) || window.is_override_redirect()) return;
        const signals = ['notify::skip-taskbar', 'notify::wm-class'].map(name =>
            window.connect(name, () => this.queue()));
        signals.push(window.connect('unmanaged', () => {
            for (const signal of this.windows.get(window) ?? []) window.disconnect(signal);
            this.windows.delete(window);
            this.queue();
        }));
        this.windows.set(window, signals);
    }
    track(actor) {
        const dash = actor._delegate;
        if (!dash || dash._box !== actor || typeof dash._redisplay !== 'function' || this.dashes.has(dash)) return;
        const mapped = dash.connect('notify::mapped', () => { if (dash.mapped) this.queue(); });
        const destroyed = actor.connect('destroy', () => {
            dash.disconnect(mapped);
            this.dashes.delete(dash);
        });
        this.dashes.set(dash, {actor, mapped, destroyed});
    }
    queue() {
        if (this.pending) return;
        this.pending = this.laters.add(Meta.LaterType.BEFORE_REDRAW, () => {
            this.pending = 0;
            for (const dash of this.dashes.keys()) {
                // Let the existing DND transaction own its placeholder/layout.
                if (dash.mapped && !dash._dragPlaceholder && !dash._animatingPlaceholdersCount)
                    dash._redisplay();
            }
            return false;
        });
    }
    destroy() {
        if (this.pending) this.laters.remove(this.pending);
        this.pending = 0;
        for (const [object, signal] of this.signals) object.disconnect(signal);
        for (const [window, signals] of this.windows)
            for (const signal of signals) window.disconnect(signal);
        this.windows.clear();
        for (const [dash, saved] of this.dashes) {
            dash.disconnect(saved.mapped);
            saved.actor.disconnect(saved.destroyed);
        }
        this.dashes.clear();
    }
}
