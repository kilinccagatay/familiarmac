import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

// The desktop GTK drag source confirms an actual NO_TARGET release; never trash
// from drag-leave alone (Escape and crossing a window also emit drag-leave).
export class TrashDrop {
    constructor() {
        this.dnd = global.backend.get_dnd();
        this.signals = [
            this.dnd.connect('dnd-enter', () => { this.active = true; this.target = false; }),
            this.dnd.connect('dnd-position-change', (_d, x, y) => { this.target = this.isTrash(x, y); }),
            this.dnd.connect('dnd-leave', () => { this.active = false; this.ended = GLib.get_monotonic_time(); }),
        ];
        this.bus = Gio.DBusExportedObject.wrapJSObject(
            '<node><interface name="org.familiarmac.TrashDrop"><method name="ConsumeDrop"><arg type="b" direction="out"/></method></interface></node>', this);
        this.bus.export(Gio.DBus.session, '/org/familiarmac/TrashDrop');
    }
    isTrash(x, y) {
        let actor = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);
        while (actor) {
            const app = actor.app ?? actor._delegate?.app;
            const uri = (app?.appInfo ?? app?.get_app_info?.())?.location?.get_uri?.();
            if (uri === 'trash://' || uri === 'trash:///') return true;
            actor = actor.get_parent();
        }
        return false;
    }
    ConsumeDrop() {
        const [x, y] = global.get_pointer();
        const valid = !!this.target && this.isTrash(x, y) && (this.active ||
            GLib.get_monotonic_time() - (this.ended ?? 0) < 750000);
        this.target = false;
        return valid;
    }
    destroy() {
        this.bus.unexport();
        for (const id of this.signals) this.dnd.disconnect(id);
    }
}
