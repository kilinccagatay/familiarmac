import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

// Shell 46 deliberately keeps STARTING apps out of get_running(), even after
// _shell_app_add_window. An X11 client which fails to complete its launch token
// therefore has a usable window but no running Dock icon until startup timeout.
// Do not disable startup notifications: complete only an unambiguous launch
// belonging to an already mapped, focused normal window of a STARTING app.
export function completeFocusedStartup(window, tracker) {
    if (!window || window.minimized || window.skip_taskbar ||
        window.is_override_redirect() || window.get_window_type() !== Meta.WindowType.NORMAL ||
        window.get_client_type() !== Meta.WindowClientType.X11 ||
        !window.get_compositor_private()?.mapped) return false;
    const app = tracker.get_window_app(window);
    if (!app || app.state !== Shell.AppState.STARTING || !app.get_windows().includes(window)) return false;
    const appId = app.get_id();
    const sequences = tracker.get_startup_sequences().filter(sequence =>
        !sequence.get_completed() && sequence.get_application_id()?.split('/').pop() === appId);
    const startupId = window.get_startup_id();
    const exact = sequences.find(sequence => startupId && sequence.get_id() === startupId);
    const sequence = exact ?? (sequences.length === 1 ? sequences[0] : null);
    if (!sequence || typeof sequence.complete !== 'function') return false;
    sequence.complete();
    console.debug(`FamiliarMac: completed startup for focused window (${appId})`);
    return true;
}

export class StartupCompletion {
    constructor() {
        this.signals = [];
        this.pending = 0;
        if (Number.parseInt(Config.PACKAGE_VERSION) >= 49) return;
        this.tracker = Shell.WindowTracker.get_default();
        this.laters = global.compositor.get_laters();
        for (const [object, signal] of [
            [global.display, 'notify::focus-window'],
            [global.window_manager, 'map'],
            [this.tracker, 'tracked-windows-changed'],
            [this.tracker, 'startup-sequence-changed'],
        ]) this.signals.push([object, object.connect(signal, () => this.queue())]);
        this.queue();
    }
    queue() {
        if (this.pending) return;
        this.pending = this.laters.add(Meta.LaterType.BEFORE_REDRAW, () => {
            this.pending = 0;
            completeFocusedStartup(global.display.focus_window, this.tracker);
            return false;
        });
    }
    destroy() {
        if (this.pending) this.laters.remove(this.pending);
        for (const [object, signal] of this.signals) object.disconnect(signal);
        this.signals = [];
        this.pending = 0;
    }
}
