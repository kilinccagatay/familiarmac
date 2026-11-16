import {NativeTrashTarget} from './nativeTrashTarget.js';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

// Called only by the GTK source's NO_TARGET/ERROR drag-failed handler, not drag-leave
// (which also fires on cancellation). Mutter's Xdnd monitor does not provide
// the Wayland GTK drag lifecycle; do not require its enter/position signals.
export class TrashDrop {
    constructor() {
        this.icons = new Map();
        this.native = new NativeTrashTarget(() => this.targetBounds());
        this.bus = Gio.DBusExportedObject.wrapJSObject(
            '<node><interface name="org.familiarmac.TrashDrop"><method name="ConsumeDrop"><arg type="b" direction="out"/></method></interface></node>', this);
        this.bus.export(Gio.DBus.session, '/org/familiarmac/TrashDrop');
    }
    track(icon) {
        const app = icon.app;
        const info = app?.appInfo ?? app?.get_app_info?.();
        if (this.icons.has(icon) || !(app?.isTrash === true ||
            ['trash://', 'trash:///'].includes(info?.location?.get_uri?.()))) return;
        const indicators = [icon._dot, ...(icon._indicator?._indicators ?? []).map(i => i._area)].filter(Boolean);
        const opacity = indicators.map(actor => [actor, actor.opacity]);
        for (const actor of indicators) actor.opacity = 0;
        const signal = icon.connect('destroy', () => this.icons.delete(icon));
        this.icons.set(icon, {signal, opacity});
    }
    targetBounds() {
        const [x, y] = global.get_pointer();
        let nearest = null, distance = Infinity;
        for (const icon of this.icons.keys()) {
            if (!icon.mapped) continue;
            const [left, top] = icon.get_transformed_position();
            const [width, height] = icon.get_transformed_size();
            if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) continue;
            const d = Math.hypot(x - left - width / 2, y - top - height / 2);
            if (d < distance) {
                distance = d;
                nearest = [Math.round(left), Math.round(top), Math.round(width), Math.round(height)];
            }
        }
        return nearest;
    }
    ConsumeDrop() {
        const [x, y, modifiers] = global.get_pointer();
        if (modifiers & Clutter.ModifierType.BUTTON1_MASK) return false;
        // Hit-test the actual visible icon, not the drag-image actor that can
        // cover it. This includes monitor offsets and HiDPI transformations.
        for (const icon of this.icons.keys()) {
            if (!icon.mapped) continue;
            const [left, top] = icon.get_transformed_position();
            const [width, height] = icon.get_transformed_size();
            if (width > 0 && height > 0 && x >= left && x < left + width &&
                y >= top && y < top + height) return true;
        }
        return false;
    }
    destroy() {
        this.native.destroy();
        this.bus.unexport();
        for (const [icon, {signal, opacity}] of this.icons) {
            icon.disconnect(signal);
            for (const [actor, value] of opacity) actor.opacity = value;
        }
        this.icons.clear();
    }
}
