import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Optional capability adapters read real app-owned bindings. Exported accelerators
// remain authoritative. No label matching, key assignment or global shortcut grab.
export class ApplicationShortcuts {
    constructor(appId, changed) {
        this.values = {};
        this._changed = changed;
        this._appId = appId;
        this._monitors = [];
        if (appId) this._load();
    }
    _load() {
        this._cancellable?.cancel();
        this._cancellable = new Gio.Cancellable();
        const request = this._cancellable;
        const helper = GLib.build_filenamev([GLib.get_home_dir(), '.local/lib/familiarmac/application-shortcuts.py']);
        try {
            const process = Gio.Subprocess.new(['/usr/bin/python3', helper, this._appId],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
            process.communicate_utf8_async(null, this._cancellable, (proc, result) => {
                if (!this._changed || request !== this._cancellable) return;
                try {
                    const [, output] = proc.communicate_utf8_finish(result);
                    if (!proc.get_successful()) return;
                    const data = JSON.parse(output);
                    this.values = data.shortcuts ?? {};
                    for (const monitor of this._monitors) monitor.cancel();
                    this._monitors = [];
                    for (const path of [...new Set(data.sources ?? [])]) {
                        try {
                            const file = Gio.File.new_for_path(path);
                            const monitor = file.monitor(Gio.FileMonitorFlags.NONE, null);
                            monitor.connect('changed', () => this._queue());
                            this._monitors.push(monitor);
                        } catch (_) { /* Missing user keymap can be created later; parent is watched. */ }
                    }
                    this._changed();
                } catch (_) { /* Keep menu usable if an app file is unavailable. */ }
            });
        } catch (_) { }
    }
    _queue() {
        if (this._pending || !this._changed) return;
        this._pending = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            this._pending = 0; this._load(); return GLib.SOURCE_REMOVE;
        });
    }
    lookup(action, target) {
        if (!target && /^(app|win)\.[A-Za-z0-9_.-]+$/.test(action ?? '')) return this.values[action] ?? '';
        if (!action || !Gio.Action.name_is_valid(action)) return '';
        return this.values[Gio.Action.print_detailed_name(action, target)] ?? '';
    }
    destroy() {
        this._changed = null;
        this._cancellable?.cancel();
        if (this._pending) GLib.source_remove(this._pending);
        this._pending = 0;
        for (const monitor of this._monitors) monitor.cancel();
        this._monitors = [];
    }
}
