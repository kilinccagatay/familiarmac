import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import St from 'gi://St';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';

export const FINDER = 'org.gnome.Nautilus.desktop';
export const APPS = 'org.familiarmac.Apps.desktop';
export function isFixedApp(id) { return id === FINDER || id === APPS; }
export function finderFirst(favorites) {return [FINDER,APPS,...favorites.filter(id=>!isFixedApp(id))];}
// Use real visible icon centers, not equal division of a box containing hidden
// separators, downloads and window thumbnails. The first two slots are reserved.
export function insertionSlot(centers, pointer, count) {
    const index = centers.findIndex(center => pointer < center);
    return Math.max(2, Math.min(count, index < 0 ? centers.length : index));
}
// Animate icon contents across native layout changes. The layout and hit boxes
// stay at their final positions, so animation cannot move the drop target itself.
export class DockGapMotion {
    constructor(active, animations) {
        this.active = active;
        this.animations = animations;
        this.items = new Map();
    }
    watch(children) {
        for (const actor of children) {
            const content = actor.child;
            if (!content?._delegate?.app || this.items.has(actor)) continue;
            const entry = {content, x:actor.x, base:content.translation_x, allocation:0, destroy:0};
            entry.allocation = actor.connect('notify::allocation', () => {
                const delta = entry.x - actor.x;
                entry.x = actor.x;
                if (!delta || !this.active()) return;
                content.remove_transition('translation-x');
                if (!this.animations()) { content.translation_x = entry.base; return; }
                content.translation_x += delta;
                content.ease({translation_x:entry.base, duration:160,
                    mode:Clutter.AnimationMode.EASE_OUT_QUAD});
            });
            entry.destroy = actor.connect('destroy', () => this.items.delete(actor));
            this.items.set(actor, entry);
        }
    }
    destroy() {
        for (const [actor, entry] of this.items) {
            actor.disconnect(entry.allocation); actor.disconnect(entry.destroy);
            entry.content.remove_transition('translation-x');
            entry.content.translation_x = entry.base;
        }
        this.items.clear();
    }
}
export class DockOrder {
    constructor() {
        this.settings=new Gio.Settings({schema_id:'org.gnome.shell'});
        this.icons=new Map();
        this.dashes=new Map();
        this.separators=new Map();
        this.signal=this.settings.connect('changed::favorite-apps',()=>this.normalize());
        this.normalize();
        this.removeMonitor = {dragMotion: () => {
            this.removeLabel?.hide();
            return DND.DragMotionResult.CONTINUE;
        }};
        DND.addDragMonitor(this.removeMonitor);
        this.oldDelegate = Main.uiGroup._delegate;
        const previous = this.oldDelegate;
        this.delegate = Object.create(previous ?? null);
        this.delegate.handleDragOver = (...args) => {
            if (!this.canUnpin(args[0])) return previous?.handleDragOver?.(...args) ?? DND.DragMotionResult.CONTINUE;
            this.showRemoveLabel();
            return DND.DragMotionResult.MOVE_DROP;
        };
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
    showRemoveLabel() {
        if (!this.removeLabel) {
            this.removeLabel = new St.Label({text:'Remove from Dock', style_class:'fm-dock-remove-label', reactive:false});
            Main.uiGroup.add_child(this.removeLabel);
            Shell.util_set_hidden_from_pick(this.removeLabel, true);
        }
        const [x,y] = global.get_pointer();
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this.removeLabel.set_position(x + 16 * scale,y + 20 * scale);
        this.removeLabel.show();
    }
    canUnpin(source) {
        if (this.stopped || !global.settings.is_writable('favorite-apps') || Main.overview.visible || !this.icons.has(source) || this.icons.get(source).trash) return false;
        const id = source.app?.get_id();
        if (!id || isFixedApp(id) || !this.settings.get_strv('favorite-apps').includes(id)) return false;
        const [,pointerY] = global.get_pointer();
        const iconY = this.icons.get(source).dragSize?.y ?? source.get_transformed_position()[1];
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        return pointerY < iconY - 64 * scale;
    }
    normalize() {
        const before=this.settings.get_strv('favorite-apps'),after=finderFirst(before);
        if (JSON.stringify(before)!==JSON.stringify(after)) this.settings.set_strv('favorite-apps',after);
    }
    trackDash(actor) {
        const dash = actor._delegate;
        if (!dash || dash._box !== actor || typeof dash.handleDragOver !== 'function') return;
        if (this.dashes.has(dash)) {this.dashes.get(dash).motion.watch(actor.get_children());return;}
        const original = dash.handleDragOver;
        const motion = new DockGapMotion(
            () => Boolean(dash._dragPlaceholder || dash._animatingPlaceholdersCount || [...this.icons.values()].some(item => item.dragSize)),
            () => St.Settings.get().enable_animations);
        motion.watch(actor.get_children());
        const owner = this;
        const originalDrop = dash.acceptDrop;
        const wrapped = function (source, dragActor, x, y, time) {
            const app = Dash.Dash.getAppFromSource(source);
            if (!app || !this._isHorizontal) return original.call(this, source, dragActor, x, y, time);
            if (isFixedApp(app.get_id()) || app.is_window_backed() || !global.settings.is_writable('favorite-apps'))
                return DND.DragMotionResult.NO_DROP;
            const children = this._box.get_children();
            motion.watch(children);
            const icons = children.filter(child => child.visible && child.child?._delegate?.app && child.child._delegate.app !== app);
            const [boxX] = this._box.get_transformed_position();
            const [boxWidth] = this._box.get_transformed_size();
            const ratio = this._box.width ? boxWidth / this._box.width : 1;
            const centers = icons.map(child => {
                const [left] = child.get_transformed_position();
                const [width] = child.get_transformed_size();
                return (left + width / 2 - boxX) / ratio;
            });
            const favorites = AppFavorites.getAppFavorites().getFavorites().filter(a => a.get_id() !== app.get_id());
            let pos = insertionSlot(centers, x, favorites.length);
            const placeholder = this._dragPlaceholder;
            if (placeholder && this._fmDrop?.id === app.get_id()) {
                const [left] = placeholder.get_transformed_position();
                const [width] = placeholder.get_transformed_size();
                const pointer = boxX + x * ratio;
                if (pointer >= left && pointer <= left + width) pos = this._fmDrop.pos;
            }
            if (!placeholder) {
                this._dragPlaceholder = new Dash.DashItemContainer();
                this._dragPlaceholder.setChild(new St.Bin({style_class:'fm-dock-drop-slot'}));
                this._box.add_child(this._dragPlaceholder);
            }
            const gap = this._dragPlaceholder;
            const sourceSize = owner.icons.get(source)?.dragSize;
            gap.child.set_size(sourceSize?.width || icons[0]?.width || this.iconSize,
                sourceSize?.height || this.iconSize);
            // Keep the hidden original actor alive for GNOME's drag lifetime;
            // calculate the real child index separately from the favorite index.
            const anchor = icons[pos];
            const siblings = this._box.get_children().filter(child => child !== gap);
            const index = anchor ? siblings.indexOf(anchor) : siblings.length;
            if (this._fmDrop?.pos !== pos || this._fmDrop?.id !== app.get_id() || !placeholder)
                this._box.set_child_at_index(gap, index);
            this._dragPlaceholderPos = index;
            this._fmDrop = {id:app.get_id(), pos};
            gap.show(false);
            return AppFavorites.getAppFavorites().isFavorite(app.get_id())
                ? DND.DragMotionResult.MOVE_DROP : DND.DragMotionResult.COPY_DROP;
        };
        const drop = function (source, ...args) {
            const target = this._fmDrop;
            if (!this._dragPlaceholder || target?.id !== source.app?.get_id())
                return originalDrop.call(this, source, ...args);
            if (isFixedApp(target.id) || !global.settings.is_writable('favorite-apps')) return false;
            this._fmDrop = null;
            global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
                if (owner.stopped) return false;
                const favorites = AppFavorites.getAppFavorites();
                const max = favorites.getFavorites().filter(a => a.get_id() !== target.id).length;
                const pos = Math.max(2, Math.min(target.pos, max));
                if (favorites.isFavorite(target.id)) favorites.moveFavoriteToPos(target.id, pos);
                else favorites.addFavoriteAtPos(target.id, pos);
                return false;
            });
            return true;
        };
        const signal = actor.connect('destroy', () => { motion.destroy(); this.dashes.delete(dash); });
        this.dashes.set(dash, {actor, original, wrapped, originalDrop, drop, signal, motion});
        dash.handleDragOver = wrapped;
        dash.acceptDrop = drop;
    }
    trackSeparator(actor) {
        this.trackDash(actor);
        if (!actor.has_style_class_name?.('dash-separator') || this.separators.has(actor)) return;
        const visible = actor.visible;
        const showOnSetParent = actor.show_on_set_parent;
        // Dash removes/reinserts this actor when favorites or running apps change.
        // Clutter may show it again on reparent; a transparent zero-width child
        // still adds an extra BoxLayout gap. Keep it out of layout throughout.
        actor.show_on_set_parent = false;
        const visibilitySignal = actor.connect('notify::visible', () => {
            if (actor.visible) actor.hide();
        });
        const signal = actor.connect('destroy', () => this.separators.delete(actor));
        this.separators.set(actor, {visible, signal, visibilitySignal, showOnSetParent});
        actor.hide();
    }
    track(icon) {
        if (this.icons.has(icon)) return;
        const info=icon.app?.appInfo ?? icon.app?.get_app_info?.();
        const trash=['trash://','trash:///'].includes(info?.location?.get_uri?.());
        const fixed = isFixedApp(icon.app?.get_id()) || trash;
        const draggable=icon._draggable;
        const original=draggable?.startDrag;
        const originalMaybe = draggable?._maybeStartDrag;
        const blocked=function () {this.fakeRelease?.(); return Clutter.EVENT_PROPAGATE;};
        if (fixed && draggable) {
            // _maybeStartDrag unconditionally updates the drag actor after
            // startDrag. Intercept before that path, not only startDrag itself.
            draggable._maybeStartDrag=blocked;
            draggable.startDrag=blocked;
        }
        const container=icon.get_parent();
        if (trash) container.add_style_class_name('familiarmac-trash-end');
        const saved = {draggable,original,originalMaybe,blocked,container,trash,dragSignals:[]};
        saved.restore = () => {
            this.removeLabel?.hide();
            if (!saved.dragSize) return;
            const {visible} = saved.dragSize;
            saved.dragSize = null;
            if (visible) container.show();
        };
        if (!fixed && draggable) {
            saved.start = function (...args) {
                original.apply(this, args);
                // startDrag creates the floating actor and records its source
                // geometry first. Only then remove the original from layout.
                if (this._dragActor && !saved.dragSize) {
                    saved.dragSize = {width:container.width,height:container.height,visible:container.visible,y:container.get_transformed_position()[1]};
                    container.hide();
                }
            };
            draggable.startDrag = saved.start;
            saved.dragSignals = ['drag-end', 'drag-cancelled'].map(name => draggable.connect(name, saved.restore));
        }
        saved.signal=icon.connect('destroy',()=>this.icons.delete(icon));
        this.icons.set(icon,saved);
    }
    destroy() {
        DND.removeDragMonitor(this.removeMonitor);
        this.removeLabel?.destroy();this.removeLabel=null;
        for (const [dash, saved] of this.dashes) {
            saved.motion.destroy();
            saved.actor.disconnect(saved.signal);
            if (dash.handleDragOver === saved.wrapped) dash.handleDragOver = saved.original;
            if (dash.acceptDrop === saved.drop) dash.acceptDrop = saved.originalDrop;
            dash._fmDrop = null;
        }
        this.dashes.clear();
        for (const [actor, {visible, signal, visibilitySignal, showOnSetParent}] of this.separators) {
            actor.disconnect(signal);
            actor.disconnect(visibilitySignal);
            actor.show_on_set_parent = showOnSetParent;
            if (visible) actor.show();
        }
        this.separators.clear();
        this.stopped = true;
        if (Main.uiGroup._delegate === this.delegate) Main.uiGroup._delegate = this.oldDelegate;
        this.settings.disconnect(this.signal);
        for (const [icon,saved] of this.icons) {
            icon.disconnect(saved.signal);
            for (const id of saved.dragSignals) saved.draggable.disconnect(id);
            saved.restore();
            if (saved.draggable?.startDrag === saved.start) saved.draggable.startDrag = saved.original;
            if (saved.draggable?.startDrag===saved.blocked) saved.draggable.startDrag=saved.original;
            if (saved.draggable?._maybeStartDrag===saved.blocked) saved.draggable._maybeStartDrag=saved.originalMaybe;
            if (saved.trash) saved.container.remove_style_class_name('familiarmac-trash-end');
        }
        this.icons.clear();
    }
}
