import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';

export const FINDER = 'org.gnome.Nautilus.desktop';
export function finderFirst(favorites) {return [FINDER,...favorites.filter(id=>id!==FINDER)];}
export class DockOrder {
    constructor() {
        this.settings=new Gio.Settings({schema_id:'org.gnome.shell'});
        this.icons=new Map();
        this.separators=new Map();
        this.signal=this.settings.connect('changed::favorite-apps',()=>this.normalize());
        this.normalize();
        this.oldDelegate = Main.uiGroup._delegate;
        const previous = this.oldDelegate;
        this.delegate = Object.create(previous ?? null);
        this.delegate.handleDragOver = (...args) => this.canUnpin(args[0])
            ? DND.DragMotionResult.MOVE_DROP
            : previous?.handleDragOver?.(...args) ?? DND.DragMotionResult.CONTINUE;
        this.delegate.acceptDrop = (...args) => {
            if (!this.canUnpin(args[0])) return previous?.acceptDrop?.(...args) ?? false;
            const id = args[0].app.get_id();
            global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
                if (!this.stopped) AppFavorites.getAppFavorites().removeFavorite(id);
                return false;
            });
            return true;
        };
        Main.uiGroup._delegate = this.delegate;
    }
    canUnpin(source) {
        if (this.stopped || Main.overview.visible || !this.icons.has(source) || this.icons.get(source).trash) return false;
        const id = source.app?.get_id();
        if (!id || id === FINDER || !this.settings.get_strv('favorite-apps').includes(id)) return false;
        const [,pointerY] = global.get_pointer();
        const [,iconY] = source.get_transformed_position();
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        return pointerY < iconY - 48 * scale;
    }
    normalize() {
        const before=this.settings.get_strv('favorite-apps'),after=finderFirst(before);
        if (JSON.stringify(before)!==JSON.stringify(after)) this.settings.set_strv('favorite-apps',after);
    }
    trackSeparator(actor) {
        if (!actor.has_style_class_name?.('dash-separator') || this.separators.has(actor)) return;
        const visible = actor.visible;
        const signal = actor.connect('destroy', () => this.separators.delete(actor));
        this.separators.set(actor, {visible, signal});
        actor.hide(); // Zero width alone still leaves the box's inter-child spacing.
    }
    track(icon) {
        if (this.icons.has(icon)) return;
        const info=icon.app?.appInfo ?? icon.app?.get_app_info?.();
        const trash=['trash://','trash:///'].includes(info?.location?.get_uri?.());
        const fixed = icon.app?.get_id()===FINDER || trash;
        const draggable=icon._draggable;
        const original=draggable?.startDrag;
        const blocked=function () {this.fakeRelease?.();};
        if (fixed && draggable) draggable.startDrag=blocked;
        const container=icon.get_parent();
        if (trash) container.add_style_class_name('familiarmac-trash-end');
        const signal=icon.connect('destroy',()=>this.icons.delete(icon));
        this.icons.set(icon,{draggable,original,blocked,signal,container,trash});
    }
    destroy() {
        for (const [actor, {visible, signal}] of this.separators) {
            actor.disconnect(signal);
            if (visible) actor.show();
        }
        this.separators.clear();
        this.stopped = true;
        if (Main.uiGroup._delegate === this.delegate) Main.uiGroup._delegate = this.oldDelegate;
        this.settings.disconnect(this.signal);
        for (const [icon,saved] of this.icons) {
            icon.disconnect(saved.signal);
            if (saved.draggable?.startDrag===saved.blocked) saved.draggable.startDrag=saved.original;
            if (saved.trash) saved.container.remove_style_class_name('familiarmac-trash-end');
        }
        this.icons.clear();
    }
}
