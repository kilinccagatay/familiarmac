import Gio from 'gi://Gio';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Style the native controls: retain hardware state, accessibility and submenus.
// No polling, duplicated settings service, or unsupported Apple-only controls.
export class ControlCenter {
    constructor(path) {
        this.panel = Main.panel.statusArea.quickSettings;
        if (!this.panel?._indicators || !this.panel.menu?.box) return;
        this.panel.add_style_class_name('familiarmac-status');
        this.panel.menu.box.add_style_class_name('familiarmac-control-center');
        this.icon = new St.Icon({
            gicon: new Gio.FileIcon({file: Gio.File.new_for_path(`${path}/controlCenter.svg`)}),
            icon_size: 18, style_class: 'system-status-icon familiarmac-control-icon',
        });
        this.panel._indicators.add_child(this.icon);
    }

    destroy() {
        this.icon?.destroy();
        this.icon = null;
        this.panel?.remove_style_class_name('familiarmac-status');
        this.panel?.menu?.box?.remove_style_class_name('familiarmac-control-center');
        this.panel = null;
    }
}
