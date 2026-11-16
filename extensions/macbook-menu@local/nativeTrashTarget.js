import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

// A real Xwayland GTK popup negotiates the drop with Wayland/X11 sources.
// Never infer deletion from pointer position or selection owner disappearing.
export class NativeTrashTarget {
    constructor(bounds) {
        this.bounds = bounds;
        this.timer = 0;
        this.geometry = '';
        this.selection = global.display.get_selection();
        this.process = null;
        const script = GLib.build_filenamev([GLib.get_user_data_dir(), 'familiarmac', 'trash-drop-target.py']);
        if (!GLib.file_test(script, GLib.FileTest.IS_REGULAR)) return;
        try {
            this.process = Gio.Subprocess.new(['/usr/bin/python3', script], Gio.SubprocessFlags.NONE);
            this.signal = this.selection.connect('owner-changed', (_selection, type, owner) => {
                if (type !== Meta.SelectionType.SELECTION_DND) return;
                this.stop();
                if (!owner || !this.selection.get_mimetypes(type).includes('text/uri-list')) return;
                this.update();
                // Only while an external file drag is active. Tracks icon animation,
                // Dock growth, monitor choice and physical (HiDPI) actor coordinates.
                this.timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                    this.update();
                    return GLib.SOURCE_CONTINUE;
                });
            });
        } catch (error) { console.warn(`Trash target unavailable: ${error.message}`); }
    }
    call(method, parameters = null, done = null) {
        Gio.DBus.session.call('org.familiarmac.TrashTarget', '/org/familiarmac/TrashTarget',
            'org.familiarmac.TrashTarget', method, parameters, null,
            Gio.DBusCallFlags.NO_AUTO_START, 500, null, (connection, result) => {
                try { connection.call_finish(result); done?.(true); }
                catch (_) { done?.(false); } // Keep the existing desktop fallback intact.
            });
    }
    update() {
        const rect = this.bounds();
        const geometry = rect ? JSON.stringify(rect) : '';
        if (geometry === this.geometry) return;
        this.geometry = geometry;
        if (!rect) { this.call('Hide'); return; }
        this.call('Show', new GLib.Variant('(iiii)', rect), ok => {
            if (!ok && this.geometry === geometry) this.geometry = ''; // helper startup retry
        });
    }
    stop() {
        if (this.timer) GLib.source_remove(this.timer);
        this.timer = 0;
        this.geometry = '';
        this.call('Hide');
    }
    destroy() {
        if (this.signal) this.selection.disconnect(this.signal);
        this.stop();
        if (this.process) this.call('Shutdown');
        this.process = null;
    }
}
