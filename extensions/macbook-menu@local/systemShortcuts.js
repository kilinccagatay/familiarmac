import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class SystemShortcuts {
    constructor() {
        this.bindings = new Map();
        this.signal = global.display.connect('accelerator-activated', (_display, id) => {
            this.bindings.get(id)?.activate();
        });
    }
    add(item, accelerator, hint, activate) {
        const id = global.display.grab_accelerator(accelerator, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT);
        if (!id) {
            console.warn(`FamiliarMac: shortcut already in use: ${accelerator}; left unchanged`);
            return false;
        }
        const name = Meta.external_binding_name_for_action(id);
        Main.wm.allowKeybinding(name, Shell.ActionMode.NORMAL | Shell.ActionMode.POPUP);
        this.bindings.set(id, {name, activate});
        item.label.x_expand = true;
        item.add_child(new St.Label({text: hint, style_class: 'fm-system-shortcut',
            x_align: Clutter.ActorAlign.END, y_align: Clutter.ActorAlign.CENTER}));
        return true;
    }
    destroy() {
        global.display.disconnect(this.signal);
        for (const [id, {name}] of this.bindings) {
            Main.wm.allowKeybinding(name, Shell.ActionMode.NONE);
            global.display.ungrab_accelerator(id);
        }
        this.bindings.clear();
    }
}
