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
import {WORKSPACE_SPACING} from 'resource:///org/gnome/shell/ui/workspaceAnimation.js';
import * as WorkspacesView from 'resource:///org/gnome/shell/ui/workspacesView.js';
import * as WorkspaceThumbnail from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

export function singleWindowSlot(slots, box, activeWindow=null) {
    // A newly mapped/destroying window may temporarily have no drawable area.
    // Never propagate a non-finite slot into every other window's bounds.
    slots=slots.filter(s=>s.slice(0,4).every(Number.isFinite)&&s[2]>0&&s[3]>0);
    if(!slots.length || !Number.isFinite(box.get_width()) || !Number.isFinite(box.get_height()) || box.get_width()<=0 || box.get_height()<=0)return slots;
    const left=Math.min(...slots.map(s=>s[0])),top=Math.min(...slots.map(s=>s[1]));
    const width=Math.max(...slots.map(s=>s[0]+s[2]))-left;
    const height=Math.max(...slots.map(s=>s[1]+s[3]))-top;
    if(width<=0||height<=0)return slots;
    // Expand the complete native arrangement uniformly, retaining its ordering
    // and non-overlapping slots. More windows naturally receive smaller slots.
    const scale=Math.min(box.get_width()*.94/width,box.get_height()*.88/height,1.4);
    const x=(box.x1??0)+(box.get_width()-width*scale)/2;
    const y=(box.y1??0)+(box.get_height()-height*scale)/2;
    const knownFocus=slots.some(s=>s[4]?.metaWindow===activeWindow);
    return slots.map(([sx,sy,w,h,child])=>{
        const emphasis=slots.length>1&&knownFocus&&child.metaWindow!==activeWindow ? .8 : 1;
        return [x+(sx-left)*scale+w*scale*(1-emphasis)/2,
            y+(sy-top)*scale+h*scale*(1-emphasis)/2,w*scale*emphasis,h*scale*emphasis,child];
    });
}

