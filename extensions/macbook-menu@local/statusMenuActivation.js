import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// GNOME calls _changeMenu for pointer ENTER and focus traversal, while actual
// button presses/keyboard activation call menu.toggle/open directly. Status
// menus require explicit activation; leave the native exclusive-menu grab and
// outside-click/Escape handling intact.
export class StatusMenuActivation {
    constructor() {
        this.manager = Main.panel.menuManager;
        this.original = this.manager._changeMenu;
        this.wrapper = menu => {
            const right = Main.panel._rightBox;
            const isStatus = candidate => Boolean(candidate?.sourceActor &&
                right.contains(candidate.sourceActor));
            if (isStatus(menu) || isStatus(this.manager.activeMenu)) return;
            return this.original.call(this.manager, menu);
        };
        this.manager._changeMenu = this.wrapper;
        this.signal = global.stage.connect('captured-event', (_stage, event) => this.event(event));
    }
    event(event) {
        const active = this.manager.activeMenu;
        if (!active?.isOpen) return Clutter.EVENT_PROPAGATE;
        const type = event.type();
        if (type !== Clutter.EventType.BUTTON_PRESS && type !== Clutter.EventType.TOUCH_BEGIN)
            return Clutter.EVENT_PROPAGATE;
        if (type === Clutter.EventType.BUTTON_PRESS && event.get_button() !== 1)
            return Clutter.EVENT_PROPAGATE;
        // Modified presses belong to panel rearrangement, not menu activation.
        if (event.get_state() & (Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.SUPER_MASK))
            return Clutter.EVENT_PROPAGATE;
        const [x, y] = event.get_coords();
        const button = Object.values(Main.panel.statusArea).find(candidate => {
            if (!candidate?.mapped || !candidate.menu?.toggle || !Main.panel._rightBox.contains(candidate))
                return false;
            const [left, top] = candidate.get_transformed_position();
            const [width, height] = candidate.get_transformed_size();
            return x >= left && x < left + width && y >= top && y < top + height;
        });
        if (!button) return Clutter.EVENT_PROPAGATE;
        const same = active.sourceActor === button;
        active.close(0);
        if (!same) button.menu.toggle();
        // This press was explicitly dispatched; don't toggle the target twice.
        return Clutter.EVENT_STOP;
    }
    destroy() {
        if (this.signal) global.stage.disconnect(this.signal);
        this.signal = 0;
        if (this.manager._changeMenu === this.wrapper)
            this.manager._changeMenu = this.original;
    }
}
