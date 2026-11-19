import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Native FINGER scroll lets the application own overscroll, reversal and history
// navigation. No overlay and no additional back/forward shortcut on release.
export class MagicMousePageSwipe {
    constructor() {
        this.state=null;this.pointer=null;this.timer=0;
        this.focusSignal=global.display.connect('notify::focus-window',()=>this.cancel());
    }
    allowed() {
        const mask=global.get_pointer()[2];
        const blocked=Clutter.ModifierType;
        return !Main.sessionMode.isLocked&&Main.sessionMode.hasWindows&&
            !Main.overview.visible&&Boolean(Main.actionMode&Shell.ActionMode.NORMAL)&&
            !(mask&(blocked.CONTROL_MASK|blocked.MOD1_MASK|blocked.SUPER_MASK|
                blocked.SHIFT_MASK|blocked.BUTTON1_MASK|blocked.BUTTON2_MASK|blocked.BUTTON3_MASK));
    }
    emit(dx,finish=false) {
        this.pointer??=Clutter.get_default_backend().get_default_seat()
            .create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
        // Virtual pointers retain their own coordinates. Without synchronizing
        // them, scroll events target the screen origin rather than the app under
        // the real mouse, even though the seat cursor is visibly over Chrome.
        const [x,y]=global.get_pointer();
        if(this.pointerX!==x||this.pointerY!==y){
            this.pointer.notify_absolute_motion(GLib.get_monotonic_time(),x,y);
            this.pointerX=x;this.pointerY=y;
        }
        this.pointer.notify_scroll_continuous(GLib.get_monotonic_time(),dx,0,
            Clutter.ScrollSource.FINGER,finish?Clutter.ScrollFinishFlags.HORIZONTAL:Clutter.ScrollFinishFlags.NONE);
    }
    handle(p) {
        if(p?.type!=='page-swipe'||!['begin','update','end','cancel'].includes(p.phase)||
            !Number.isSafeInteger(p.id)||!Number.isFinite(p.dx)||Math.abs(p.dx)>8192||typeof p.natural!=='boolean')return;
        if(!this.allowed()){this.cancel();return;}
        if(p.phase==='begin') {
            this.cancel();
            const window=global.display.focus_window;
            if(!window)return;
            // Ignore recognition slop instead of jumping by the initial distance.
            this.state={id:p.id,window,last:p.dx,total:0,natural:p.natural,time:GLib.get_monotonic_time()};
            this.timer=GLib.timeout_add(GLib.PRIORITY_DEFAULT,100,()=>{
                if(!this.state||!this.allowed()||GLib.get_monotonic_time()-this.state.time>1500000){
                    this.cancel();return GLib.SOURCE_REMOVE;
                }
                return GLib.SOURCE_CONTINUE;
            });
            return;
        }
        const s=this.state;
        if(!s||s.id!==p.id)return;
        if(p.phase==='cancel'||s.window!==global.display.focus_window||s.natural!==p.natural){this.cancel();return;}
        s.time=GLib.get_monotonic_time();
        const dx=(p.dx-s.last)*.15*(s.natural?-1:1);s.last=p.dx;
        if(dx){this.emit(dx);s.total+=dx;}
        if(p.phase==='end')this.finish();
    }
    finish() {
        if(this.timer){GLib.source_remove(this.timer);this.timer=0;}
        if(this.state&&this.pointer)this.emit(0,true);
        this.state=null;
    }
    cancel() {
        // Undo an interrupted gesture only while its original surface is focused.
        // Never inject a compensating scroll into a newly focused application.
        const s=this.state;
        if(s&&s.window===global.display.focus_window&&this.allowed()&&s.total)this.emit(-s.total);
        this.finish();
    }
    destroy() {
        this.cancel();global.display.disconnect(this.focusSignal);this.pointer=null;
    }
}
