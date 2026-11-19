import {ownsFullscreen, requestNativeFullscreen} from './nativeFullscreen.js';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

// A compositor-owned reveal works for native, Flatpak and exported app menus.
// It never changes the application's size or reserves additional desktop space.
export class FullscreenControls {
    constructor(){
        this.signals=[];this.target=null;this.revealed=false;this.lastInside=0;
        this.panelStyle=Main.layoutManager.panelBox.get_style();
        this.injections=new InjectionManager();
        const owner=this;
        this.injections.overrideMethod(Object.getPrototypeOf(Main.layoutManager),'_updateActorVisibility',original=>function(data){
            original.call(this,data);
            if(data.actor===this.panelBox&&owner.revealed&&owner.target&&!Main.overview.visible&&!Main.sessionMode.isLocked)data.actor.show();
        });
        this.bar=new St.BoxLayout({reactive:true,style:'background-color: rgba(40,40,42,0.98); padding: 0 10px; spacing: 8px;'});
        this.close=this.button('#ff5f57','Close Window',()=>this.target?.delete(global.get_current_time()));
        this.minimize=this.button('#febc2e','Minimize Window',()=>{const w=this.target;if(w){if(!ownsFullscreen(w))w.unmake_fullscreen();w.minimize();}});
        this.restore=this.button('#28c840','Exit Full Screen',()=>{if(ownsFullscreen(this.target))requestNativeFullscreen(this.target,false);else this.target?.unmake_fullscreen();});
        this.title=new St.Label({y_align:Clutter.ActorAlign.CENTER,x_expand:true,x_align:Clutter.ActorAlign.CENTER,style:'color: white; font-size: 10pt;'});this.bar.add_child(this.title);
        Main.layoutManager.addChrome(this.bar,{affectsStruts:false,trackFullscreen:false});Main.uiGroup.set_child_below_sibling(this.bar,Main.layoutManager.panelBox);this.bar.hide();
        for(const [object,event] of [[global.display,'in-fullscreen-changed'],[global.display,'notify::focus-window'],[global.workspace_manager,'active-workspace-changed'],[Main.layoutManager,'monitors-changed'],[Main.overview,'showing'],[Main.overview,'hidden'],[Main.sessionMode,'updated']]){
            this.signals.push([object,object.connect(event,()=>this.refresh())]);
        }
        this.refresh();
    }
    button(color,label,action){
        const button=new St.Button({reactive:true,can_focus:true,accessible_name:label,y_align:Clutter.ActorAlign.CENTER,style:`width: 14px; height: 14px; min-width: 14px; min-height: 14px; padding: 0; border-width: 0; border-radius: 99px; background-color: ${color}; box-shadow: none;`});
        button.connect('clicked',action);this.bar.add_child(button);return button;
    }
    candidate(){
        if(Main.overview.visible||Main.sessionMode.isLocked||!Main.sessionMode.hasWindows)return null;
        const wm=global.workspace_manager,ws=wm.get_active_workspace();
        const eligible=w=>w&&w.get_compositor_private()&&w.is_fullscreen()&&!w.minimized&&w.get_monitor()===Main.layoutManager.primaryIndex&&(w.is_on_all_workspaces()||w.get_workspace()===ws);
        if(eligible(global.display.focus_window))return global.display.focus_window;
        if(eligible(this.target))return this.target;
        return global.display.sort_windows_by_stacking(global.get_window_actors().map(a=>a.meta_window)).reverse().find(eligible)??null;
    }
    refresh(){
        const next=this.candidate();
        if(next!==this.target){this.hide(true);this.target=next;this.nativeReveal=this.nativeSettings(next);}
        if(this.target){
            if(!this.timer)this.timer=GLib.timeout_add(GLib.PRIORITY_DEFAULT,50,()=>{this.poll();return GLib.SOURCE_CONTINUE;});
            this.poll();
        }else{
            if(this.timer){GLib.source_remove(this.timer);this.timer=0;}
            this.hide(true);
        }
    }
    nativeSettings(window){
        if(!window)return null;
        try {
            const [ok,bytes]=GLib.file_get_contents(`/proc/${window.get_pid()}/environ`);
            const entry=ok&&new TextDecoder().decode(bytes).split('\0').find(x=>x.startsWith('FAMILIARMAC_FULLSCREEN_SCHEMAS='));
            if(!entry)return null;
            const source=Gio.SettingsSchemaSource.new_from_directory(entry.slice(entry.indexOf('=')+1),Gio.SettingsSchemaSource.get_default(),false);
            const schema=source.lookup('org.familiarmac.fullscreen',false);
            return schema?new Gio.Settings({settings_schema:schema}):null;
        } catch (_) {return null;}
    }
    poll(){
        if(!this.target?.get_compositor_private()||!this.target.is_fullscreen()){this.refresh();return;}
        const monitor=Main.layoutManager.primaryMonitor,scale=St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const [x,y]=global.get_pointer(),now=GLib.get_monotonic_time();
        const inWidth=x>=monitor.x&&x<monitor.x+monitor.width;
        const edge=inWidth&&y>=monitor.y&&y<=monitor.y+2;
        const inside=inWidth&&y>=monitor.y&&y<monitor.y+Main.layoutManager.panelBox.height+32*scale+4*scale;
        const focus=global.stage.get_key_focus();
        const menuOpen=(this.nativeReveal?.get_uint('popup-pid')===this.target.get_pid())||Main.panel.menuManager.activeMenu?.isOpen||!!(focus&&this.bar.contains(focus));
        if(edge||this.revealed&&(inside||menuOpen)){this.lastInside=now;this.show();}
        else if(this.revealed&&now-this.lastInside>220000)this.hide(false);
    }
    show(){
        const panel=Main.layoutManager.panelBox,m=Main.layoutManager.primaryMonitor,scale=St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this.bar.set_style(`background-color: #28282a; padding: ${this.nativeReveal?0:panel.height/scale}px 10px 0; spacing: 8px;`);
        this.bar.set_position(m.x,m.y);this.bar.set_size(m.width,panel.height+(this.nativeReveal?0:32*scale));
        for(const child of [this.close,this.minimize,this.restore,this.title])child.visible=!this.nativeReveal;
        this.close.reactive=this.target.can_close();this.minimize.reactive=this.target.can_minimize();
        this.title.text=Shell.WindowTracker.get_default().get_window_app(this.target)?.get_name()??this.target.get_title();
        if(this.revealed)return;
        this.revealed=true;
        if(this.nativeReveal){this.nativeReveal.set_uint('panel-height',Math.round(panel.height/scale));this.nativeReveal.set_uint('reveal-pid',this.target.get_pid());}
        panel.set_style(`${this.panelStyle??''}; background-color: rgba(40,40,42,0.98);`);
        panel.remove_all_transitions();this.bar.remove_all_transitions();
        panel.translation_y=-panel.height;panel.show();this.bar.translation_y=-32*scale;this.bar.opacity=0;this.bar.show();
        panel.ease({translation_y:0,duration:160,mode:Clutter.AnimationMode.EASE_OUT_QUAD});
        this.bar.ease({translation_y:0,opacity:255,duration:160,mode:Clutter.AnimationMode.EASE_OUT_QUAD});
    }
    hide(immediate){
        const panel=Main.layoutManager.panelBox;
        this.revealed=false;if(this.nativeReveal)this.nativeReveal.set_uint('reveal-pid',0);panel.remove_all_transitions();this.bar.remove_all_transitions();
        const finish=()=>{this.bar.hide();panel.set_style(this.panelStyle);panel.translation_y=0;Main.layoutManager._updateVisibility();};
        if(immediate||!this.bar.visible){finish();return;}
        panel.ease({translation_y:-panel.height,duration:130,mode:Clutter.AnimationMode.EASE_IN_QUAD});
        this.bar.ease({opacity:0,translation_y:-this.bar.height,duration:130,mode:Clutter.AnimationMode.EASE_IN_QUAD,onComplete:finish});
    }
    destroy(){
        if(this.timer)GLib.source_remove(this.timer);this.timer=0;
        for(const [o,id] of this.signals)o.disconnect(id);
        this.hide(true);this.injections.clear();Main.layoutManager.removeChrome(this.bar);this.bar.destroy();Main.layoutManager._updateVisibility();
    }
}
