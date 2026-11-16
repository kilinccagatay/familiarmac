import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class IconAlignment extends Extension {
    enable() {
        this._stopped = false;
        this._settings = new Gio.Settings({schema_id: 'org.gnome.shell'});
        this._apps = Shell.AppSystem.get_default();
        this._favoritesSignal = this._settings.connect('changed::favorite-apps', () => this._schedule());
        this._appsSignal = this._apps.connect('installed-changed', () => this._schedule());
        this._schedule();
    }
    _schedule() {
        if (this._stopped) return;
        this._dirty = true;
        if (this._timer || this._process) return;
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 350, () => {
            this._timer = 0;
            this._run();
            return GLib.SOURCE_REMOVE;
        });
    }
    _run() {
        this._dirty = false;
        const script = GLib.build_filenamev([GLib.get_home_dir(), '.local', 'lib', 'familiarmac', 'align-icons.py']);
        try {
            const process = Gio.Subprocess.new(['/usr/bin/python3', script, '--refresh'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            this._process = process;
            process.communicate_utf8_async(null, null, (child, result) => {
                try {
                    const [, output, error] = child.communicate_utf8_finish(result);
                    if (!this._stopped) {
                        if (!child.get_successful()) console.warn(`FamiliarMac icons: ${error}`);
                        else if (JSON.parse(output).changed)
                            St.TextureCache.get_default().rescan_icon_theme();
                    }
                } catch (error) {
                    if (!this._stopped) console.warn(`FamiliarMac icons: ${error}`);
                } finally {
                    this._process = null;
                    if (this._dirty && !this._stopped) this._schedule();
                }
            });
        } catch (error) {
            this._process = null;
            console.warn(`FamiliarMac icons: ${error}`);
        }
    }
    disable() {
        this._stopped = true;
        if (this._timer) GLib.source_remove(this._timer);
        this._timer = 0;
        this._settings.disconnect(this._favoritesSignal);
        this._apps.disconnect(this._appsSignal);
        this._process?.force_exit();
        this._dirty = false;
    }
}
