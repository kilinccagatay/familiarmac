import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

// Share the native workspace groups' motion, including touchpad overscroll.
// Clone the panel child, not its opacity-hidden chrome container. Never move
// or reparent the real panel: that would change struts and popup coordinates.
export class WorkspacePanel {
    constructor() {
        this.injections=new InjectionManager();
        this.state=null;
        const owner=this,prototype=Object.getPrototypeOf(Main.wm._workspaceAnimation);
        this.injections.overrideMethod(prototype,'_prepareWorkspaceSwitch',original=>function(...args){
            const result=original.apply(this,args);
            owner.attach(this._switchData);
            return result;
        });
        this.injections.overrideMethod(prototype,'_finishWorkspaceSwitch',original=>function(...args){
            owner.clear();
            return original.apply(this,args);
        });
    }
    attach(data) {
        if(!data||this.state?.data===data)return;
        this.clear();
        const panel=Main.layoutManager.panelBox;
        if(!panel.visible||!panel.opacity||Main.overview.visible)return;
        const monitor=data.monitors.find(m=>m.index===Main.layoutManager.primaryIndex);
        if(!monitor)return;
        const state={data,panel,opacity:panel.opacity,clones:[]};
        this.state=state;
        try {
            for(const group of monitor._workspaceGroups) {
                // A fullscreen Space keeps its menu hidden until edge reveal.
                if(group.workspace.list_windows().some(w=>w.get_monitor()===monitor.index&&w.is_fullscreen()))continue;
                const clone=new Clutter.Clone({source:Main.panel,reactive:false,
                    x:panel.x-monitor._monitor.x,y:panel.y-monitor._monitor.y,
                    width:Main.panel.width,height:Main.panel.height});
                group.add_child(clone);state.clones.push(clone);
            }
            panel.opacity=0;
        } catch(error) {
            this.clear();
            console.error(`Workspace panel: ${error}`);
        }
    }
    clear() {
        const state=this.state;if(!state)return;
        this.state=null;
        state.panel.opacity=state.opacity;
        for(const clone of state.clones)clone.destroy();
    }
    destroy() {this.clear();this.injections.clear();}
}
