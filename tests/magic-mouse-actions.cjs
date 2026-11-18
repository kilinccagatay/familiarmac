const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let mask=0,identity='firefox.desktop',overview=false,index=0,moved=[],keys=[],window={get_wm_class:()=>'',get_gtk_application_id:()=>''};
const ctx={Clutter:{ModifierType:{SHIFT_MASK:1,CONTROL_MASK:4,MOD1_MASK:8,SUPER_MASK:16,BUTTON1_MASK:256,BUTTON2_MASK:512,BUTTON3_MASK:1024},KEY_Control_L:10,KEY_KP_Add:11,KEY_KP_Subtract:12,KeyState:{PRESSED:1,RELEASED:0},InputDeviceType:{KEYBOARD_DEVICE:1},get_default_backend:()=>({get_default_seat:()=>({create_virtual_device:()=>({notify_keyval(_t,k,s){keys.push([k,s])}})})})},GLib:{get_monotonic_time:()=>100},Shell:{WindowTracker:{get_default:()=>({get_window_app:()=>({get_id:()=>identity})})}},Main:{sessionMode:{isLocked:false,hasWorkspaces:true},overview:{get visible(){return overview}},wm:{actionMoveWorkspace(w){moved.push(w)}}},global:{display:{get focus_window(){return window}},get_pointer:()=>[0,0,mask],workspace_manager:{n_workspaces:3,get_active_workspace:()=>({index:()=>index}),get_workspace_by_index:i=>i}}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/magicMouseActions.js','utf8').replace(/^import .*;$/gm,'').replace('export class MagicMouseActions','this.MagicMouseActions=class MagicMouseActions').replace(/^export /gm,''),ctx);
const a=new ctx.MagicMouseActions();
a.workspace('previous-space');assert.deepEqual(moved,[]);
a.workspace('next-space');assert.deepEqual(moved,[1]);
index=2;a.workspace('next-space');assert.deepEqual(moved,[1]);
assert.equal(a.zoom(),true);assert.deepEqual(keys,[[10,1],[11,1],[11,0],[11,1],[11,0],[10,0]]);
keys=[];assert.equal(a.zoom(),true);assert.equal(keys[1][0],12);
keys=[];mask=4;assert.equal(a.zoom(),false);assert.equal(keys.length,0);
mask=0;identity='terminal.desktop';assert.equal(a.zoom(),false);
identity='firefox.desktop';overview=true;assert.equal(a.zoom(),false);
overview=false;ctx.Main.sessionMode.isLocked=true;assert.equal(a.zoom(),false);a.workspace('previous-space');assert.deepEqual(moved,[1]);
a.destroy();console.log('Magic Mouse actions: workspace bounds, zoom toggle, modifier/overview/lock guards and unsupported-app safety PASS');
// Continuous motion uses the same native controller as touchpad swipes.
ctx.Main.sessionMode.isLocked=false;let now=0,updates=[],ends=[];
ctx.GLib.get_monotonic_time=()=>now;ctx.GLib.timeout_add=()=>12;ctx.GLib.source_remove=()=>{};
ctx.Main.layoutManager={primaryIndex:0};
let frame;
ctx.Clutter.Timeline=class {connect(_event,fn){frame=fn} start(){} stop(){}};
const controller={_switchData:null,_swipeTracker:{enabled:true},
 _switchWorkspaceBegin(t){this._switchData={};t.confirmSwipe(1000,[0,1,2],1,1)},
 _switchWorkspaceUpdate(_t,p){updates.push(p)},
 _switchWorkspaceEnd(_t,d,p){ends.push(p);this._switchData=null}};
ctx.Main.wm._workspaceAnimation=controller;
const packet=(phase,dx,id=1)=>({type:'workspace-swipe',phase,dx,id,natural:true});
a.swipe(packet('begin',-300));assert.equal(controller._swipeTracker.enabled,false);
now+=10000;a.swipe(packet('update',-900));frame();assert.ok(updates.at(-1)>1&&updates.at(-1)<1.5);for(let i=0;i<25;i++){now+=16000;frame();}assert.equal(updates.at(-1),1.5);assert.equal(ends.length,0);
now+=100000;a.swipe(packet('end',-900));assert.equal(ends.at(-1),2);assert.equal(controller._swipeTracker.enabled,true);
a.swipe(packet('begin',300,2));now+=100000;a.swipe(packet('update',600,2));a.swipe(packet('cancel',600,2));assert.equal(ends.at(-1),1);
a.swipe(packet('begin',300,3));a.swipe(packet('end',300,999));assert.ok(a.swipeState);a.cancelSwipe();assert.equal(ends.at(-1),1);
controller._switchData={touchpad:true};a.swipe(packet('begin',300,4));assert.equal(a.swipeState,null);controller._switchData=null;
console.log('Continuous swipe: intermediate progress, completion, cancel, session IDs and touchpad coexistence PASS');
const overviewController={_gestureActive:false,_swipeTracker:{enabled:true},_scrollAdjustment:{get_transition:()=>null},
 _switchWorkspaceBegin(t){this._gestureActive=true;t.confirmSwipe(1000,[0,1,2],1,1)},
 _switchWorkspaceUpdate(_t,p){updates.push(p)},
 _switchWorkspaceEnd(_t,d,p){ends.push(p);this._gestureActive=false},
 _endTouchGesture(){this._gestureActive=false}};
ctx.Main.overview._overview={controls:{_workspacesDisplay:overviewController}};overview=true;
a.swipe(packet('begin',-300,5));now+=16000;a.swipe(packet('update',-900,5));frame();
assert.ok(updates.at(-1)>1&&updates.at(-1)<1.5);
a.swipe(packet('end',-900,5));assert.equal(ends.at(-1),2);assert.equal(overview,true);assert.equal(overviewController._swipeTracker.enabled,true);
a.swipe(packet('begin',300,6));overview=false;frame();assert.equal(overviewController._gestureActive,false);assert.equal(a.swipeState,null);
console.log('Overview swipe: interactive previews, selection without dismissal and interrupted gesture cleanup PASS');
