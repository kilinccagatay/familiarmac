import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// GNOME 46 can reload a texture before its cached icon size has caught up
// with the new theme scale. File icons also survive icon-theme invalidation.
// Recompute size using St's own logical-size API, without changing preferences,
// replacing actors, or multiplying sizes ourselves (including mixed DPI).
export function refreshIcons(root) {
    let count = 0;
    const visit = actor => {
        // Application surfaces are not Shell widgets and belong to their clients.
        if (actor === global.window_group) return;
        if (actor instanceof St.Icon) {
            actor.ensure_style();
            const size = actor.icon_size;
            actor.freeze_notify();
            try {
                actor.icon_size = size > 0 ? size + 1 : 1;
                actor.icon_size = size;
            } finally {
                actor.thaw_notify();
            }
            count++;
        }
        for (const child of actor.get_children()) visit(child);
    };
    visit(root);
    return count;
}

export default class DisplayScale extends Extension {
    enable() {
        this._timer = 0;
        this._later = 0;
        this._laters = global.compositor.get_laters();
        const context = St.ThemeContext.get_for_stage(global.stage);
        this._signals = [
            [Main.layoutManager, Main.layoutManager.connect('monitors-changed', () => this._queue())],
            [context, context.connect('notify::scale-factor', () => this._queue())],
        ];
        this._queue();
    }
    _queue() {
        if (this._timer) GLib.Source.remove(this._timer);
        if (this._later) this._laters.remove(this._later);
        this._later = 0;
        // Coalesce a mode switch's monitor/theme notifications; paint only once
        // allocations and the final scale agree, never during a layout callback.
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            this._timer = 0;
            this._later = this._laters.add(Meta.LaterType.BEFORE_REDRAW, () => {
                this._later = 0;
                refreshIcons(Main.uiGroup);
                return GLib.SOURCE_REMOVE;
            });
            return GLib.SOURCE_REMOVE;
        });
    }
    disable() {
        if (this._timer) GLib.Source.remove(this._timer);
        if (this._later) this._laters.remove(this._later);
        this._timer = this._later = 0;
        for (const [object, id] of this._signals ?? []) object.disconnect(id);
        this._signals = [];
    }
}
