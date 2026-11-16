import Gio from 'gi://Gio';

// Called only by the GTK source's NO_TARGET drag-failed handler, not drag-leave
// (which also fires on cancellation). Mutter's Xdnd monitor does not provide
// the Wayland GTK drag lifecycle; do not require its enter/position signals.
export class TrashDrop {
    constructor() {
        this.icons = new Map();
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
    ConsumeDrop() {
        const [x, y] = global.get_pointer();
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
        this.bus.unexport();
        for (const [icon, {signal, opacity}] of this.icons) {
            icon.disconnect(signal);
            for (const [actor, value] of opacity) actor.opacity = value;
        }
        this.icons.clear();
    }
}
