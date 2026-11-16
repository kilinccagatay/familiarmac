import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Follow the desktop preference, including changes made by scheduled theme tools.
// Scope colors to FamiliarMac surfaces; never replace the user's GTK/Shell theme.
export class SystemAppearance {
    constructor() {
        this.settings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        this.signal = this.settings.connect('changed::color-scheme', () => this.sync());
        this.sync();
    }
    sync() {
        const dark = this.settings.get_string('color-scheme') === 'prefer-dark';
        Main.uiGroup.remove_style_class_name(dark ? 'fm-system-light' : 'fm-system-dark');
        Main.uiGroup.add_style_class_name(dark ? 'fm-system-dark' : 'fm-system-light');
    }
    destroy() {
        this.settings.disconnect(this.signal);
        Main.uiGroup.remove_style_class_name('fm-system-dark');
        Main.uiGroup.remove_style_class_name('fm-system-light');
    }
}
