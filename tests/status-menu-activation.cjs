const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let transitions=0;
const manager={activeMenu:null,_changeMenu(menu){assert.equal(this,manager);transitions++;this.activeMenu=menu;}};
const original=manager._changeMenu;
const ctx={global:{stage:{connect(){return 1},disconnect(){}}},Clutter:{EVENT_PROPAGATE:0,EVENT_STOP:1,EventType:{BUTTON_PRESS:1,TOUCH_BEGIN:2,ENTER:3},ModifierType:{CONTROL_MASK:4,SUPER_MASK:8}},Main:{panel:{menuManager:manager,_rightBox:{contains:a=>a.right}}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/statusMenuActivation.js','utf8').replace(/^import .*;\n/gm,'').replace('export class','class')+';globalThis.Policy=StatusMenuActivation;',ctx);
const policy=new ctx.Policy();
const date={sourceActor:{right:true}},cc={sourceActor:{right:true}},left={sourceActor:{right:false}};
manager.activeMenu=date;manager._changeMenu(cc);assert.equal(manager.activeMenu,date);
manager._changeMenu(left);assert.equal(manager.activeMenu,date);
manager.activeMenu=left;manager._changeMenu(date);assert.equal(manager.activeMenu,left);
manager._changeMenu(left);assert.equal(transitions,1);
// Explicit activation is deliberately not wrapped: GNOME's open-state manager
// remains responsible for closing the previous menu and transferring its grab.
assert.equal(Object.hasOwn(date,'open'),false);
policy.destroy();assert.equal(manager._changeMenu,original);
const policy2=new ctx.Policy();const later=()=>{};manager._changeMenu=later;policy2.destroy();assert.equal(manager._changeMenu,later);
console.log('Status menus: no hover/focus switching, left menus preserved, wrapper cleanup PASS');

const policy3=new ctx.Policy();
let closed=0,opened=0;
const target={right:true,mapped:true,get_transformed_position:()=>[500,0],get_transformed_size:()=>[40,28],menu:{toggle(){opened++}}};
ctx.Main.panel.statusArea={quickSettings:target};
const event=(type=1,state=0,x=510)=>({type:()=>type,get_button:()=>1,get_state:()=>state,get_coords:()=>[x,10]});
manager.activeMenu={isOpen:true,sourceActor:date.sourceActor,close(){closed++}};
assert.equal(policy3.event(event(3)),0);assert.equal(opened,0);
assert.equal(policy3.event(event(1,4)),0);assert.equal(closed,0);
assert.equal(policy3.event(event(1,0,450)),0);assert.equal(closed,0);
assert.equal(policy3.event(event()),1);assert.equal(closed,1);assert.equal(opened,1);
manager.activeMenu.sourceActor=target;
assert.equal(policy3.event(event()),1);assert.equal(closed,2);assert.equal(opened,1);
manager.activeMenu.sourceActor=date.sourceActor;
assert.equal(policy3.event(event(2)),1);assert.equal(opened,2);
policy3.destroy();
console.log('Status click transfer: one press closes/opens, same-button dismissal, touch, hover and reorder exclusions PASS');

// Modal routing goes straight to the menu actor, never through stage capture.
let nativeCaptures=0;
function menuActor(){return {handler:null,connectObject(_s,f){this.handler=f;},disconnectObject(){this.handler=null;},connect(){return 9;},disconnect(){}};}
const firstActor=menuActor();
manager._menus=[{actor:firstActor}];
manager._onCapturedEvent=function(){nativeCaptures++;manager.activeMenu.close();return 0;};
manager.addMenu=function(menu){this._menus.push(menu);menu.actor.connectObject('captured-event',this._onCapturedEvent.bind(this),this);};
const nativeAdd=manager.addMenu;
const policy4=new ctx.Policy();
manager.activeMenu={isOpen:true,sourceActor:date.sourceActor,close(){closed++;}};
let before=opened;
assert.equal(firstActor.handler(firstActor,event()),1);
assert.equal(opened,before+1);assert.equal(nativeCaptures,0,'transfer precedes native outside-click dismissal');
const laterActor=menuActor();manager.addMenu({actor:laterActor});
before=opened;assert.equal(laterActor.handler(laterActor,event()),1);assert.equal(opened,before+1);
assert.equal(laterActor.handler(laterActor,event(1,0,450)),0);assert.equal(nativeCaptures,1,'ordinary outside clicks retain native handling');
// Removing and re-adding an actor must reconnect interception.
manager._menus=manager._menus.filter(menu=>menu.actor!==laterActor);
laterActor.disconnectObject(manager);manager.addMenu({actor:laterActor});
before=opened;assert.equal(laterActor.handler(laterActor,event()),1);assert.equal(opened,before+1);
// Removed actors must not regain a manager connection during teardown.
manager._menus=manager._menus.filter(menu=>menu.actor!==laterActor);laterActor.disconnectObject(manager);
policy4.destroy();assert.equal(manager.addMenu,nativeAdd);assert.equal(laterActor.handler,null);
firstActor.handler(firstActor,event());assert.equal(nativeCaptures,2,'teardown restores native handler');
console.log('Status modal capture: existing/new menus transfer before dismissal; outside clicks and teardown PASS');
