import St from 'gi://St';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {dockBubble} from './dockOrder.js';

export class DockTooltips {
    constructor() { this.items = new Map(); this.dashes = new Map(); }
    trackDash(icon) {
        for (let actor = icon.get_parent(); actor; actor = actor.get_parent()) {
            const dash = typeof actor._syncLabel === 'function' ? actor : actor._delegate;
            if (typeof dash?._syncLabel !== 'function') continue;
            if (this.dashes.has(dash)) return;
            const original = dash._syncLabel;
            const cancelTimers = () => {
                for (const key of ['_showLabelTimeoutId', '_resetHoverTimeoutId']) {
                    if (dash[key]) GLib.source_remove(dash[key]);
                    dash[key] = 0;
                }
            };
            const sync = (item, appIcon) => {
                cancelTimers();
                const show = appIcon ? appIcon.shouldShowTooltip() : item.child.get_hover();
                dash._labelShowing = Boolean(show);
                if (show) item.showLabel();
                else item.hideLabel();
            };
            cancelTimers();
            dash._syncLabel = sync;
            const signal = actor.connect('destroy', () => this.dashes.delete(dash));
            this.dashes.set(dash, {actor, signal, original, sync, cancelTimers});
            return;
        }
    }
    track(icon) {
        this.trackDash(icon);
        const item = icon.get_parent();
        if (!item?.showLabel || this.items.has(item)) return;
        const {bubble, label} = dockBubble('');
        Main.layoutManager.addChrome(bubble);
        Shell.util_set_hidden_from_pick(bubble, true);
        bubble.hide();
        const originalShow = item.showLabel, originalHide = item.hideLabel;
        const show = () => {
            if (!item._labelText || !item.mapped || icon._draggable?._dragActor) return;
            item.label?.hide();
            label.text = item._labelText;
            const anchor = icon.icon?.icon ?? icon;
            const [ax,ay] = anchor.get_transformed_position();
            const [aw] = anchor.get_transformed_size();
            const [x,y,w] = icon._fmMagnifiedBounds ?? [ax,ay,aw];
            const [,width] = bubble.get_preferred_width(-1);
            const [,height] = bubble.get_preferred_height(width);
            const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
            bubble.set_position(Math.round(x+w/2-width/2), Math.round(y-height-3*scale));
            bubble.get_parent()?.set_child_above_sibling(bubble, null);
            bubble.show();
        };
        const refresh = () => { if (bubble.visible) show(); };
        icon._fmTooltipRefresh = refresh;
        const hide = () => { bubble.hide(); originalHide.call(item); };
        const signal = item.connect('destroy', () => { delete icon._fmTooltipRefresh; bubble.destroy(); this.items.delete(item); });
        item.showLabel = show; item.hideLabel = hide;
        this.items.set(item, {icon, bubble, originalShow, originalHide, show, hide, signal});
    }
    destroy() {
        for (const [dash, saved] of this.dashes) {
            saved.actor.disconnect(saved.signal);
            saved.cancelTimers();
            if (dash._syncLabel === saved.sync) dash._syncLabel = saved.original;
            dash._labelShowing = false;
        }
        this.dashes.clear();
        for (const [item,s] of this.items) {
            item.disconnect(s.signal);
            delete s.icon._fmTooltipRefresh;
            if (item.showLabel === s.show) item.showLabel = s.originalShow;
            if (item.hideLabel === s.hide) item.hideLabel = s.originalHide;
            s.bubble.destroy();
        }
        this.items.clear();
    }
}
