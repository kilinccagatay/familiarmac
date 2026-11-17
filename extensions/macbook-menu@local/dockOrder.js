import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import St from 'gi://St';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';

// Shared pointer bubble for Dock names and removal feedback.
export function dockBubble(text) {
    const bubble = new St.BoxLayout({vertical:true, reactive:false});
    const label = new St.Label({text, style_class:'fm-dock-remove-label', reactive:false});
            bubble.add_child(label);
            const tip = new St.DrawingArea({style_class:'fm-dock-remove-tip',
                x_align:Clutter.ActorAlign.CENTER, reactive:false});
            tip.connect('repaint', area => {
                const [width,height] = area.get_surface_size();
                const cr = area.get_context();
                cr.setSourceRGBA(30/255,30/255,32/255,0.94);
                cr.moveTo(0,0); cr.lineTo(width,0); cr.lineTo(width/2,height);
                cr.closePath(); cr.fill(); cr.$dispose();
            });
            bubble.add_child(tip);
    return {bubble, label};
}

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
            const app = content?._delegate?.app;
            const info = app?.appInfo ?? app?.get_app_info?.();
            const isTrash = ['trash://','trash:///'].includes(info?.location?.get_uri?.());
            if (!app || isTrash || actor.has_style_class_name?.('familiarmac-trash-end')
                || this.items.has(actor)) continue;
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
            this.showRemoveLabel(args[0]);
            return DND.DragMotionResult.MOVE_DROP;
        };
        this.delegate.acceptDrop = (...args) => {
            if (!this.canUnpin(args[0])) return previous?.acceptDrop?.(...args) ?? false;
            const id = args[0].app.get_id();
            global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
                if (!this.stopped) this.removeFavoriteWithSound(id);
                return false;
            });
            return true;
        };
        Main.uiGroup._delegate = this.delegate;
    }
    removeFavoriteWithSound(id) {
        if (!this.settings.get_strv('favorite-apps').includes(id)) return;
        AppFavorites.getAppFavorites().removeFavorite(id);
        if (this.settings.get_strv('favorite-apps').includes(id)) return;
        try {
            Gio.Subprocess.new(['canberra-gtk-play', '--id=trash-empty',
                '--description=Remove from Dock'], Gio.SubprocessFlags.NONE);
        } catch (_) { /* Missing audio support must not prevent unpinning. */ }
    }
    showRemoveLabel(source, text = 'Remove') {
        if (!this.removeLabel) {
            const parts = dockBubble(text);
            this.removeLabel = parts.bubble;
            this.removeText = parts.label;
            Main.uiGroup.add_child(this.removeLabel);
            Shell.util_set_hidden_from_pick(this.removeLabel, true);
        }
        this.removeText.text = text;
        const [x,y] = global.get_pointer();
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const dragActor = this.icons.get(source)?.draggable?._dragActor;
        const [left,top] = dragActor?.get_transformed_position?.() ?? [x,y];
        const [iconWidth] = dragActor?.get_transformed_size?.() ?? [0];
        const [,width] = this.removeLabel.get_preferred_width(-1);
        const [,height] = this.removeLabel.get_preferred_height(width);
        this.removeLabel.set_position(Math.round(left + iconWidth/2 - width/2),
            Math.round(top - height - 6*scale));
        this.removeLabel.show();
    }
    canUnpin(source, requireDistance = true) {
        if (this.stopped || !global.settings.is_writable('favorite-apps') || Main.overview.visible || !this.icons.has(source) || this.icons.get(source).trash) return false;
        const id = source.app?.get_id();
        if (!id || isFixedApp(id) || !this.settings.get_strv('favorite-apps').includes(id)) return false;
        if (!requireDistance) return true;
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
        const originalClear = dash._clearDragPlaceholder;
        const clear = function (...args) {
            if (!this._dragPlaceholder?._fmDockGap)
                return originalClear?.apply(this, args);
            // Native animated removal leaves a shrinking layout actor behind.
            // Rapid exits/reentries can accumulate several gaps and push the
            // fixed right section beyond the Dock's clipping rectangle.
            const gap = this._dragPlaceholder;
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
            this._fmDrop = null;
            gap.destroy();
        };
        const wrapped = function (source, dragActor, x, y, time) {
            const app = Dash.Dash.getAppFromSource(source);
            if (!app || !this._isHorizontal) return original.call(this, source, dragActor, x, y, time);
            if (isFixedApp(app.get_id()) || app.is_window_backed() || !global.settings.is_writable('favorite-apps'))
                return DND.DragMotionResult.NO_DROP;
            const children = this._box.get_children();
            motion.watch(children);
            const boundary = children.find(child => child.has_style_class_name?.('familiarmac-downloads-start')
                || child.has_style_class_name?.('familiarmac-trash-end'));
            const appChildren = boundary ? children.slice(0, children.indexOf(boundary)) : children;
            const icons = appChildren.filter(child => child.visible && child.child?._delegate?.app && child.child._delegate.app !== app);
            const [boxX] = this._box.get_transformed_position();
            const [boxWidth] = this._box.get_transformed_size();
            const ratio = this._box.width ? boxWidth / this._box.width : 1;
            if (boundary && boxX + x * ratio >= boundary.get_transformed_position()[0]) {
                this._fmDrop = null;
                this._fmRejectedDrop = true;
                this._clearDragPlaceholder?.();
                return DND.DragMotionResult.NO_DROP;
            }
            this._fmRejectedDrop = false;
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
                this._dragPlaceholder._fmDockGap = true;
                this._dragPlaceholder.setChild(new St.Bin({style_class:'fm-dock-drop-slot'}));
                this._box.add_child(this._dragPlaceholder);
            }
            const gap = this._dragPlaceholder;
            const sourceSize = owner.icons.get(source)?.dragSize;
            gap.child.set_size(sourceSize?.width || icons[0]?.width || this.iconSize,
                sourceSize?.height || this.iconSize);
            // Keep the hidden original actor alive for GNOME's drag lifetime;
            // calculate the real child index separately from the favorite index.
            const anchor = icons[pos] ?? boundary;
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
            const savedSource = owner.icons.get(source);
            const boundary = this._box.get_children().find(child =>
                child.has_style_class_name?.('familiarmac-downloads-start')
                || child.has_style_class_name?.('familiarmac-trash-end'));
            const [boxX] = this._box.get_transformed_position();
            const [boxWidth] = this._box.get_transformed_size();
            const ratio = this._box.width ? boxWidth / this._box.width : 1;
            if (this._fmRejectedDrop || (boundary && Number.isFinite(args[1])
                && boxX + args[1] * ratio >= boundary.get_transformed_position()[0])) {
                savedSource?.restore?.();
                return false;
            }
            const target = this._fmDrop;
            if (!this._dragPlaceholder || target?.id !== source.app?.get_id()) {
                savedSource?.restore?.();
                return originalDrop.call(this, source, ...args);
            }
            if (isFixedApp(target.id) || !global.settings.is_writable('favorite-apps')) {
                savedSource?.restore?.();
                return false;
            }
            // Replace the destination gap with the same source actor before
            // restoring visibility. Showing it at its old index first makes
            // neighbors jump back, then Dash removes/recreates it on redisplay.
            const gap = this._dragPlaceholder;
            const children = this._box.get_children();
            const container = savedSource?.container;
            if (container && children.includes(container)) {
                let index = children.indexOf(gap);
                if (children.indexOf(container) < index) index--;
                this._dragPlaceholder = null;
                this._dragPlaceholderPos = -1;
                gap.destroy();
                this._box.set_child_at_index(container, index);
                savedSource.restore();
            } else {
                savedSource?.restore?.();
            }
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
        this.dashes.set(dash, {actor, original, wrapped, originalDrop, drop, originalClear, clear, signal, motion});
        dash.handleDragOver = wrapped;
        dash.acceptDrop = drop;
        dash._clearDragPlaceholder = clear;
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
            // DashItemContainer overrides show() to animate scale/opacity only;
            // it does not undo Clutter.Actor.hide(). Restore the property itself.
            if (visible) container.visible = true;
        };
        if (!fixed && draggable) {
            const owner = this;
            saved.start = function (...args) {
                original.apply(this, args);
                // startDrag creates the floating actor and records its source
                // geometry first. Only then remove the original from layout.
                if (this._dragActor && !saved.dragSize) {
                    const [left,top] = container.get_transformed_position();
                    const [width] = container.get_transformed_size?.() ?? [container.width];
                    saved.dragSize = {width:container.width,height:container.height,visible:container.visible,y:top};
                    container.hide();
                    // Replace the source slot in this same event, before layout
                    // can shrink/recenter the Dock. Waiting for dragMotion lets
                    // it shrink once and expand again under a nearly still pointer.
                    for (const [dash] of owner.dashes) {
                        if (!dash._isHorizontal || !dash._box.get_children().includes(container)) continue;
                        const [boxX] = dash._box.get_transformed_position();
                        const [boxWidth] = dash._box.get_transformed_size();
                        const ratio = dash._box.width ? boxWidth / dash._box.width : 1;
                        dash.handleDragOver(icon, this._dragActor,
                            (left + width/2 - boxX)/ratio, 0, 0);
                        break;
                    }
                }
            };
            draggable.startDrag = saved.start;
            saved.dragSignals = ['drag-end', 'drag-cancelled'].map(name => draggable.connect(name, saved.restore));
        }
        if (trash) {
            saved.dragOver = icon.handleDragOver;
            saved.acceptDrop = icon.acceptDrop;
            saved.trashOver = (source, ...args) => {
                if (!this.icons.has(source)) return saved.dragOver?.call(icon, source, ...args)
                    ?? DND.DragMotionResult.CONTINUE;
                if (!this.canUnpin(source, false)) return DND.DragMotionResult.NO_DROP;
                this.showRemoveLabel(source, 'Remove from Dock');
                return DND.DragMotionResult.MOVE_DROP;
            };
            saved.trashDrop = (source, ...args) => {
                if (!this.icons.has(source)) return saved.acceptDrop?.call(icon, source, ...args) ?? false;
                if (!this.canUnpin(source, false)) return false;
                const id = source.app.get_id();
                this.icons.get(source).restore();
                global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
                    if (!this.stopped) this.removeFavoriteWithSound(id);
                    return false;
                });
                return true;
            };
            icon.handleDragOver = saved.trashOver;
            icon.acceptDrop = saved.trashDrop;
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
            if (dash._clearDragPlaceholder === saved.clear) {
                saved.clear.call(dash);
                dash._clearDragPlaceholder = saved.originalClear;
            }
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
            if (saved.draggable && saved.draggable.startDrag === saved.start) saved.draggable.startDrag = saved.original;
            if (saved.draggable?.startDrag===saved.blocked) saved.draggable.startDrag=saved.original;
            if (saved.draggable?._maybeStartDrag===saved.blocked) saved.draggable._maybeStartDrag=saved.originalMaybe;
            if (saved.trash) {
                if (icon.handleDragOver === saved.trashOver) icon.handleDragOver = saved.dragOver;
                if (icon.acceptDrop === saved.trashDrop) icon.acceptDrop = saved.acceptDrop;
                saved.container.remove_style_class_name('familiarmac-trash-end');
            }
        }
        this.icons.clear();
    }
}
