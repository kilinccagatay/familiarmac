import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';
import Shell from 'gi://Shell';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as SearchController from 'resource:///org/gnome/shell/ui/searchController.js';
import * as Workspace from 'resource:///org/gnome/shell/ui/workspace.js';
import * as WorkspaceThumbnail from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

export function singleWindowSlot(slots, box, activeWindow=null) {
    if (slots.length !== 1) {
        // Preserve each slot's bounds and aspect ratio: emphasis must never
        // overlap its neighbours, even with many windows or a small monitor.
        if(!activeWindow || !slots.some(s=>s[4]?.metaWindow===activeWindow))return slots;
        return slots.map(([x,y,w,h,child])=>{
            const factor=child.metaWindow===activeWindow?1:.65;
            return [x+w*(1-factor)/2,y+h*(1-factor)/2,w*factor,h*factor,child];
        });
    }
    const [x,y,w,h,child] = slots[0];
    const scale = Math.min(1, box.get_width() * .72 / w, box.get_height() * .72 / h);
    return [[x + w*(1-scale)/2, y + h*(1-scale)/2, w*scale, h*scale, child]];
}

export class MissionControl {
    constructor() {
        this.signals=[];this.sources=new Set();this.windows=new Map();this.spaces=new Map();this.buttons=new Map();this.labels=new Map();this.thumbBackgrounds=new Map();
        this.injections=new InjectionManager();
        this.injections.overrideMethod(SearchController.SearchController.prototype,'_shouldTriggerSearch',original=>function(symbol){
            if(Main.overview.visible&&!this._showAppsButton.checked)return false;
            return original.call(this,symbol);
        });
        this.injections.overrideMethod(SearchController.SearchController.prototype,'startSearch',original=>function(event){
            if(Main.overview.visible&&!this._showAppsButton.checked)return;
            return original.call(this,event);
        });
        // Retain GNOME's queue and policy; defer banners only while overview is open.
        this.injections.overrideMethod(MessageTray.MessageTray.prototype,'_updateState',original=>function(...args){
            if(Main.overview.visible){this.hide();return;}
            return original.apply(this,args);
        });
        this.mutter=new Gio.Settings({schema_id:'org.gnome.mutter'});
        this.wasDynamic=this.mutter.get_boolean('dynamic-workspaces');
        this.mutter.set_boolean('dynamic-workspaces',false);
        const wm=global.workspace_manager;
        // Remove only GNOME's empty trailing placeholder, never a populated space.
        if(this.wasDynamic && wm.n_workspaces>1){
            const last=wm.get_workspace_by_index(wm.n_workspaces-1);
            if(last!==wm.get_active_workspace() && !last.list_windows().some(w=>!w.is_on_all_workspaces()))
                wm.remove_workspace(last,global.get_current_time());
        }
        this.activeWindow=global.display.focus_window;
        this.connect(global.display,'notify::focus-window',()=>{if(!Main.overview.visible&&global.display.focus_window)this.activeWindow=global.display.focus_window;});
        const controller=this;
        this.injections.overrideMethod(Workspace.WorkspaceLayout.prototype,'_getWindowSlots',original=>function(box){return singleWindowSlot(original.call(this,box),box,controller.activeWindow);});
        this.injections.overrideMethod(WorkspaceThumbnail.ThumbnailsBox.prototype,'_updateShouldShow',()=>function(){
            if(!this._shouldShow){this._shouldShow=true;this.notify('should-show');}
        });
        const controls=Main.overview._overview.controls;
        this.controls=controls;
        this.hiddenBackgrounds=new Map();this.windowDecorations=new Map();
        this.overviewActor=Main.overview._overview;
        this.overviewStyle=this.overviewActor.get_style();
        this.overviewActor.set_style(`${this.overviewStyle??''}; background-color: transparent;`);
        this.wallpaper=new Meta.BackgroundGroup();
        Main.layoutManager.overviewGroup.insert_child_at_index(this.wallpaper,0);
        this.wallpaperManagers=Main.layoutManager.monitors.map((_m,i)=>new Background.BackgroundManager({container:this.wallpaper,monitorIndex:i,controlPosition:true}));
        this.spaceStrip=new St.Widget({reactive:false,style:'background-color: rgba(30,30,34,0.34);'});
        Main.layoutManager.overviewGroup.insert_child_above(this.spaceStrip,this.wallpaper);
        this.wallpaper.hide();this.spaceStrip.hide();
        this.searchBin=controls._searchEntryBin;
        this.searchWasVisible=this.searchBin.visible;
        this.searchPreferredHeight=this.searchBin.get_preferred_height;
        this.searchBin.get_preferred_height=()=>[0,0];
        this.searchBin.hide();
        this.searchVisibleSignal=this.searchBin.connect('notify::visible',()=>{if(this.searchBin.visible)this.searchBin.hide();});
        this.thumbnails=controls._thumbnailsBox;
        this.thumbnailStyle=this.thumbnails.get_style();
        this.thumbnails.set_style('spacing: 18px; padding: 0 0 22px;');
        this.thumbnailScale=this.thumbnails._maxThumbnailScale;
        this.thumbnails._maxThumbnailScale=.10;
        this.thumbnails._updateShouldShow();
        this.thumbnails.queue_relayout();
        const add=()=>{if(wm.n_workspaces<16)wm.append_new_workspace(false,global.get_current_time());};
        this.plus=this.button('list-add-symbolic','Add Desktop',add);
        this.plus.set_style('width: 32px; height: 32px; min-width: 32px; min-height: 32px; padding: 0; border-width: 0; background-color: transparent; box-shadow: none;');
        this.plus.child.x_align=Clutter.ActorAlign.CENTER;
        this.plus.child.y_align=Clutter.ActorAlign.CENTER;
        this.previewBox=new St.Widget({layout_manager:new Clutter.BinLayout(),clip_to_allocation:true});
        this.preview=new St.Button({child:this.previewBox,style_class:'fm-space-add-preview',style:'border-width: 0px; border-radius: 0px; padding: 0px; background-color: transparent; box-shadow: none;',reactive:true,track_hover:true,can_focus:true,accessible_name:'Add Desktop'});
        this.preview.connect('clicked',add);Main.layoutManager.overviewGroup.add_child(this.preview);this.preview.hide();
        this.previewBackground=new Background.BackgroundManager({container:this.previewBox,monitorIndex:Main.layoutManager.primaryIndex,controlPosition:false,useContentSize:false});
        this.previewHint=new St.Label({text:'Add Desktop',style_class:'fm-space-label',reactive:false});Main.layoutManager.overviewGroup.add_child(this.previewHint);this.previewHint.hide();
        Main.layoutManager.overviewGroup.set_child_above_sibling(this.plus,this.preview);
        this.connect(Main.layoutManager,'monitors-changed',()=>{for(const manager of this.wallpaperManagers)manager.destroy();this.wallpaperManagers=Main.layoutManager.monitors.map((_m,i)=>new Background.BackgroundManager({container:this.wallpaper,monitorIndex:i,controlPosition:true}));this.hidePreview();this.previewBackground.destroy();this.previewBackground=new Background.BackgroundManager({container:this.previewBox,monitorIndex:Main.layoutManager.primaryIndex,controlPosition:false,useContentSize:false});});
        this.connect(Main.overview,'showing',()=>this.startUi());
        this.connect(Main.overview,'shown',()=>{this.hoverOrigin=global.get_pointer().slice(0,2);this.hoverReady=false;});
        this.connect(Main.overview,'hiding',()=>{this.leavingOverview=true;for(const entry of this.windowDecorations.values())entry.frame.hide();});
        this.connect(Main.overview,'hidden',()=>this.stopUi());
        this.connect(global.display,'window-created',(_d,w)=>this.track(w));
        this.fullscreenTransitions=new Set();this.restoreFrames=new Map();
        this.fullscreenAnimationWindows=new Set();
        const mission=this;
        this.injections.overrideMethod(Object.getPrototypeOf(Main.wm._workspaceAnimation),'animateSwitch',original=>function(from,to,direction,complete){
            const pending=mission.fullscreenWorkspaceSwitch;
            if(pending&&pending.from===from&&pending.to===to&&GLib.get_monotonic_time()<pending.until){
                mission.fullscreenWorkspaceSwitch=null;complete?.();return;
            }
            return original.call(this,from,to,direction,complete);
        });
        // Retain Mutter's snapshot/thaw/completion lifecycle. Only retime the
        // existing resize transitions; never run a second window animation.
        this.connect(global.window_manager,'size-changed',(_m,actor)=>{
            if(!this.fullscreenAnimationWindows.has(actor.meta_window))return;
            for(const animated of [actor,actor.__animationInfo?.clone]){
                if(!animated)continue;
                for(const property of ['x','y','scale-x','scale-y','translation-x','translation-y','opacity']){
                    const transition=animated.get_transition(property);
                    if(transition){transition.set_duration(360);transition.set_progress_mode(Clutter.AnimationMode.EASE_IN_OUT_CUBIC);}
                }
            }
        });

        // The green button may request UNMAXIMIZE while the compositor still
        // owns a fullscreen window. Treat either request as leaving fullscreen.
        this.connect(global.window_manager,'size-change',(_m,a,change,oldFrame)=>{
            const w=a.meta_window;
            if(this.fullscreenTransitions.has(w) || w.get_window_type()!==Meta.WindowType.NORMAL)return;
            const resizing=change===Meta.SizeChange.MAXIMIZE || change===Meta.SizeChange.UNMAXIMIZE;
            if(w.is_fullscreen() && resizing){this.changeFullscreen(w,false);return;}
            if(change!==Meta.SizeChange.MAXIMIZE)return;
            const [x,y,mods]=global.get_pointer();
            const r=oldFrame??w.get_frame_rect(),scale=St.ThemeContext.get_for_stage(global.stage).scale_factor;
            if(mods&Clutter.ModifierType.MOD1_MASK || x<r.x+42*scale || x>r.x+90*scale || y<r.y || y>r.y+40*scale)return;
            this.restoreFrames.set(w,{x:r.x,y:r.y,width:r.width,height:r.height});this.changeFullscreen(w,true);
        });
        for(const a of global.get_window_actors())this.track(a.meta_window);
        if(Main.overview.visible)this.startUi();
    }
    changeFullscreen(w,enter){
        if(!w.get_compositor_private())return;
        this.fullscreenTransitions.add(w);
        const actor=w.get_compositor_private();
        // Cancel the first maximize request before its buffer is presented.
        // Coalesce unmaximize + fullscreen in the same main-loop iteration.
        Main.wm._sizeChangeWindowDone(global.window_manager,actor);
        if(enter){Main.wm.skipNextEffect(actor);w.unmaximize(Meta.MaximizeFlags.BOTH);w.make_fullscreen();}
        else w.unmake_fullscreen();
        const id=GLib.timeout_add(GLib.PRIORITY_DEFAULT,350,()=>{this.sources.delete(id);this.fullscreenTransitions.delete(w);return GLib.SOURCE_REMOVE;});
        this.sources.add(id);
    }
    connect(object,name,fn){const id=object.connect(name,fn);this.signals.push([object,id]);return id;}
    later(fn){const id=GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE,()=>{this.sources.delete(id);fn();return GLib.SOURCE_REMOVE;});this.sources.add(id);}
    button(icon,label,fn){const b=new St.Button({style_class:'fm-space-button',can_focus:true,reactive:true,accessible_name:label,child:new St.Icon({icon_name:icon,icon_size:20})});b.connect('clicked',fn);Main.layoutManager.overviewGroup.add_child(b);b.hide();return b;}
    track(w){
        if(this.windows.has(w))return;
        const ids=[w.connect('notify::fullscreen',()=>this.fullscreen(w)),w.connect('unmanaged',()=>{this.leave(w,true);this.windows.delete(w);})];
        this.windows.set(w,ids);
        // Existing fullscreen windows are left where the user placed them.
    }
    prepareFullscreenSwitch(w,from,to){
        this.fullscreenWorkspaceSwitch={from:from.index(),to:to.index(),until:GLib.get_monotonic_time()+1000000};
        this.fullscreenAnimationWindows.add(w);
        const id=GLib.timeout_add(GLib.PRIORITY_DEFAULT,900,()=>{this.sources.delete(id);this.fullscreenAnimationWindows.delete(w);return GLib.SOURCE_REMOVE;});this.sources.add(id);
    }
    fullscreen(w){
        if(!w.is_fullscreen()){this.leave(w,false);return;}
        if(this.spaces.has(w)||w.is_on_all_workspaces()||w.get_window_type()!==Meta.WindowType.NORMAL)return;
        const home=w.get_workspace(),space=global.workspace_manager.append_new_workspace(false,global.get_current_time());
        this.prepareFullscreenSwitch(w,home,space);this.spaces.set(w,{home,space});w.change_workspace(space);space.activate(global.get_current_time());
    }
    leave(w,closed){
        const entry=this.spaces.get(w);if(!entry)return;
        this.spaces.delete(w);
        const wm=global.workspace_manager;
        const home=entry.home.index()>=0?entry.home:wm.get_workspace_by_index(0);
        const active=wm.get_active_workspace()===entry.space;
        if(!closed && w.get_compositor_private()){
            if(active)this.prepareFullscreenSwitch(w,entry.space,home);
            w.change_workspace(home);
        }
        this.restoreFrames.delete(w);
        this.later(()=>{
            if(active)home.activate(global.get_current_time());
            const id=GLib.timeout_add(GLib.PRIORITY_DEFAULT,450,()=>{
                this.sources.delete(id);
                if(entry.space.index()>=0&&wm.n_workspaces>1&&!entry.space.list_windows().some(v=>v!==w&&!v.is_on_all_workspaces()))wm.remove_workspace(entry.space,global.get_current_time());
                return GLib.SOURCE_REMOVE;
            });this.sources.add(id);
        });
    }
    closeSpace(space){
        const full=[...this.spaces].find(([,v])=>v.space===space);
        if(full){full[0].unmake_fullscreen();return;}
        const wm=global.workspace_manager;if(wm.n_workspaces<=1)return;
        const target=wm.get_workspace_by_index(space.index()===0?1:space.index()-1);
        for(const w of space.list_windows())if(!w.is_on_all_workspaces())w.change_workspace(target);
        if(wm.get_active_workspace()===space)target.activate(global.get_current_time());
        wm.remove_workspace(space,global.get_current_time());
    }
    captureActiveWindow(){
        const workspace=global.workspace_manager.get_active_workspace();
        const windows=global.display.get_tab_list(Meta.TabList.NORMAL_ALL,workspace);
        const focus=global.display.focus_window;
        this.activeWindow=windows.includes(focus)?focus:(windows[0]??null);
        // GNOME caches slots between overview visits. Focus can change without
        // any window geometry changing, so recompute emphasis on every entry.
        for(const view of this.controls._workspacesDisplay._workspacesViews)
            for(const ws of view._workspaces??[]){
                const layout=ws._container?.layout_manager;
                if(layout){layout._needsLayout=true;layout.layout_changed();}
            }
    }
    startUi(){this.captureActiveWindow();this.hoverOrigin=null;this.hoverReady=false;this.leavingOverview=false;this.controls._searchController.reset();this.spacesExpanded=false;this.lastExpanded=undefined;if(!this.panelState){this.panelState={opacity:Main.panel.opacity,reactive:Main.panel.reactive,boxes:[Main.panel._leftBox,Main.panel._centerBox,Main.panel._rightBox].map(b=>[b,b.visible])};}Main.panel.opacity=0;Main.panel.reactive=false;for(const [b] of this.panelState.boxes)b.hide();Main.messageTray._updateState();if(this.uiTimer)return;this.updateUi();this.uiTimer=GLib.timeout_add(GLib.PRIORITY_DEFAULT,33,()=>{this.updateUi();return GLib.SOURCE_CONTINUE;});}
    updateUi(){
        const box=this.thumbnails,scale=St.ThemeContext.get_for_stage(global.stage).scale_factor;
        if(!box?.mapped){this.plus.hide();for(const b of this.buttons.values())b.hide();for(const l of this.labels.values())l.hide();return;}
        const [x,y]=box.get_transformed_position(),[width,height]=box.get_transformed_size();
        const m=Main.layoutManager.primaryMonitor;
        const [pointerX,pointerY]=global.get_pointer();
        const compactHeight=36*scale;
        const edgeBottom=this.spacesExpanded?y+height+12*scale:m.y+compactHeight;
        this.spacesExpanded=pointerX>=m.x&&pointerX<m.x+m.width&&pointerY>=m.y&&pointerY<=edgeBottom;
        const expanded=this.spacesExpanded;
        const stripHeight=expanded?y+height-m.y+8*scale:compactHeight;
        if(this.lastExpanded!==expanded){
            box.ease({opacity:expanded?255:0,translation_y:expanded?0:-16*scale,duration:200,mode:Clutter.AnimationMode.EASE_OUT_CUBIC});
            this.lastExpanded=expanded;
            const buttonSize=expanded?32:24;
            this.plus.set_style(`width: ${buttonSize}px; height: ${buttonSize}px; min-width: ${buttonSize}px; min-height: ${buttonSize}px; padding: 0; border-width: 0; background-color: transparent; box-shadow: none;`);
            this.plus.child.icon_size=expanded?20:16;
        }
        if(!box.get_transition('opacity'))box.opacity=expanded?255:0;
        box.reactive=expanded;
        this.wallpaper.show();this.spaceStrip.set_position(m.x,m.y);this.spaceStrip.width=m.width;
        if(this.stripTargetHeight!==stripHeight){this.stripTargetHeight=stripHeight;this.spaceStrip.ease({height:stripHeight,duration:200,mode:Clutter.AnimationMode.EASE_OUT_CUBIC});}this.spaceStrip.show();
        for(const view of this.controls._workspacesDisplay._workspacesViews){
            for(const ws of view._workspaces??[]){
                const bg=ws._background;if(!bg)continue;
                if(!this.hiddenBackgrounds.has(bg)){
                    const id=bg.connect('destroy',()=>this.hiddenBackgrounds.delete(bg));
                    this.hiddenBackgrounds.set(bg,{opacity:bg.opacity,id});
                }
                bg.opacity=0;
                for(const preview of ws._windows??[])this.decorateWindow(preview,scale);
            }
        }
        const layoutHeight=this.controls.layout_manager._workAreaBox?.get_height()??this.controls.height;
        const porthole=box._porthole;
        if(layoutHeight>0 && porthole?.width>0){
            const targetHeight=132*scale*porthole.height/porthole.width;
            const targetScale=(targetHeight+22*scale)/layoutHeight;
            if(Math.abs(box._maxThumbnailScale-targetScale)>.0001){box._maxThumbnailScale=targetScale;box.queue_relayout();}
        }
        // Align with the preview image, excluding its desktop-name caption.
        const firstThumb=box._thumbnails.find(t=>t.metaWorkspace.index()>=0);
        const previewCenter=firstThumb?firstThumb.get_transformed_position()[1]+firstThumb.get_transformed_size()[1]/2:y+Math.max(0,height-22*scale)/2;
        this.place(this.plus,m.x+m.width-(expanded?48:44)*scale,expanded?previewCenter-16*scale:m.y+(compactHeight-24*scale)/2);this.plus.show();
        const showHint=expanded&&(this.plus.hover||this.preview.hover);
        const pw=132*scale,ph=82*scale,pxHint=m.x+m.width-pw*.75,pyHint=previewCenter-ph/2;
        if(showHint && !this.preview.visible){
            this.preview.set_size(pw,ph);this.previewBox.set_size(pw,ph);
            this.preview.set_position(m.x+m.width,pyHint);this.preview.opacity=0;this.preview.show();
            this.preview.ease({x:pxHint,opacity:255,duration:180,mode:Clutter.AnimationMode.EASE_OUT_QUAD});
            this.previewHint.hide();
        }else if(!showHint)this.hidePreview();
        const [px,py,mods]=global.get_pointer(),seen=new Set();let desktopNumber=0;
        const compactWidths=box._thumbnails.map(t=>{const l=this.labels.get(t.metaWorkspace);return (l?.get_preferred_width(-1)[1]??90*scale)+20*scale;});
        let compactX=m.x+(m.width-compactWidths.reduce((a,b)=>a+b,0))/2;let compactIndex=0;
        for(const t of box._thumbnails){
            const ws=t.metaWorkspace;if(ws.index()<0)continue;seen.add(ws);
            if(!this.thumbBackgrounds.has(t)){
                const bg=new Background.BackgroundManager({container:t._contents,monitorIndex:t.monitorIndex,controlPosition:true});
                t._contents.set_child_below_sibling(bg.backgroundActor,null);
                const signal=t.connect('destroy',()=>{bg.destroy();this.thumbBackgrounds.delete(t);});
                this.thumbBackgrounds.set(t,{bg,signal});
            }
            let b=this.buttons.get(ws);if(!b){b=this.button('window-close-symbolic','Close Desktop',()=>this.closeSpace(ws));b.add_style_class_name('fm-space-close');b.child.icon_size=12;this.buttons.set(ws,b);}
            const [tx,ty]=t.get_transformed_position(),[tw,th]=t.get_transformed_size();
            b.set_position(tx-6*scale,ty-6*scale);
            let label=this.labels.get(ws);
            if(!label){label=new St.Label({style_class:'fm-space-label',reactive:false});Main.layoutManager.overviewGroup.add_child(label);this.labels.set(ws,label);}
            const full=[...this.spaces].find(([,entry])=>entry.space===ws);
            if(b._fmFullscreen!==!!full){
                b._fmFullscreen=!!full;
                if(full){const path=Main.extensionManager.lookup('macbook-menu@local').stateObj.path;b.child.gicon=new Gio.FileIcon({file:Gio.File.new_for_path(GLib.build_filenamev([path,'icons','fullscreen-exit-symbolic.svg']))});}
                else {b.child.gicon=null;b.child.icon_name='window-close-symbolic';}
            }
            b.accessible_name=full?'Exit Full Screen':'Close Desktop';
            label.text=full?(Shell.WindowTracker.get_default().get_window_app(full[0])?.get_name()??full[0].get_title()):`Desktop ${++desktopNumber}`;
            const [,lw]=label.get_preferred_width(-1);label.set_size(lw,label.get_preferred_height(-1)[1]);
            this.place(label,expanded?tx+(tw-lw)/2:compactX+10*scale,expanded?ty+th+4*scale:m.y+(compactHeight-label.get_preferred_height(-1)[1])/2);label.show();
            compactX+=compactWidths[compactIndex++];
            const hover=px>=tx-8*scale&&px<=tx+tw&&py>=ty-8*scale&&py<=ty+th;
            b.visible=expanded && global.workspace_manager.n_workspaces>1 && (!!(mods&Clutter.ModifierType.MOD1_MASK)||hover);
        }
        for(const [ws,b] of this.buttons)if(!seen.has(ws)){b.destroy();this.buttons.delete(ws);this.labels.get(ws)?.destroy();this.labels.delete(ws);}
    }
    decorateWindow(preview,scale){
        let entry=this.windowDecorations.get(preview);
        const container=preview.window_container;
        if(!entry){
            const frame=new St.DrawingArea({reactive:false});
            Main.layoutManager.overviewGroup.add_child(frame);
            frame.connect('repaint',()=>{
                if(!frame._fmGeometry)return;
                const {w,h,r,stroke}=frame._fmGeometry;
                const cr=frame.get_context(),inset=stroke/2,rr=Math.max(0,r-inset);
                cr.setSourceRGBA(10/255,132/255,1,1);cr.setLineWidth(stroke);
                cr.newSubPath();
                cr.arc(w-inset-rr,inset+rr,rr,-Math.PI/2,0);
                cr.arc(w-inset-rr,h-inset-rr,rr,0,Math.PI/2);
                cr.arc(inset+rr,h-inset-rr,rr,Math.PI/2,Math.PI);
                cr.arc(inset+rr,inset+rr,rr,Math.PI,Math.PI*1.5);
                cr.closePath();cr.stroke();cr.$dispose();
            });
            const originalShowOverlay=preview.showOverlay;
            const showOverlay=function(...args){
                originalShowOverlay.apply(this,args);
                // Selection is the outline, not a second size animation.
                this.window_container.remove_transition('scale-x');
                this.window_container.remove_transition('scale-y');
                this.window_container.set_scale(1,1);
            };
            preview.showOverlay=showOverlay;
            container.remove_transition('scale-x');container.remove_transition('scale-y');container.set_scale(1,1);
            const hidden=[preview._icon,preview._closeButton].filter(Boolean).map(a=>({actor:a,visible:a.visible,id:a.connect('notify::visible',()=>{if(a.visible)a.hide();})}));
            const id=preview.connect('destroy',()=>{frame.destroy();this.windowDecorations.delete(preview);});
            entry={frame,hidden,id,originalShowOverlay,showOverlay};this.windowDecorations.set(preview,entry);
        }
        for(const v of entry.hidden)v.actor.hide();
        const [x,y]=container.get_transformed_position(),[w,h]=container.get_transformed_size();
        // Preserve the native window image. Scale the outline's curve with
        // the source window rather than imposing a new corner mask on it.
        const sourceRect=preview.metaWindow.get_frame_rect();
        const previewScale=sourceRect.width>0?w/sourceRect.width:1;
        const nativeRadius=12*scale*previewScale;
        const [px,py]=global.get_pointer();
        if(this.hoverOrigin&&!Main.overview.animationInProgress&&(Math.abs(px-this.hoverOrigin[0])>2||Math.abs(py-this.hoverOrigin[1])>2))this.hoverReady=true;
        const selected=this.hoverReady&&!Main.overview.animationInProgress&&!this.leavingOverview&&preview.mapped&&px>=x&&px<=x+w&&py>=y&&py<=y+h;
        entry.frame.visible=selected;
        if(selected){
            const gap=6*scale;
            entry.frame.set_position(x-gap,y-gap);entry.frame.set_size(w+2*gap,h+2*gap);
            const geometry=`${w}:${h}:${nativeRadius}:${scale}`;
            if(entry.geometry!==geometry){entry.geometry=geometry;
            entry.frame._fmGeometry={w:w+2*gap,h:h+2*gap,r:nativeRadius+gap,stroke:4*scale};
            entry.frame.queue_repaint();}
        }
    }
    clearWindowDecorations(){
        for(const [preview,e] of this.windowDecorations){
            preview.disconnect(e.id);
            if(preview.showOverlay===e.showOverlay)preview.showOverlay=e.originalShowOverlay;
            for(const v of e.hidden){v.actor.disconnect(v.id);v.actor.visible=v.visible;}
            e.frame.destroy();
        }
        this.windowDecorations.clear();
    }
    place(actor,x,y){
        if(!Number.isFinite(x)||!Number.isFinite(y))return;
        if(!Number.isFinite(actor.x)||!Number.isFinite(actor.y)){actor.set_position(x,y);actor._fmTargetX=x;actor._fmTargetY=y;return;}
        if(actor._fmTargetX===x&&actor._fmTargetY===y)return;
        const first=actor._fmTargetX===undefined;
        actor._fmTargetX=x;actor._fmTargetY=y;
        if(first)actor.set_position(x,y);
        else actor.ease({x,y,duration:200,mode:Clutter.AnimationMode.EASE_OUT_CUBIC});
    }
    hidePreview(){this.preview?.remove_all_transitions();this.preview?.hide();this.previewHint?.hide();}
    stopUi(){this.clearWindowDecorations();if(this.panelState){Main.panel.opacity=this.panelState.opacity;Main.panel.reactive=this.panelState.reactive;for(const [b,visible] of this.panelState.boxes)b.visible=visible;this.panelState=null;}Main.messageTray._updateState();this.wallpaper?.hide();this.spaceStrip?.hide();for(const [bg,v] of this.hiddenBackgrounds){bg.opacity=v.opacity;bg.disconnect(v.id);}this.hiddenBackgrounds.clear();this.hidePreview();if(this.uiTimer){GLib.source_remove(this.uiTimer);this.uiTimer=0;}this.plus.hide();for(const b of this.buttons.values())b.hide();for(const l of this.labels.values())l.hide();}
    destroy(){
        this.stopUi();for(const manager of this.wallpaperManagers)manager.destroy();this.wallpaper.destroy();this.spaceStrip.destroy();this.overviewActor.set_style(this.overviewStyle);this.searchBin.get_preferred_height=this.searchPreferredHeight;this.searchBin.disconnect(this.searchVisibleSignal);this.searchBin.visible=this.searchWasVisible;for(const [o,id] of this.signals)o.disconnect(id);
        for(const [w,ids] of this.windows)for(const id of ids)w.disconnect(id);
        for(const id of this.sources)GLib.source_remove(id);this.sources.clear();
        this.previewBackground.destroy();this.preview.destroy();this.previewHint.destroy();this.plus.destroy();for(const b of this.buttons.values())b.destroy();for(const l of this.labels.values())l.destroy();
        // Restore managed fullscreen spaces without closing any application.
        for(const [w,{home,space}] of this.spaces){
            if(w.get_compositor_private()){w.unmake_fullscreen();w.change_workspace(home.index()>=0?home:global.workspace_manager.get_workspace_by_index(0));}
            if(space.index()>=0 && global.workspace_manager.n_workspaces>1 && !space.list_windows().some(v=>v!==w&&!v.is_on_all_workspaces()))global.workspace_manager.remove_workspace(space,global.get_current_time());
        }
        this.spaces.clear();
        for(const [t,{bg,signal}] of this.thumbBackgrounds){t.disconnect(signal);bg.destroy();}this.thumbBackgrounds.clear();
        this.thumbnails.remove_all_transitions();this.thumbnails.translation_y=0;this.thumbnails.opacity=255;this.thumbnails.reactive=true;this.thumbnails.set_style(this.thumbnailStyle);this.injections.clear();Main.messageTray._updateState();this.thumbnails._maxThumbnailScale=this.thumbnailScale;this.thumbnails._updateShouldShow();this.thumbnails.queue_relayout();
        if(this.wasDynamic)this.mutter.set_boolean('dynamic-workspaces',true);
    }
}
