import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import {panelRanges} from './layout.js';

export default class PanelLayout extends Extension {
    enable() {
        this._injections = new InjectionManager();
        // GNOME treats unused panel space as a drag handle for whichever
        // maximized window is underneath, even when a different app is focused.
        // This is a menu bar: its background must never activate that window.
        // Button events are handled by the actual menu buttons as before.
        this._injections.overrideMethod(Object.getPrototypeOf(Main.panel), '_tryDragWindow', original => function (event) {
            if (this !== Main.panel || Main.sessionMode.isLocked || Main.sessionMode.isGreeter)
                return original.call(this, event);
            return Clutter.EVENT_STOP;
        });
        this._injections.overrideMethod(Object.getPrototypeOf(Main.panel), 'vfunc_allocate', original => function (box) {
            const [, centerWidth] = this._centerBox.get_preferred_width(-1);
            // Leave other layouts and the lock/login shell entirely to GNOME.
            if (this !== Main.panel || centerWidth > 0 || Main.sessionMode.isLocked || Main.sessionMode.isGreeter)
                return original.call(this, box);
            this.set_allocation(box);
            const width = box.x2 - box.x1, height = box.y2 - box.y1;
            const [, left] = this._leftBox.get_preferred_width(-1);
            const [, right] = this._rightBox.get_preferred_width(-1);
            const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
            const ranges = panelRanges(width, left, right, 8 * scale,
                this.get_text_direction() === Clutter.TextDirection.RTL);
            for (const [actor, range] of [[this._leftBox, ranges.left], [this._rightBox, ranges.right]]) {
                const allocation = new Clutter.ActorBox();
                allocation.x1 = Math.floor(range[0]); allocation.x2 = Math.ceil(range[1]);
                allocation.y1 = 0; allocation.y2 = height;
                actor.allocate(allocation);
            }
            const center = new Clutter.ActorBox();
            center.x1 = center.x2 = Math.floor(width / 2);
            center.y1 = 0; center.y2 = height;
            this._centerBox.allocate(center);
        });
        Main.panel.queue_relayout();
    }
    disable() {
        this._injections?.clear();
        this._injections = null;
        Main.panel.queue_relayout();
    }
}
