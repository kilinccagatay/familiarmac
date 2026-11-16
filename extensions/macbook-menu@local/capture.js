import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Screenshot from 'resource:///org/gnome/shell/ui/screenshot.js';

// Compositor accelerators continue working during Shell popup and modal grabs.
export class CaptureBindings {
    constructor() {
        this.bindings = new Map();
        this.previous = [];
        this.signal = global.display.connect('accelerator-activated', (_d, id) => {
            const binding = this.bindings.get(id);
            if (binding) this.capture(binding.area, binding.clipboard).catch(logError);
        });
        const definitions = [
            ['area-file', '<Super><Shift>4', true, false],
            ['screen-clipboard', '<Super><Control><Shift>3', false, true],
            ['area-clipboard', '<Super><Control><Shift>4', true, true],
        ];
        const backupPath = GLib.build_filenamev([GLib.get_user_state_dir(), 'macbook-zorin', 'capture-bindings.json']);
        this.backupFile = Gio.File.new_for_path(backupPath);
        let saved = {};
        if (this.backupFile.query_exists(null)) {
            const [, data] = this.backupFile.load_contents(null);
            saved = JSON.parse(new TextDecoder().decode(data));
        }
        for (const [suffix] of definitions) {
            const settings = new Gio.Settings({schema_id: 'org.gnome.settings-daemon.plugins.media-keys.custom-keybinding',
                path: `/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/macbook-${suffix}/`});
            const current = settings.get_string('binding');
            const original = current || saved[suffix] || '';
            this.previous.push([settings, original]);
            saved[suffix] = original;
        }
        GLib.mkdir_with_parents(GLib.path_get_dirname(backupPath), 0o700);
        this.backupFile.replace_contents(JSON.stringify(saved), null, false, Gio.FileCreateFlags.PRIVATE, null);
        for (const [settings] of this.previous) {
            settings.set_string('binding', '');
        }
        // Let media-keys release its old passive grabs before claiming them.
        this.timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this.timer = 0;
            const modes = Shell.ActionMode.ALL & ~(Shell.ActionMode.LOGIN_SCREEN |
                Shell.ActionMode.LOCK_SCREEN | Shell.ActionMode.UNLOCK_SCREEN);
            for (const [, accelerator, area, clipboard] of definitions) {
                const id = global.display.grab_accelerator(accelerator, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT);
                if (!id) {
                    const index = definitions.findIndex(def => def[1] === accelerator);
                    const [settings, original] = this.previous[index];
                    settings.set_string('binding', original);
                    logError(new Error(`Screenshot binding unavailable: ${accelerator}`));
                    continue;
                }
                const name = Meta.external_binding_name_for_action(id);
                Main.wm.allowKeybinding(name, modes);
                this.bindings.set(id, {name, area, clipboard});
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    async capture(area, clipboard) {
        if (this.busy) return;
        this.busy = true;
        let frozen;
        try {
            // Freeze BEFORE selecting: the image contains the open menu/dialog.
            const [content, scale] = await new Shell.Screenshot().screenshot_stage_to_content();
            let geometry = [0, 0, -1, -1];
            if (area) {
                frozen = new Clutter.Actor({content, width: global.stage.width, height: global.stage.height});
                Main.uiGroup.add_child(frozen);
                this.selector = new Screenshot.SelectArea();
                const rect = await this.selector.selectAsync();
                this.selector = null;
                if (!rect) return; // Escape cancels without writing or changing clipboard.
                geometry = [rect.x, rect.y, rect.width, rect.height].map(n => Math.round(n * scale));
            }
            const stream = Gio.MemoryOutputStream.new_resizable();
            await Shell.Screenshot.composite_to_stream(content.get_texture(), ...geometry,
                1, null, 0, 0, 1, stream);
            stream.close(null);
            const bytes = stream.steal_as_bytes();
            if (clipboard) {
                St.Clipboard.get_default().set_content(St.ClipboardType.CLIPBOARD, 'image/png', bytes);
            } else {
                const dir = GLib.build_filenamev([GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) || GLib.get_home_dir(), 'Screenshots']);
                GLib.mkdir_with_parents(dir, 0o755);
                const file = Gio.File.new_for_path(`${dir}/Screenshot-${GLib.get_real_time()}.png`);
                await new Promise((resolve, reject) => {
                    file.replace_contents_bytes_async(bytes, null, false, Gio.FileCreateFlags.NONE, null,
                        (source, result) => {
                            try { source.replace_contents_finish(result); resolve(); }
                            catch (error) { reject(error); }
                        });
                });
            }
        } finally {
            frozen?.destroy();
            this.busy = false;
        }
    }

    destroy() {
        if (this.timer) GLib.source_remove(this.timer);
        this.selector?._grabHelper.ungrab();
        global.display.disconnect(this.signal);
        for (const [id, {name}] of this.bindings) {
            global.display.ungrab_accelerator(id);
            Main.wm.allowKeybinding(name, Shell.ActionMode.NONE);
        }
        this.bindings.clear();
        for (const [settings, binding] of this.previous)
            if (settings.get_string('binding') === '') settings.set_string('binding', binding);
        if (this.backupFile.query_exists(null)) this.backupFile.delete(null);
    }
}
