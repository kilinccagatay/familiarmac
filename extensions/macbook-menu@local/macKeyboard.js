import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import {SystemShortcuts} from './systemShortcuts.js';

// keyd translates only the Command layer; ordinary Ctrl shortcuts are untouched.
export function applicationWindows(app) {
    return (app?.get_windows() ?? []).filter(w => !w.skip_taskbar && !w.is_override_redirect());
}
export function runWindowCommand(command, app, apps, time) {
    if (!app) return;
    const targets = command === 'hide-others' ? apps.filter(a => a !== app) : [app];
    for (const target of targets) for (const window of applicationWindows(target)) {
        if (command === 'close-all') window.delete(time); // native save confirmations stay authoritative
        else if (window.can_minimize()) window.minimize();
    }
}
export class MacKeyboard {
    constructor() {
        this.bindings = new SystemShortcuts();
        this.alive = true;
        for (const [key, action] of [['h','hide'], ['j','hide-others'], ['m','minimize-all'], ['w','close-all']])
            this.bindings.add(null, `<Control><Alt><Super>${key}`, '', () => {
                const app = Shell.WindowTracker.get_default().focus_app;
                runWindowCommand(action, app, Shell.AppSystem.get_default().get_running(), global.get_current_time());
            });
        this.bindings.add(null, '<Control><Alt><Super>d', '', () => this.toggleDock());
        this.bindings.add(null, '<Control><Alt><Super>space', '', () => {
            if (GLib.find_program_in_path('gnome-characters')) Util.spawn(['gnome-characters']);
        });
        this.bindings.add(null, '<Control>Down', '', () => this.showAppWindows());
    }
    async showAppWindows() {
        const app = Shell.WindowTracker.get_default().focus_app;
        if (!app) return;
        const extension = Main.extensionManager.lookup('zorin-dash@zorinos.com');
        if (!extension) return;
        try {
            const module = await import(`${extension.dir.get_uri()}/extension.js`);
            if (this.alive) module.dockManager?.appSpread?.toggle(app);
        } catch (error) { console.warn(`FamiliarMac app windows: ${error.message}`); }
    }
    toggleDock() {
        const schema = Gio.SettingsSchemaSource.get_default().lookup('org.gnome.shell.extensions.zorin-dash', true);
        if (!schema) return;
        const settings = new Gio.Settings({settings_schema: schema});
        // Change the dock's supported auto-hide preference, never actor visibility.
        const hide = settings.get_boolean('dock-fixed') || !settings.get_boolean('autohide');
        settings.set_boolean('dock-fixed', !hide);
        settings.set_boolean('autohide', hide);
    }
    destroy() { this.alive = false; this.bindings.destroy(); }
}
