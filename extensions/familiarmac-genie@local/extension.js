import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {point, bounds, motionAllowed} from './geometry.js';

const Mesh=GObject.registerClass(class Mesh extends Clutter.DeformEffect {
    _init(source,target) {super._init();this.source=source;this.target=target;this.progress=0;this.set_n_tiles(1,32);}
    vfunc_deform_vertex(w,h,v) {
        if (!(w>0&&h>0)) return;
        const [x,y]=point(v.tx,v.ty,this.progress,this.source,this.target);
        if (Number.isFinite(x)&&Number.isFinite(y)) {v.x=x*w/this.source.width;v.y=y*h/this.source.height;}
    }
    vfunc_modify_paint_volume() {return false;}
});

export default class Genie extends Extension {
    enable() {
        if(Main.extensionManager.lookup('compiz-alike-magic-lamp-effect@hermes83.github.com')?.state===1)
            throw new Error('Disable the old Magic Lamp before enabling Genie');
        this.jobs=new Map();this.previews=new Map();this.signals=[];this.stopped=false;
        this.settings=this.getSettings();
        this.desktopSettings=new Gio.Settings({schema_id:'org.gnome.desktop.interface'});
        this.motionChanged=()=>{if(!this.motionEnabled())this.finishAll();};
        this.settingsSignal=this.settings.connect('changed::animate',this.motionChanged);
        this.desktopSettingsSignal=this.desktopSettings.connect('changed::enable-animations',this.motionChanged);
        const owner=this,wm=Main.wm;
        this.originalShould=wm._shouldAnimateActor;
        this.should=function(actor,types) {
            if(!owner.originalShould.call(this,actor,types))return false;
            const stack=new Error().stack??'';
            const kind=stack.includes('_unminimizeWindow@')?'unminimize':stack.includes('_minimizeWindow@')?'minimize':stack.includes('_destroyWindow@')?'destroy':null;
            if(kind&&owner.prepare(actor,kind))return false;
            return true;
        };
        wm._shouldAnimateActor=this.should;
        this.originalComplete={};this.completeWrappers={};
        for(const kind of ['minimize','unminimize','destroy']) {
            const method=`completed_${kind}`;
            this.originalComplete[kind]=wm._shellwm[method];
            this.completeWrappers[kind]=function(actor) {
                if(owner.jobs.get(actor)?.kind===kind)return;
                return owner.originalComplete[kind].call(this,actor);
            };
            wm._shellwm[method]=this.completeWrappers[kind];
            this.signals.push(global.window_manager.connect(kind,(_wm,actor)=>{
                const job=this.jobs.get(actor);if(job?.kind===kind)this.start(job);
            }));
        }
        this.monitorSignal=Main.layoutManager.connect('monitors-changed',()=>this.finishAll());
        this.sessionSignal=Main.sessionMode.connect('updated',()=>{if(Main.sessionMode.isLocked)this.finishAll();});
        console.log('FamiliarMac Genie enabled');
    }
    motionEnabled() {return motionAllowed(this.settings.get_boolean('animate'),this.desktopSettings.get_boolean('enable-animations'));}
    dockRow() {
        const visit=(actor)=>{
            if(actor.has_style_class_name?.('familiarmac-downloads-start'))return actor.get_child();
            for(const child of actor.get_children()) {const found=visit(child);if(found)return found;}
            return null;
        };
        return visit(Main.uiGroup);
    }
    removePreview(win) {
        const entry=this.previews.get(win);if(!entry)return;
        this.previews.delete(win);
        if(entry.unmanaged)win.disconnect(entry.unmanaged);
        if(entry.referenceSignal)entry.reference.disconnect(entry.referenceSignal);
        if(entry.referenceDestroy)entry.reference.disconnect(entry.referenceDestroy);
        if(entry.titleSignal)win.disconnect(entry.titleSignal);
        if(entry.menu)entry.manager?.removeMenu(entry.menu);
        entry.menu?.destroy();
        if(entry.widget)entry.widget.destroy();
        entry.content=null;
    }
    preview(win,content) {
        this.removePreview(win);
        const row=this.dockRow();if(!row)return null;
        const referenceButton=row.get_children()[1];
        const reference=referenceButton?.get_child();
        const scale=St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const image=new St.Widget({content,y_align:Clutter.ActorAlign.CENTER,x_align:Clutter.ActorAlign.CENTER});
        const tile=new St.Widget({layout_manager:new Clutter.BinLayout()});
        tile.add_child(image);
        const app=Shell.WindowTracker.get_default().get_window_app(win);
        const badge=app?.create_icon_texture(12);
        if(badge) {
            badge.x_align=Clutter.ActorAlign.END;badge.y_align=Clutter.ActorAlign.END;
            tile.add_child(badge);
        }
        const widget=new St.Button({child:tile,can_focus:true,track_hover:true,style:'padding: 0;'});
        const entry={widget,image,content,reference};this.previews.set(win,entry);
        const resize=()=>{
            const size=reference?.width || reference?.get_preferred_width(-1)[1] || 48*scale;
            const rect=win.get_frame_rect();
            image.set_size(size,size*Math.max(.2,Math.min(1.5,rect.height/Math.max(1,rect.width))));
            tile.set_size(size,Math.max(size,image.height));
            widget.set_size(Math.max(size,referenceButton?.width||size),Math.max(tile.height,referenceButton?.height||size));
            if(badge)badge.set_size(size*.28,size*.28);
        };
        resize();
        if(reference){
            entry.referenceSignal=reference.connect('notify::allocation',resize);
            entry.referenceDestroy=reference.connect('destroy',()=>{entry.reference=null;entry.referenceSignal=0;entry.referenceDestroy=0;});
        }
        const restore=()=>{entry.menu.close();win.unminimize();Main.activateWindow(win);};
        entry.menu=new PopupMenu.PopupMenu(widget,.5,St.Side.BOTTOM);
        entry.menu.actor.add_style_class_name('fm-dock-menu');
        Main.uiGroup.add_child(entry.menu.actor);entry.menu.actor.hide();
        entry.manager=new PopupMenu.PopupMenuManager(widget);entry.manager.addMenu(entry.menu);
        const openItem=entry.menu.addAction('',restore);
        const updateTitle=()=>{
            const title=win.get_title() || app?.get_name() || 'Window';
            widget.accessible_name=`Restore ${title}`;
            openItem.label.text=`Open “${title}”`;
        };
        updateTitle();entry.titleSignal=win.connect('notify::title',updateTitle);
        widget.connect('clicked',restore);
        widget.connect('button-press-event',(_button,event)=>{
            if(event.get_button()!==3)return Clutter.EVENT_PROPAGATE;
            updateTitle();entry.menu.toggle();return Clutter.EVENT_STOP;
        });
        widget.connect('key-press-event',(_button,event)=>{
            if(event.get_key_symbol()!==Clutter.KEY_Menu &&
                !(event.get_key_symbol()===Clutter.KEY_F10 && (event.get_state()&Clutter.ModifierType.SHIFT_MASK)))return Clutter.EVENT_PROPAGATE;
            updateTitle();entry.menu.toggle();return Clutter.EVENT_STOP;
        });
        widget.connect('destroy',()=>{entry.widget=null;this.removePreview(win);});
        entry.unmanaged=win.connect('unmanaged',()=>this.removePreview(win));
        row.add_child(widget);
        return entry;
    }
    prepare(actor,kind) {
        if(this.stopped||Main.overview.visible||Main.sessionMode.isLocked)return false;
        const win=actor.meta_window;
        if(!win||win.get_window_type()!==Meta.WindowType.NORMAL)return false;
        this.finish(this.jobs.get(actor));
        const rect=win.get_frame_rect();
        if(!(rect.width>1&&rect.height>1))return false;
        let entry=this.previews.get(win),content;
        try {
            if(kind==='unminimize') {
                if(!entry?.widget)return false;
                content=entry.content;
            } else {
                // Snapshot memory budget: at most three retained full-window textures.
                if(kind==='minimize'&&this.previews.size>=3)return false;
                content=actor.paint_to_content(rect);
                if(!content)return false;
                if(kind==='minimize') {entry=this.preview(win,content);if(!entry)return false;}
            }
            const clone=new St.Widget({content,x:rect.x,y:rect.y,width:rect.width,height:rect.height,reactive:false});
            // A parent clip bounds final stage drawing without cropping the
            // snapshot texture used by DeformEffect itself.
            const overlay=new St.Widget({x:0,y:0,width:global.stage.width,height:global.stage.height,reactive:false});
            overlay.set_clip(rect.x,rect.y,rect.width,rect.height);
            overlay.add_child(clone);Main.uiGroup.add_child(overlay);
            const job={actor,kind,win,entry,clone,overlay,rect,opacity:actor.opacity};
            this.jobs.set(actor,job);
            actor.opacity=0;
            job.actorDestroy=actor.connect('destroy',()=>this.finish(job,true));
            return true;
        } catch(error) {console.warn(`Genie capture fallback: ${error.message}`);return false;}
    }
    start(job) {
        if(job.started)return;job.started=true;
        job.later=global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW,()=>{
            job.later=0;
            try {this.animate(job);}catch(error){console.warn(`Genie animation fallback: ${error.message}`);this.finish(job);}
            return false;
        });
    }
    animate(job) {
        if(this.jobs.get(job.actor)!==job)return;
        if(!this.motionEnabled()){this.finish(job);return;}
        if(job.kind==='destroy') {
            job.clone.ease({opacity:0,duration:110,mode:Clutter.AnimationMode.EASE_OUT_QUAD,onStopped:()=>this.finish(job)});return;
        }
        const widget=job.entry?.widget;
        if(!widget){this.finish(job);return;}
        // New minimize previews receive their allocation during a later layout.
        // Keep the snapshot still until that happens; restore previews already
        // have an allocation. Bound the wait so a hidden/destroyed Dock cannot
        // hold Mutter's completion indefinitely.
        if(!widget.mapped || widget.has_allocation?.()===false || !(widget.width>0&&widget.height>0)) {
            if((job.layoutRetries??0)>=12){console.debug('Genie: Dock layout unavailable, completing without motion');this.finish(job);return;}
            job.layoutRetries=(job.layoutRetries??0)+1;
            job.layoutWait=GLib.timeout_add(GLib.PRIORITY_DEFAULT,16,()=>{
                job.layoutWait=0;
                try{this.animate(job);}catch(error){console.warn(`Genie layout fallback: ${error.message}`);this.finish(job);}
                return GLib.SOURCE_REMOVE;
            });
            return;
        }
        const targetActor=job.entry.image??widget;
        const [x,y]=targetActor.get_transformed_position(),[width,height]=targetActor.get_transformed_size();
        if(!(width>0&&height>0)){this.finish(job);return;}
        const effect=new Mesh(job.rect,{x:x-job.rect.x,y:y-job.rect.y,width,height});
        job.clone.add_effect(effect);job.effect=effect;
        effect.progress=job.kind==='unminimize'?1:0;effect.invalidate();
        const updateClip=()=>{
            if(!job.overlay)return;
            const box=bounds(effect.progress,job.rect,effect.target);
            job.overlay.set_clip(job.rect.x+box.x-1,job.rect.y+box.y-1,box.width+2,box.height+2);
        };
        updateClip();
        job.timeline=new Clutter.Timeline({actor:job.clone,duration:480});
        job.timeline.connect('new-frame',timeline=>{
            if(!job.entry?.widget?.mapped){this.finish(job);return;}
            const target=job.entry.image??job.entry.widget;
            const [tx,ty]=target.get_transformed_position();
            const [tw,th]=target.get_transformed_size();
            if(!(tw>0&&th>0)){this.finish(job);return;}
            effect.target={x:tx-job.rect.x,y:ty-job.rect.y,width:tw,height:th};
            const p=timeline.get_progress();effect.progress=job.kind==='unminimize'?1-p:p;updateClip();effect.invalidate();
        });
        job.timeline.connect('completed',()=>this.finish(job));
        console.debug(`Genie: ${job.kind} animation started (layout retries: ${job.layoutRetries??0})`);
        job.timeline.start();
    }
    finish(job,actorGone=false) {
        if(!job||this.jobs.get(job.actor)!==job)return;
        this.jobs.delete(job.actor);
        if(job.later)global.compositor.get_laters().remove(job.later);
        if(job.layoutWait)GLib.source_remove(job.layoutWait);
        job.timeline?.stop();
        if(job.overlay)job.overlay.destroy();else job.clone.destroy();
        if(!actorGone) {
            job.actor.disconnect(job.actorDestroy);
            job.actor.opacity=job.opacity;
            if(job.kind==='minimize')job.actor.hide();
            if(job.kind==='unminimize')job.actor.show();
            this.originalComplete[job.kind].call(Main.wm._shellwm,job.actor);
        }
        if(job.kind!=='minimize'||actorGone)this.removePreview(job.win);
    }
    finishAll(){for(const job of [...this.jobs.values()])this.finish(job);}
    disable() {
        if(!this.jobs)return;
        this.stopped=true;this.finishAll();
        this.settings.disconnect(this.settingsSignal);
        this.desktopSettings.disconnect(this.desktopSettingsSignal);
        for(const signal of this.signals??[])global.window_manager.disconnect(signal);
        if(this.monitorSignal)Main.layoutManager.disconnect(this.monitorSignal);
        if(this.sessionSignal)Main.sessionMode.disconnect(this.sessionSignal);
        if(Main.wm._shouldAnimateActor===this.should)Main.wm._shouldAnimateActor=this.originalShould;
        for(const kind of Object.keys(this.originalComplete??{})) {
            if(Main.wm._shellwm[`completed_${kind}`]===this.completeWrappers[kind])
                Main.wm._shellwm[`completed_${kind}`]=this.originalComplete[kind];
        }
        for(const win of [...this.previews.keys()])this.removePreview(win);
    }
}
