import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Match application identity, never the document title. Unsupported apps get no
// synthetic shortcuts. This is document zoom, not macOS's semantic fit-to-column.
export function supportsDocumentZoom(identity) {
    return /(?:firefox|chromium|chrome|brave|vivaldi|microsoft-edge|epiphany|evince|papers|okular|chatgpt)/i.test(identity);
}

export class MagicMouseActions {
    constructor() {
        this.zoomed=new WeakSet();
        this.keyboard=null;
    }
    swipeAllowed() {
        // Streaming bypasses SwipeTracker's event filter. Apply the same
        // action-mode policy here, including while a gesture is in progress.
        const mode=Main.overview.visible?Shell.ActionMode.OVERVIEW:Shell.ActionMode.NORMAL;
        return !Main.sessionMode.isLocked&&Main.sessionMode.hasWorkspaces&&Boolean(Main.actionMode&mode);
    }
    workspace(direction) {
        if(Main.sessionMode.isLocked||!Main.sessionMode.hasWorkspaces)return;
        const manager=global.workspace_manager;
        const current=manager.get_active_workspace();
        const index=current.index()+(direction==='previous-space'?-1:1);
        if(index<0||index>=manager.n_workspaces)return;
        Main.wm.actionMoveWorkspace(manager.get_workspace_by_index(index));
    }
    isOuterEdge(dx,natural){
        const manager=global.workspace_manager,index=manager.get_active_workspace().index();
        const direction=Math.sign(dx)*(natural?-1:1);
        return (direction<0&&index===0)||(direction>0&&index===manager.n_workspaces-1);
    }
    beginEdge(packet){
        const actor=global.window_group;
        if(!actor)return false;
        this.edgeState={id:packet.id,startDx:packet.dx,natural:packet.natural,
            actor,origin:actor.translation_x,target:0,rendered:0,last:GLib.get_monotonic_time(),frame:GLib.get_monotonic_time()};
        this.edgeTimeline=new Clutter.Timeline({actor:global.stage,duration:1000,repeat_count:-1});
        this.edgeTimeline.connect('new-frame',()=>{
            const s=this.edgeState;if(!s)return;
            const now=GLib.get_monotonic_time();
            if(!this.swipeAllowed()||Main.overview.visible||now-s.last>1500000){this.finishEdge();return;}
            const dt=Math.min(50,Math.max(0,(now-s.frame)/1000));s.frame=now;
            s.rendered+=(s.target-s.rendered)*(1-Math.exp(-dt/16));
            s.actor.translation_x=s.origin+s.rendered;
        });
        this.edgeTimeline.start();return true;
    }
    finishEdge(animate=false){
        const s=this.edgeState;if(!s)return;
        this.edgeState=null;this.edgeTimeline?.stop();this.edgeTimeline=null;
        this.edgeReturn=s;
        if(animate)s.actor.ease({translation_x:s.origin,duration:180,mode:Clutter.AnimationMode.EASE_OUT_CUBIC,
            onComplete:()=>{if(this.edgeReturn===s)this.edgeReturn=null;}});
        else {s.actor.translation_x=s.origin;this.edgeReturn=null;}
    }
    clearEdgeReturn(){
        if(!this.edgeReturn)return;
        this.edgeReturn.actor.remove_transition('translation-x');
        this.edgeReturn.actor.translation_x=this.edgeReturn.origin;this.edgeReturn=null;
    }
    swipe(packet) {
        if(packet?.type!=='workspace-swipe'||!['begin','update','end','cancel'].includes(packet.phase)||!Number.isFinite(packet.dx)||Math.abs(packet.dx)>8192||!Number.isInteger(packet.id))return;
        if(!this.swipeAllowed()){this.cancelSwipe();return;}
        if(packet.phase==='begin'){
            this.finishEdge();this.clearEdgeReturn();
        }
        const edge=this.edgeState;
        if(edge&&edge.id===packet.id){
            if(Main.sessionMode.isLocked||Main.overview.visible){this.finishEdge();return;}
            const dx=packet.dx-edge.startDx;
            if(packet.phase==='end'||packet.phase==='cancel'){this.finishEdge(true);return;}
            if(Math.abs(packet.dx)>140&&!this.isOuterEdge(packet.dx,edge.natural)){
                // Reversing toward a real neighbour resumes the native gesture.
                this.finishEdge();
                this.swipe({...packet,phase:'begin',dx:edge.startDx,natural:edge.natural,_edgeReversal:true});
                this.swipe(packet);return;
            }
            const displacement=dx*(edge.natural?1:-1);
            edge.target=Math.sign(displacement)*48*(1-Math.exp(-Math.abs(displacement)/500));
            edge.last=GLib.get_monotonic_time();return;
        }
        const overview=Main.overview.visible;
        const controller=overview?Main.overview._overview.controls._workspacesDisplay:Main.wm._workspaceAnimation;
        if(Main.sessionMode.isLocked||Main.overview.animationInProgress||!Main.sessionMode.hasWorkspaces){this.cancelSwipe();return;}
        if(packet.phase==='begin'){
            this.cancelSwipe();
            // Never take over a touchpad gesture or an already settling switch.
            if((overview?(controller?._gestureActive||controller?._scrollAdjustment.get_transition('value')):controller?._switchData)||typeof controller?._switchWorkspaceBegin!=='function')return;
            if(!overview&&!packet._edgeReversal&&this.isOuterEdge(packet.dx,packet.natural)&&this.beginEdge(packet))return;
            const tracker=controller._swipeTracker;
            let confirmed;
            const adapter={confirmSwipe(_distance,points,progress,cancel){confirmed={points,progress,cancel};}};
            controller._switchWorkspaceBegin(adapter,Main.layoutManager.primaryIndex);
            if(!confirmed||(!overview&&!controller._switchData))return;
            this.swipeState={id:packet.id,overview,controller,data:controller._switchData,tracker,enabled:tracker.enabled,
                ...confirmed,startDx:packet.dx,last:GLib.get_monotonic_time(),lastProgress:confirmed.progress,rendered:confirmed.progress,frameTime:GLib.get_monotonic_time(),motionTime:GLib.get_monotonic_time(),velocity:0};
            if(!overview)controller._switchData.gestureActivated=true;
            tracker.enabled=false;
            this.swipeTimeline=new Clutter.Timeline({actor:global.stage,duration:1000,repeat_count:-1});
            this.swipeTimeline.connect('new-frame',()=>{
                const state=this.swipeState;
                if(!state)return;
                if(!this.swipeAllowed()){this.cancelSwipe();return;}
                if(!this.swipeValid(state)){this.finishSwipe(false);return;}
                const time=GLib.get_monotonic_time();
                const dt=Math.min(50,Math.max(0,(time-state.frameTime)/1000));state.frameTime=time;
                // Sensor reports arrive in bursts, not at display refresh times.
                // A short time-based filter removes jitter without a long tail.
                state.rendered+=(state.lastProgress-state.rendered)*(1-Math.exp(-dt/16));
                if(Math.abs(state.lastProgress-state.rendered)<.0002)state.rendered=state.lastProgress;
                state.controller._switchWorkspaceUpdate(state.tracker,state.rendered);
            });
            this.swipeTimeline.start();
            this.swipeWatchdog=GLib.timeout_add(GLib.PRIORITY_DEFAULT,250,()=>{
                if(this.swipeState&&GLib.get_monotonic_time()-this.swipeState.last>1500000)this.cancelSwipe();
                return this.swipeState?GLib.SOURCE_CONTINUE:GLib.SOURCE_REMOVE;
            });
        }
        const s=this.swipeState;
        if(!s||s.id!==packet.id)return;
        if(!this.swipeValid(s)){this.finishSwipe(false);return;}
        const now=GLib.get_monotonic_time();
        const delta=(packet.dx-s.startDx)/960*(packet.natural?-1:1);
        const low=Math.max(Math.min(...s.points),s.cancel-1),high=Math.min(Math.max(...s.points),s.cancel+1);
        const progress=Math.max(low,Math.min(high,s.cancel+delta));
        // Release/heartbeat packets repeat the last displacement. They must
        // not erase flick velocity; a real pause still cancels that momentum.
        const elapsed=(now-s.motionTime)/1000000;
        if(progress!==s.lastProgress&&elapsed>.001){
            const instantaneous=(progress-s.lastProgress)/elapsed;
            s.velocity=elapsed>.1?instantaneous:s.velocity*.35+instantaneous*.65;
            s.motionTime=now;
        }else if(elapsed>.1)s.velocity=0;
        s.last=now;s.lastProgress=progress;

        if(packet.phase==='end'||packet.phase==='cancel'){
            const distance=progress-s.cancel;
            let target=s.cancel;
            if(packet.phase==='end'&&(Math.abs(distance)>.28||(Math.abs(distance)>.08&&Math.abs(s.velocity)>.7)))
                target=Math.max(low,Math.min(high,s.cancel+Math.sign(distance)));
            this.finishSwipe(true,target);
        }
    }
    swipeValid(state){
        return state.overview?Main.overview.visible&&!Main.overview.animationInProgress&&state.controller._gestureActive:
            !Main.overview.visible&&state.controller._switchData===state.data;
    }
    finishSwipe(animate=true,target=null) {
        const s=this.swipeState;if(!s)return;
        this.swipeState=null;
        this.swipeTimeline?.stop();this.swipeTimeline=null;
        if(this.swipeWatchdog){GLib.source_remove(this.swipeWatchdog);this.swipeWatchdog=0;}
        if(animate&&this.swipeValid(s))
            s.controller._switchWorkspaceEnd(s.tracker,180,target??s.cancel);
        else if(s.overview&&s.controller._gestureActive)s.controller._endTouchGesture();
        s.tracker.enabled=s.enabled;
    }
    cancelSwipe(){this.finishEdge();this.clearEdgeReturn();this.finishSwipe(true);}
    zoom() {
        if(Main.sessionMode.isLocked||Main.overview.visible)return false;
        const window=global.display.focus_window;
        if(!window)return false;
        const app=Shell.WindowTracker.get_default().get_window_app(window);
        const identity=[app?.get_id(),window.get_wm_class(),window.get_gtk_application_id()].join(' ');
        if(!supportsDocumentZoom(identity))return false;
        // Never combine with a physically held modifier or mouse drag.
        const mask=global.get_pointer()[2];
        if(mask&(Clutter.ModifierType.SHIFT_MASK|Clutter.ModifierType.CONTROL_MASK|Clutter.ModifierType.MOD1_MASK|Clutter.ModifierType.SUPER_MASK|Clutter.ModifierType.BUTTON1_MASK|Clutter.ModifierType.BUTTON2_MASK|Clutter.ModifierType.BUTTON3_MASK))return false;
        this.keyboard??=Clutter.get_default_backend().get_default_seat().create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        const out=this.zoomed.has(window);
        const key=out?Clutter.KEY_KP_Subtract:Clutter.KEY_KP_Add;
        const send=(k,state)=>this.keyboard.notify_keyval(GLib.get_monotonic_time(),k,state);
        send(Clutter.KEY_Control_L,Clutter.KeyState.PRESSED);
        try {
            for(let i=0;i<2;i++){
                send(key,Clutter.KeyState.PRESSED);
                send(key,Clutter.KeyState.RELEASED);
            }
        } finally {send(Clutter.KEY_Control_L,Clutter.KeyState.RELEASED);}
        if(out)this.zoomed.delete(window);else this.zoomed.add(window);
        return true;
    }
    destroy(){this.cancelSwipe();this.keyboard=null;this.zoomed=new WeakSet();}
}
