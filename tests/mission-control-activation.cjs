const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let activated=0,hidden=0;
class Thumbnail {activate(time){this.metaWorkspace.activate(time)}}
const ctx={WorkspaceThumbnail:{WorkspaceThumbnail:Thumbnail,ThumbnailState:{NORMAL:4}},Main:{overview:{hide(){hidden++}}}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/missionControl.js','utf8').replace(/^import .*;$/gm,'').replace('export class MissionControl','this.MissionControl=class MissionControl').replace(/^export /gm,''),ctx);
const owner=Object.create(ctx.MissionControl.prototype);
owner.injections={overrideMethod(proto,key,wrapper){proto[key]=wrapper(proto[key])}};
owner.installSpaceActivation();
const t=new Thumbnail();t.state=4;t.metaWorkspace={index:()=>1,activate(){activated++}};
t.activate(1);assert.equal(activated,1);assert.equal(hidden,1);
t.state=5;t.activate(2);assert.equal(activated,1);assert.equal(hidden,1);
owner.activateSpace(t.metaWorkspace,3);assert.equal(activated,2);assert.equal(hidden,2);
owner.leavingOverview=true;owner.activateSpace(t.metaWorkspace,4);assert.equal(activated,2);
console.log('Desktop preview and caption select then dismiss; removed and leaving states ignored PASS');
const adjustment={value:0,get_transition:()=>null};
owner.controls={_workspacesDisplay:{_scrollAdjustment:adjustment,_gestureActive:false}};
assert.equal(owner.workspaceSwitchInProgress(),false);
owner.controls._workspacesDisplay._gestureActive=true;
assert.equal(owner.workspaceSwitchInProgress(),true);
owner.controls._workspacesDisplay._gestureActive=false;
adjustment.value=.4;assert.equal(owner.workspaceSwitchInProgress(),true);
adjustment.value=1;adjustment.get_transition=()=>({});
assert.equal(owner.workspaceSwitchInProgress(),true);
adjustment.get_transition=()=>null;assert.equal(owner.workspaceSwitchInProgress(),false);
console.log('Hover guard covers held gesture, fractional position and settling animation PASS');

// Native visibility refreshes during exit must not reveal neighboring previews.
class View {
 constructor(workspaces){this._workspaces=workspaces;}
 _updateVisibility(){for(const w of this._workspaces)w.visible=true;}
 _getSpacing(){return 12;}
 _updateWorkspacesState(){}
}
const active={};ctx.global={workspace_manager:{get_active_workspace:()=>active}};
ctx.WorkspacesView={WorkspacesView:View};
owner.installWorkspaceSwipeLayout();
const windows=[{metaWorkspace:{},visible:true,hide(){this.visible=false;}},
 {metaWorkspace:active,visible:true,hide(){this.visible=false;}}];
const view=new View(windows);
owner.leavingOverview=true;
view._updateVisibility();assert.equal(windows[0].visible,false);assert.equal(windows[1].visible,true);
view._updateVisibility();assert.equal(windows[0].visible,false,'Settling callbacks cannot reshow the old desktop');
owner.leavingOverview=false;view._updateVisibility();assert(windows.every(w=>w.visible),'Next overview restores normal swipe neighbors');
console.log('Overview exit hides only inactive workspace previews and restores normal visibility on re-entry PASS');
