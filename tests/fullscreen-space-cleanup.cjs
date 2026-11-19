const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let callbacks=[],removed=0,activated=0;
const context={Meta:{WindowType:{DESKTOP:1}},GLib:{PRIORITY_DEFAULT:0,SOURCE_REMOVE:0,timeout_add:(_p,_t,fn)=>(callbacks.push(fn),callbacks.length)},global:{get_current_time:()=>1,workspace_manager:null}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/missionControl.js','utf8').replace(/^import .*;$/gm,'').replace('export class MissionControl','this.MissionControl=class MissionControl').replace(/^export /gm,''),context);
const window=(extra={})=>({is_on_all_workspaces:()=>false,get_window_type:()=>0,...extra});
const ding=window({customJS_ding:{hideFromWindowList:true,keepAtBottom:true}});
const home={index:()=>0,activate:()=>activated++};let occupants=[];
const space={index:()=>1,list_windows:()=>occupants};
context.global.workspace_manager={n_workspaces:2,get_active_workspace:()=>space,remove_workspace:s=>{assert.equal(s,space);removed++;}};
const departing=window({get_compositor_private:()=>({}),change_workspace:s=>assert.equal(s,home)});
function leave(extra=[],closed=false){
 const m=Object.create(context.MissionControl.prototype);m.spaces=new Map([[departing,{home,space}]]);m.sources=new Set();m.restoreFrames=new Map();m.prepareFullscreenSwitch=()=>{};m.later=fn=>fn();occupants=[departing,...extra];m.leave(departing,closed);callbacks.shift()();
}
leave([ding]);assert.equal(removed,1,'Delayed DING desktop migration must not leak a fullscreen Space');
leave([window({get_window_type:()=>1})],true);assert.equal(removed,2,'Closing fullscreen also ignores native desktop surfaces');
leave([window({skip_taskbar:true})]);assert.equal(removed,2,'Preserve genuine dialogs, including skip-taskbar windows');
leave([window({customJS_ding:{hideFromWindowList:true,keepAtBottom:false}})]);assert.equal(removed,2,'Preserve DING dialogs/previews');
for(let i=0;i<5;i++)leave([ding]);assert.equal(removed,7,'Repeated fullscreen cycles must each clean their own Space');
assert.equal(activated,9);
console.log('Fullscreen Space cleanup: delayed desktop surfaces, repeated cycles, close and dialog preservation PASS');
