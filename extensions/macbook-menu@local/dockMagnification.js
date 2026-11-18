import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export function magnificationScale(distance, width, maximum) {
    const t = Math.min(1, Math.abs(distance) / (width * 1.6));
    return 1 + (maximum - 1) * (1 + Math.cos(Math.PI * t)) / 2;
}
// Render from the themed source at peak resolution; never stretch the Dock texture.
export class DockMagnification {
    constructor() {
        this.items = new Map(); this.timeline = null; this.backgrounds = new Set(); this.clips = new Map(); this.lastFrame = 0;
        const dir = GLib.build_filenamev([GLib.get_user_data_dir(), 'gnome-shell', 'extensions', 'familiarmac-genie@local', 'schemas']);
        const source = Gio.SettingsSchemaSource.new_from_directory(dir, Gio.SettingsSchemaSource.get_default(), false);
        this.settings = new Gio.Settings({settings_schema:source.lookup('org.gnome.shell.extensions.familiarmac-genie', true)});
        this.signal = this.settings.connect('changed::dock-magnification', () => this.sync());
        this.sync();
    }
    sync() {
        this.timeline?.stop();
        this.timeline = null;
        this.resetBackgrounds();
        this.restoreClips();
        this.lastFrame = 0;
        for (const [icon,item] of this.items) this.reset(icon,item);
        if (this.settings.get_boolean('dock-magnification')) {
            this.timeline = new Clutter.Timeline({actor: global.stage, duration: 1000, repeat_count: -1});
            this.timeline.connect('new-frame', () => this.update());
            this.timeline.start();
        }
    }
    track(icon) {
        if (this.items.has(icon)) return;
        const item = {clone:null, scale:1, shift:0};
        item.signal = icon.connect('destroy', () => { item.clone?.destroy(); this.items.delete(icon); });
        this.items.set(icon,item);
    }
    moveDivider(icon, item, shift) {
        const divider = icon.get_parent?.()?.get_children?.().find(
            child => child.has_style_class_name?.('familiarmac-dock-divider'));
        if (!divider) return;
        // The separator follows the left edge of this icon's expanded slot,
        // not its centre (which includes half the icon's added width).
        divider.translation_x += shift - (item.dividerShift ?? 0);
        item.dividerShift = shift;
    }
    reset(icon,item) {
        this.moveDivider(icon, item, 0);
        item.clone?.destroy();item.clone=null;
        if(item.texture){item.texture.opacity=item.opacity;item.texture=null;}
        if(item.shift)icon.translation_x-=item.shift;
        item.shift=0;item.scale=1;
        delete icon._fmMagnifiedBounds;
        icon._fmTooltipRefresh?.();
    }
    expandClip(dock, extra) {
        // DashSlideContainer clips this child on every allocation. Keep its
        // vertical clip (auto-hide), expanding only the horizontal wave bounds.
        let actor = dock;
        while (actor && actor.name !== 'dashtodockBox') actor = actor.get_parent?.();
        // GJS exposes has-clip as a boolean property, not a callable method.
        if (!actor?.has_clip) return;
        let record = this.clips.get(actor);
        if (!record) {
            record = {original: actor.set_clip, base: actor.get_clip(), extra: 0};
            record.wrapper = (x, y, width, height) => {
                record.base = [x, y, width, height];
                record.original.call(actor, x - record.extra, y, width + 2 * record.extra, height);
            };
            record.signal = actor.connect('destroy', () => this.clips.delete(actor));
            actor.set_clip = record.wrapper;
            this.clips.set(actor, record);
        }
        record.extra = extra / 2;
        record.wrapper(...record.base);
    }
    restoreClips() {
        for (const [actor, record] of this.clips) {
            actor.disconnect(record.signal);
            if (actor.set_clip === record.wrapper) actor.set_clip = record.original;
            record.original.call(actor, ...record.base);
        }
        this.clips.clear();
    }
    resetBackgrounds() {
        for (const bg of this.backgrounds ?? []) {
            bg.set_scale(1, 1);
            bg.set_pivot_point(0, 0);
        }
        this.backgrounds?.clear();
        for (const record of this.clips?.values() ?? []) {
            record.extra = 0;
            record.wrapper(...record.base);
        }
    }
    dockFor(icon) {
        for (let actor = icon; actor; actor = actor.get_parent?.()) {
            if (actor._background && actor._box) return actor;
        }
        return null;
    }
    dockReveal(dock) {
        for (let actor = dock; actor; actor = actor.get_parent?.()) {
            if (!actor._slider) continue;
            const slide = actor._slider.slide_x ?? actor._slider.slideX;
            // SHOWING=1, SHOWN=2. Hidden/hiding must never create overlays.
            const allowed = (actor.dockState === 1 || actor.dockState === 2)
                && typeof slide === 'number' && slide > 0;
            const monitor = actor._monitor;
            return {allowed, slide: allowed ? Math.min(1, slide) : 0,
                bottom: monitor ? monitor.y + monitor.height : null};
        }
        return {allowed:false, slide:0};
    }
    update() {
        const now = GLib.get_monotonic_time();
        const dt = this.lastFrame ? Math.min(50, (now - this.lastFrame) / 1000) : 16;
        this.lastFrame = now;
        const blend = 1 - Math.exp(-dt / 48);
        const [px,py,mods] = global.get_pointer();
        const icons = [...this.items.keys()];
        const dragging = icons.some(icon => icon._draggable?._dragActor);
        const menuOwner = icons.find(icon => icon._menu?.isOpen || icon._fmDockMenuOpen?.());
        // A Dock popup owns a modal grab. Preserve the whole wave, divider and
        // background while browsing it; pointer movement in the menu is not a
        // new Dock hover. Resume from this exact geometry after it closes.
        if (menuOwner && menuOwner.mapped && !Main.overview.visible && !dragging
            && this.dockReveal(this.dockFor(menuOwner)).allowed) {
            for (const icon of icons) icon.get_parent?.()?.hideLabel?.();
            return;
        }
        this.resetBackgrounds();
        const blocked = Main.overview.visible || Main.modalCount > 0
            || (mods & Clutter.ModifierType.BUTTON1_MASK) || dragging;
        const maximum = this.settings.get_double('dock-magnification-scale');
        const rows=[];
        for(const [icon,item] of this.items){
            const texture=icon.icon?.icon ?? icon.child;
            const dock = this.dockFor(icon);
            const reveal = this.dockReveal(dock);
            if(!texture || !icon.mapped || icon._fmLaunchAnimating || blocked || !reveal.allowed){
                this.reset(icon,item);
                if (!reveal.allowed) icon.get_parent?.()?.hideLabel?.();
                continue;
            }
            const [tx,y]=texture.get_transformed_position(),[w,h]=texture.get_transformed_size();
            if(!w || !h){this.reset(icon,item);continue;}
            const x=tx-item.shift;
            // Hit-test the final icon row during reveal, but render at its actual
            // sliding position. Thus it enters magnified without hidden ghosts.
            const targetY = y - (1 - reveal.slide) * (dock?.height ?? h);
            rows.push({icon,item,texture,x,y,w,h,dock,targetY,bottom:reveal.bottom});
        }
        rows.sort((a,b)=>a.x-b.x);
        // Each monitor/Dock is an independent wave, based on unshifted geometry.
        const groups=[];
        for(const row of rows){
            let group=groups.find(g=>g[0].dock===row.dock);
            if(!group){group=[];groups.push(group);}group.push(row);
        }
        for(const group of groups){
            // One stationary vertical lane per Dock, anchored to its monitor.
            // Individual textures move vertically while revealing/magnifying;
            // using their rectangles as hit targets makes the wave flicker.
            const height = Math.max(...group.map(r => r.h));
            const bottom = group[0].bottom ?? Math.max(...group.map(r => r.targetY + r.h + 12));
            const laneHeight = Math.max(group[0].dock?.height ?? 0, height + 24);
            const top = bottom - laneHeight - height * (maximum - 1) - 12;
            const inLane = py >= top && py < bottom;
            let total=0;
            for(const r of group){
                const target=inLane
                    ?magnificationScale(px-r.x-r.w/2,r.w,maximum):1;
                r.item.scale+=(target-r.item.scale)*blend;
                if(target===1&&r.item.scale<1.005)r.item.scale=1;
                r.extra=r.w*(r.item.scale-1);total+=r.extra;
            }
            const background = group[0].dock?._background;
            if (background && background.width > 0 && total > 0.1) {
                background.set_pivot_point(0.5, 1);
                background.set_scale(1 + total / background.width, 1);
                this.backgrounds.add(background);
                this.expandClip(group[0].dock, total);
            }
            let offset=-total/2;
            for(const r of group){
                const {icon,item,texture,x,y,w,h}=r;
                const dividerShift = offset;
                const shift=offset+r.extra/2;offset+=r.extra;
                if(item.scale===1&&Math.abs(shift)<0.1){this.reset(icon,item);continue;}
                const renderFactor = maximum * 2;
                const logicalSize=Math.ceil(Math.max(w,h)*renderFactor/St.ThemeContext.get_for_stage(global.stage).scale_factor);
                if(!item.clone||item.resolution!==logicalSize){
                    item.clone?.destroy();
                    // Re-render the actual themed icon, never upscale a small framebuffer.
                    item.clone=texture.gicon ? new St.Icon({gicon:texture.gicon,icon_size:logicalSize,reactive:false})
                        :texture.icon_name ? new St.Icon({icon_name:texture.icon_name,icon_size:logicalSize,reactive:false})
                        :icon.app?.create_icon_texture(logicalSize);
                    if(!item.clone){this.reset(icon,item);continue;}
                    item.resolution=logicalSize;
                    Main.layoutManager.addChrome(item.clone);
                    Shell.util_set_hidden_from_pick(item.clone,true);
                    if(!item.texture){item.texture=texture;item.opacity=texture.opacity;}
                    texture.opacity=0;
                }
                icon.translation_x+=shift-item.shift;item.shift=shift;
                this.moveDivider(icon, item, dividerShift);
                item.clone.set_size(w*renderFactor,h*renderFactor);
                item.clone.set_scale(item.scale/renderFactor,item.scale/renderFactor);
                const bounds=[x+shift-w*(item.scale-1)/2,y-h*(item.scale-1),w*item.scale,h*item.scale];
                item.clone.set_position(bounds[0],bounds[1]);
                icon._fmMagnifiedBounds=bounds;

            }
        }
        // Raise labels only after every overlay has been created/stacked.
        for (const icon of this.items.keys()) icon._fmTooltipRefresh?.();
    }
    destroy() {
        this.timeline?.stop();
        this.resetBackgrounds();
        this.restoreClips();
        this.settings.disconnect(this.signal);
        for(const [icon,item] of this.items){icon.disconnect(item.signal);this.reset(icon,item);}
        this.items.clear();
    }
}