export class MissionControl {
    constructor() {
        this.signals=[];this.sources=new Set();this.windows=new Map();this.spaces=new Map();this.buttons=new Map();this.labels=new Map();this.expandedLabels=new Map();this.thumbBackgrounds=new Map();
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
        this.installWorkspaceSwipeLayout();
        this.activeWindow=global.display.focus_window;
        this.connect(global.display,'notify::focus-window',()=>{if(!Main.overview.visible&&global.display.focus_window)this.activeWindow=global.display.focus_window;});
        const controller=this;
        this.injections.overrideMethod(WorkspacesView.WorkspacesView.prototype,'_getSpacing',original=>function(box,fitMode,vertical){
            const spacing=original.call(this,box,fitMode,vertical);
            if(!Number.isFinite(spacing)){
                if(!this._fmInvalidSpacingLogged){this._fmInvalidSpacingLogged=true;console.warn('FamiliarMac invalid overview spacing '+JSON.stringify({box:[box.x1,box.y1,box.x2,box.y2],fitMode,vertical,scale:St.ThemeContext.get_for_stage(global.stage).scale_factor}));}
                return 24*St.ThemeContext.get_for_stage(global.stage).scale_factor;
            }
            return spacing;
        });
        this.injections.overrideMethod(Workspace.WorkspaceLayout.prototype,'_getWindowSlots',original=>function(box){
            const slots=original.call(this,box);
            if(slots.some(s=>!s.slice(0,4).every(Number.isFinite))&&!this._fmInvalidSlotsLogged){
                this._fmInvalidSlotsLogged=true;
                console.warn('FamiliarMac invalid native overview slots '+JSON.stringify({box:[box.x1,box.y1,box.x2,box.y2],workarea:this._workarea,slots:slots.map(s=>s.slice(0,4))}));
            }
            return singleWindowSlot(slots,box,controller.activeWindow);
        });
        this.injections.overrideMethod(WorkspaceThumbnail.ThumbnailsBox.prototype,'_updateShouldShow',()=>function(){
            if(!this._shouldShow){this._shouldShow=true;this.notify('should-show');}
        });
        const controls=Main.overview._overview.controls;
        this.controls=controls;
        this.connect(controls._workspacesDisplay._scrollAdjustment,'notify::value',()=>this.syncWorkspaceBackgrounds());
        this.hiddenBackgrounds=new Map();this.windowDecorations=new Map();
        this.installWorkspaceBackgroundGuard();
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
        // Keep the native minimum size while visually concealed: GNOME still allocates
        // the search entry and its themed descendants during overview entry.
        // A forced zero height reaches St rendering and can crash Shell.
        this.searchOpacity=this.searchBin.opacity;
        this.searchReactive=this.searchBin.reactive;
        this.searchBin.opacity=0;this.searchBin.reactive=false;
        this.searchVisibleSignal=this.searchBin.connect('notify::visible',()=>{this.searchBin.opacity=0;});
        this.thumbnails=controls._thumbnailsBox;
        this.installSpaceActivation();
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
        this.connect(Main.layoutManager,'monitors-changed',()=>{this.clearWorkspaceSwipeSurfaces();for(const manager of this.wallpaperManagers)manager.destroy();this.wallpaperManagers=Main.layoutManager.monitors.map((_m,i)=>new Background.BackgroundManager({container:this.wallpaper,monitorIndex:i,controlPosition:true}));this.hidePreview();this.previewBackground.destroy();this.previewBackground=new Background.BackgroundManager({container:this.previewBox,monitorIndex:Main.layoutManager.primaryIndex,controlPosition:false,useContentSize:false});});
        this.connect(Main.overview,'showing',()=>this.startUi());
        this.connect(Main.overview,'shown',()=>{for(const view of this.controls._workspacesDisplay._workspacesViews)view._updateVisibility?.();this.hoverOrigin=global.get_pointer().slice(0,2);this.hoverReady=false;});
        this.connect(Main.overview,'hiding',()=>{this.leavingOverview=true;for(const view of this.controls._workspacesDisplay._workspacesViews)view._updateVisibility?.();for(const entry of this.windowDecorations.values())entry.frame.hide();});
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
    installSpaceActivation(){
        this.injections.overrideMethod(WorkspaceThumbnail.WorkspaceThumbnail.prototype,'activate',original=>function(time){
            if(this.state>WorkspaceThumbnail.ThumbnailState.NORMAL||this.metaWorkspace.index()<0)return;
            original.call(this,time);
            Main.overview.hide();
        });
    }
    activateSpace(space,time){
        if(space.index()<0||this.leavingOverview)return;
        space.activate(time);Main.overview.hide();
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
        // The parent has not necessarily allocated the view yet. Let its normal
        // overview allocation consume this flag; forcing child layout here can
        // allocate zero-height backgrounds before the parent is ready.
        for(const view of this.controls._workspacesDisplay._workspacesViews)
            for(const ws of view._workspaces??[]){
                const layout=ws._container?.layout_manager;
                if(layout)layout._needsLayout=true;
            }
    }
    startUi(){
        const scale=St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this.thumbnails.remove_all_transitions();this.thumbnails.opacity=0;this.thumbnails.translation_y=-16*scale;this.thumbnails.set_clip(0,0,0,0);
        this.spaceStrip.remove_all_transitions();this.spaceStrip.height=36*scale;this.stripTargetHeight=36*scale;
        for(const label of this.labels.values()){label.remove_all_transitions();delete label._fmTargetX;delete label._fmTargetY;}
        this.wallpaper.show();
        for(const view of this.controls._workspacesDisplay._workspacesViews)
            for(const workspace of view._workspaces??[])this.hideWorkspaceBackground(workspace._background);
        this.captureActiveWindow();this.hoverOrigin=null;this.hoverReady=false;this.leavingOverview=false;this.controls._searchController.reset();this.spacesExpanded=false;this.stripOpenPointer=global.get_pointer().slice(0,2);this.stripHoverArmed=false;this.lastExpanded=undefined;if(!this.panelState){this.panelState={opacity:Main.panel.opacity,reactive:Main.panel.reactive,boxes:[Main.panel._leftBox,Main.panel._centerBox,Main.panel._rightBox].map(b=>[b,b.visible])};}Main.panel.opacity=0;Main.panel.reactive=false;for(const [b] of this.panelState.boxes)b.hide();Main.messageTray._updateState();if(this.uiTimer)return;this.updateUi();this.uiTimer=GLib.timeout_add(GLib.PRIORITY_DEFAULT,33,()=>{this.updateUi();return GLib.SOURCE_CONTINUE;});}
    hideWorkspaceBackground(background){
        if(!background)return;
        if(!this.hiddenBackgrounds.has(background)){
            const id=background.connect('destroy',()=>this.hiddenBackgrounds.delete(background));
            this.hiddenBackgrounds.set(background,{opacity:background.opacity,id});
        }
        background.opacity=0;
    }
    installWorkspaceBackgroundGuard(){
        const controller=this;
        this.injections.overrideMethod(Workspace.WorkspaceBackground.prototype,'_init',original=>function(...args){
            original.apply(this,args);
            // Hide before the first paint, including an empty workspace. The
            // periodic UI refresh runs too late to prevent an opening flash.
            controller.hideWorkspaceBackground(this);
        });
    }
    installWorkspaceSwipeLayout(){
        const controller=this;
        this.injections.overrideMethod(WorkspacesView.WorkspacesView.prototype,'_updateVisibility',original=>function(...args){
            original.apply(this,args);
            // Native overview keeps adjacent workspaces visible. Entry/exit
            // changes spacing, so a neighbor can cross an empty viewport.
            // Keep it concealed until the picker is fully open.
            if(controller.leavingOverview||Main.overview.animationInProgress){
                const active=global.workspace_manager.get_active_workspace();
                for(const workspace of this._workspaces)
                    if(workspace.metaWorkspace!==active)workspace.hide();
            }
        });
        // Keep GNOME's gesture, adjustment, allocation and settling animation.
        // Only replace the card spacing/scaling with screen-sized horizontal steps.
        this.injections.overrideMethod(WorkspacesView.WorkspacesView.prototype,'_getSpacing',original=>function(box,fitMode,vertical){
            if(!vertical&&fitMode===0&&Main.overview.visible&&!Main.overview.animationInProgress){
                const monitor=Main.layoutManager.monitors[this._monitorIndex];
                const workspace=this._workspaces[0];
                if(monitor&&workspace&&box.get_height()>0){
                    const [,width]=workspace.get_preferred_width(box.get_height());
                    if(Number.isFinite(width)&&width>0)return monitor.width+WORKSPACE_SPACING*St.ThemeContext.get_for_stage(global.stage).scale_factor-width;
                }
            }
            return original.call(this,box,fitMode,vertical);
        });
        this.injections.overrideMethod(WorkspacesView.WorkspacesView.prototype,'_updateWorkspacesState',original=>function(...args){
            original.apply(this,args);
            if(controller.leavingOverview||Main.overview.animationInProgress)this._updateVisibility();
            if(Main.overview.visible&&!Main.overview.animationInProgress&&this._fitModeAdjustment.value===0)
                for(const workspace of this._workspaces)workspace.set_scale(1,1);
        });
    }
    clearWorkspaceSwipeSurfaces(){
        for(const surface of this.swipeSurfaces??[])surface.destroy();
        this.swipeSurfaces=null;
    }
    workspaceSwitchInProgress(){
        const display=this.controls._workspacesDisplay,adjustment=display._scrollAdjustment;
        return !!display._gestureActive||!!adjustment.get_transition('value')||Math.abs(adjustment.value-Math.round(adjustment.value))>.00001;
    }
    syncWorkspaceBackgrounds(){
        if(!Main.overview.visible||this.leavingOverview)return;
        const display=this.controls._workspacesDisplay,value=display._scrollAdjustment.value;
        if(this.workspaceSwitchInProgress())for(const entry of this.windowDecorations.values())entry.frame.hide();
        for(const view of display._workspacesViews)
            for(const ws of view._workspaces??[])if(this.hiddenBackgrounds?.has(ws._background))ws._background.opacity=0;
        const moving=Math.abs(value-Math.round(value))>.00001&&!Main.overview.animationInProgress;
        if(!moving){this.clearWorkspaceSwipeSurfaces();return;}
        // Full monitor wallpaper surfaces follow the SAME native progress as
        // window previews. No independent timeline, card corners or opacity fade.
        if(!this.swipeSurfaces){
            this.swipeSurfaces=Main.layoutManager.monitors.map(m=>{
                const surface=new St.Widget({x:m.x,y:m.y,width:m.width,height:m.height,clip_to_allocation:true,reactive:false,style:'background-color: #181818;'});
                surface._fmMonitor=m;
                surface._fmPages=[0,1].map(()=>{
                    const page=new Clutter.Actor({width:m.width,height:m.height,clip_to_allocation:true,reactive:false});
                    page.add_child(new Clutter.Clone({source:this.wallpaper,x:-m.x,y:-m.y,reactive:false}));
                    surface.add_child(page);return page;
                });
                Main.layoutManager.overviewGroup.insert_child_above(surface,this.wallpaper);
                return surface;
            });
        }
        const first=Math.floor(value);
        for(const surface of this.swipeSurfaces){
            const m=surface._fmMonitor;
            const top=m.index===Main.layoutManager.primaryIndex?Math.max(0,this.spaceStrip.height):0;
            surface.set_clip(0,top,m.width,Math.max(0,m.height-top));
            const step=m.width+WORKSPACE_SPACING*St.ThemeContext.get_for_stage(global.stage).scale_factor;
            surface._fmPages.forEach((page,i)=>page.set_position((first+i-value)*step,0));
        }
    }
    ensureSpaceLabels(workspace,title){
        for(const [labels,expanded] of [[this.labels,false],[this.expandedLabels,true]]){
            let label=labels.get(workspace);
            if(!label){
                label=new St.Label({style_class:'fm-space-label',reactive:true,visible:false});
                label.connect('button-release-event',(_actor,event)=>{
                    if(event.get_button()!==1)return Clutter.EVENT_PROPAGATE;
                    this.activateSpace(workspace,event.get_time());return Clutter.EVENT_STOP;
                });
                Main.layoutManager.overviewGroup.add_child(label);labels.set(workspace,label);
            }
            if(label.text!==title){label.text=title;label.set_size(-1,-1);}
            this.styleSpaceLabel(label,workspace,expanded);
        }
    }
    styleSpaceLabel(label,workspace,expanded){
        const selected=workspace===global.workspace_manager.get_active_workspace();
        const state=expanded?'expanded':selected?'selected':'compact';
        if(label._fmSelectionStyle===state)return;
        label._fmSelectionStyle=state;
        label.set_style(expanded?'':`padding: 3px 9px; border-radius: 6px; background-color: ${selected?'rgba(255,255,255,0.22)':'transparent'};`);
        label.set_size(-1,-1);
    }
    updateEmptyState(){
        if(!this.emptyState){
            const text=new St.Label({text:GLib.get_language_names()[0].startsWith('tr')?'Kullanılabilir Pencere Yok':'No Available Windows',
                x_align:Clutter.ActorAlign.CENTER,y_align:Clutter.ActorAlign.CENTER,
                style:'color: white; font-size: 14px; text-align: center; padding: 0; margin: 0;'});
            this.emptyState=new St.Bin({child:text,reactive:false,visible:false,
                x_align:Clutter.ActorAlign.CENTER,y_align:Clutter.ActorAlign.CENTER,
                style:'background-color: rgba(30,30,34,0.55); border-radius: 18px; padding: 6px 14px;'});
            Main.layoutManager.overviewGroup.add_child(this.emptyState);
        }
        const ws=global.workspace_manager.get_active_workspace();
        const empty=global.display.get_tab_list(Meta.TabList.NORMAL_ALL,ws).filter(w=>!w.skip_taskbar).length===0;
        const m=Main.layoutManager.primaryMonitor;
        const width=this.emptyState.get_preferred_width(-1)[1],height=this.emptyState.get_preferred_height(width)[1];
        this.emptyState.set_size(width,height);this.emptyState.set_position(m.x+(m.width-width)/2,m.y+(m.height-height)/2);
        this.emptyState.visible=empty&&!this.leavingOverview&&!Main.overview.animationInProgress&&!this.swipeSurfaces;
    }
    updateUi(){
        const box=this.thumbnails,scale=St.ThemeContext.get_for_stage(global.stage).scale_factor;
        if(!box?.mapped){this.plus.hide();for(const b of this.buttons.values())b.hide();for(const l of [...this.labels.values(),...this.expandedLabels.values()])l.hide();return;}
        this.updateEmptyState();
        // GNOME can retain the indicator's busy flag across overview rebuilds
        // even after the adjustment has settled. Its state machine then never
        // removes old thumbnails or finishes adding new ones.
        if(box._animatingIndicator&&box._scrollAdjustment.value===global.workspace_manager.get_active_workspace_index())box._updateIndicator();
        const [x,y]=box.get_transformed_position(),[width,height]=box.get_transformed_size();
        const m=Main.layoutManager.primaryMonitor;
        const [pointerX,pointerY]=global.get_pointer();
        const compactHeight=36*scale;
        const edgeBottom=this.spacesExpanded?y+height+12*scale:m.y+compactHeight;
        if(!this.stripHoverArmed&&this.stripOpenPointer){
            const [sx,sy]=this.stripOpenPointer;
            this.stripHoverArmed=Math.abs(pointerX-sx)+Math.abs(pointerY-sy)>3*scale||pointerY>m.y+compactHeight;
        }
        this.spacesExpanded=!Main.overview.animationInProgress&&this.stripHoverArmed&&pointerX>=m.x&&pointerX<m.x+m.width&&pointerY>=m.y&&pointerY<=edgeBottom;
        const expanded=this.spacesExpanded;
        // OverviewControls also animates opacity during entry. Clip the compact
        // strip instead of competing with its opacity writes every frame.
        if(expanded)box.remove_clip();else box.set_clip(0,0,0,0);
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
                this.hideWorkspaceBackground(bg);
                for(const preview of ws._windows??[])this.decorateWindow(preview,scale);
            }
        }
        this.syncWorkspaceBackgrounds();
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
        for(const t of box._thumbnails){
            const workspace=t.metaWorkspace;if(workspace.index()<0)continue;
            const full=[...this.spaces].find(([,entry])=>entry.space===workspace);
            const title=full?(Shell.WindowTracker.get_default().get_window_app(full[0])?.get_name()??full[0].get_title()):`Desktop ${++desktopNumber}`;
            this.ensureSpaceLabels(workspace,title);
        }
        const compactWidths=box._thumbnails.filter(t=>t.metaWorkspace.index()>=0).map(t=>{const l=this.labels.get(t.metaWorkspace);return (l?.get_preferred_width(-1)[1]??90*scale)+20*scale;});
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
            const label=this.labels.get(ws),caption=this.expandedLabels.get(ws);
            const full=[...this.spaces].find(([,entry])=>entry.space===ws);
            if(b._fmFullscreen!==!!full){
                b._fmFullscreen=!!full;
                if(full){const path=Main.extensionManager.lookup('macbook-menu@local').stateObj.path;b.child.gicon=new Gio.FileIcon({file:Gio.File.new_for_path(GLib.build_filenamev([path,'icons','fullscreen-exit-symbolic.svg']))});}
                else {b.child.gicon=null;b.child.icon_name='window-close-symbolic';}
            }
            b.accessible_name=full?'Exit Full Screen':'Close Desktop';
            const [,lw]=label.get_preferred_width(-1),[,lh]=label.get_preferred_height(-1);
            const [,cw]=caption.get_preferred_width(-1),[,ch]=caption.get_preferred_height(-1);
            label.set_size(lw,lh);caption.set_size(cw,ch);
            // Each mode owns its label. Never animate text from the compact
            // strip into the thumbnail row; captions follow their own preview.
            const ready=t.state===WorkspaceThumbnail.ThumbnailState.NORMAL&&tw>0&&th>0;
            label.remove_all_transitions();caption.remove_all_transitions();
            label.set_position(compactX+10*scale,m.y+(compactHeight-lh)/2);
            caption.set_position(tx+(tw-cw)/2,ty+th+4*scale);
            label.visible=ready&&!expanded;
            caption.visible=ready&&expanded;
            caption.opacity=box.opacity;
            compactX+=compactWidths[compactIndex++];
            const hover=px>=tx-8*scale&&px<=tx+tw&&py>=ty-8*scale&&py<=ty+th;
            b.visible=ready && expanded && global.workspace_manager.n_workspaces>1 && (!!(mods&Clutter.ModifierType.MOD1_MASK)||hover);
        }
        for(const [ws,b] of this.buttons)if(!seen.has(ws)){b.destroy();this.buttons.delete(ws);this.labels.get(ws)?.destroy();this.labels.delete(ws);this.expandedLabels.get(ws)?.destroy();this.expandedLabels.delete(ws);}
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
        const selected=this.hoverReady&&!this.workspaceSwitchInProgress()&&!Main.overview.animationInProgress&&!this.leavingOverview&&preview.mapped&&px>=x&&px<=x+w&&py>=y&&py<=y+h;
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
    stopUi(){this.clearWorkspaceSwipeSurfaces();this.emptyState?.hide();this.clearWindowDecorations();if(this.panelState){Main.panel.opacity=this.panelState.opacity;Main.panel.reactive=this.panelState.reactive;for(const [b,visible] of this.panelState.boxes)b.visible=visible;this.panelState=null;}Main.messageTray._updateState();this.wallpaper?.hide();this.spaceStrip?.hide();for(const [bg,v] of this.hiddenBackgrounds){bg.opacity=v.opacity;bg.disconnect(v.id);}this.hiddenBackgrounds.clear();this.hidePreview();if(this.uiTimer){GLib.source_remove(this.uiTimer);this.uiTimer=0;}this.plus.hide();for(const b of this.buttons.values())b.hide();for(const l of [...this.labels.values(),...this.expandedLabels.values()])l.hide();}
    destroy(){
        this.stopUi();this.emptyState?.destroy();for(const manager of this.wallpaperManagers)manager.destroy();this.wallpaper.destroy();this.spaceStrip.destroy();this.overviewActor.set_style(this.overviewStyle);this.searchBin.disconnect(this.searchVisibleSignal);this.searchBin.opacity=this.searchOpacity;this.searchBin.reactive=this.searchReactive;this.searchBin.visible=this.searchWasVisible;for(const [o,id] of this.signals)o.disconnect(id);
        for(const [w,ids] of this.windows)for(const id of ids)w.disconnect(id);
        for(const id of this.sources)GLib.source_remove(id);this.sources.clear();
        this.previewBackground.destroy();this.preview.destroy();this.previewHint.destroy();this.plus.destroy();for(const b of this.buttons.values())b.destroy();for(const l of [...this.labels.values(),...this.expandedLabels.values()])l.destroy();
        // Restore managed fullscreen spaces without closing any application.
        for(const [w,{home,space}] of this.spaces){
            if(w.get_compositor_private()){w.unmake_fullscreen();w.change_workspace(home.index()>=0?home:global.workspace_manager.get_workspace_by_index(0));}
            if(space.index()>=0 && global.workspace_manager.n_workspaces>1 && !space.list_windows().some(v=>v!==w&&!v.is_on_all_workspaces()))global.workspace_manager.remove_workspace(space,global.get_current_time());
        }
        this.spaces.clear();
        for(const [t,{bg,signal}] of this.thumbBackgrounds){t.disconnect(signal);bg.destroy();}this.thumbBackgrounds.clear();
        this.thumbnails.remove_all_transitions();this.thumbnails.remove_clip();this.thumbnails.translation_y=0;this.thumbnails.opacity=255;this.thumbnails.reactive=true;this.thumbnails.set_style(this.thumbnailStyle);this.injections.clear();Main.messageTray._updateState();this.thumbnails._maxThumbnailScale=this.thumbnailScale;this.thumbnails._updateShouldShow();this.thumbnails.queue_relayout();
        if(this.wasDynamic)this.mutter.set_boolean('dynamic-workspaces',true);
    }
}
