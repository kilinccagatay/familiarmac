const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const dir=__dirname+'/../extensions/familiarmac-genie@local/';
const context={};vm.runInNewContext(fs.readFileSync(dir+'geometry.js','utf8').replaceAll('export ', '')+';globalThis.point=point;globalThis.motionAllowed=motionAllowed;globalThis.bounds=bounds;',context);
for(const source of [{width:1440,height:900},{width:1,height:1},{width:2880,height:1800}])for(const target of [{x:700,y:820,width:64,height:48},{x:-2000,y:-500,width:32,height:32},{x:0,y:0,width:1,height:1}]) {
 for(let i=0;i<=100;i++)for(let row=0;row<=20;row++)for(const u of [0,.5,1]) {
  const v=row/20,p=i/100,[x,y]=context.point(u,v,p,source,target);assert.ok(Number.isFinite(x)&&Number.isFinite(y));
  const box=context.bounds(p,source,target);assert.ok(x>=box.x-1e-8&&x<=box.x+box.width+1e-8&&y>=box.y-1e-8&&y<=box.y+box.height+1e-8,'Clip must contain every mesh vertex');
  if(i===0){assert.ok(Math.abs(x-u*source.width)<1e-8);assert.ok(Math.abs(y-v*source.height)<1e-8);}
  if(i===100){assert.ok(Math.abs(x-target.x-u*target.width)<1e-8);assert.ok(Math.abs(y-target.y-v*target.height)<1e-8);}
 }
}
// Execute lifecycle code against Shell-like actors without rendering or touching a session.
class Actor {
 constructor(props={}){Object.assign(this,props);this.opacity??=255;this.ids=new Map();this.next=1;}
 connect(_signal,fn){const id=this.next++;this.ids.set(id,fn);return id;}disconnect(id){this.ids.delete(id);}
 set_size(w,h){this.width=w;this.height=h;}add_child(){}add_style_class_name(){}
 destroy(){this.destroyed=true;}hide(){this.hidden=true;}show(){this.hidden=false;}
}
for(const user of [true,false])for(const system of [true,false])assert.equal(context.motionAllowed(user,system),user&&system);
class Settings extends Actor {get_boolean(){return true;}}
const callbacks=new Map();let nextCallback=1;
const completed=[],shellwm={};for(const kind of ['minimize','unminimize','destroy'])shellwm['completed_'+kind]=a=>completed.push([kind,a]);
const wm={_shellwm:shellwm,_shouldAnimateActor:()=>true};const globalMock={window_manager:new Actor(),compositor:{get_laters:()=>({remove(){}})}};
const ctx={preparePreviewMagnification(widget,image,app){widget.magnificationSource=image;},console,global:globalMock,Main:{wm,extensionManager:{lookup:()=>null},layoutManager:new Actor(),sessionMode:new Actor()},Extension:class {getSettings(){return new Settings();}},Gio:{Settings},motionAllowed:context.motionAllowed,bounds:context.bounds,GLib:{PRIORITY_DEFAULT:0,SOURCE_REMOVE:false,timeout_add(_priority,_ms,fn){const id=nextCallback++;callbacks.set(id,fn);return id;},source_remove(id){callbacks.delete(id);}},Clutter:{DeformEffect:class {constructor(...args){this._init(...args);} _init(){} set_n_tiles(){} invalidate(){}},Timeline:class extends Actor {start(){this.started=true;}stop(){}}},GObject:{registerClass:c=>c},St:{Widget:Actor},Meta:{WindowType:{NORMAL:0}}};
let code=fs.readFileSync(dir+'extension.js','utf8').replace(/^import .*;\n/gm,'').replace('export default class Genie','class Genie');vm.runInNewContext(code+';globalThis.Genie=Genie;',ctx);
const genie=new ctx.Genie();genie.enable();
for(const kind of ['minimize','unminimize','destroy']) {
 const actor=new Actor(),clone=new Actor(),win={};const id=actor.connect('destroy',()=>{});let stopped=0;
 const job={actor,clone,win,kind,opacity:255,actorDestroy:id,timeline:{stop(){stopped++;}}};genie.jobs.set(actor,job);
 shellwm['completed_'+kind](actor);assert.equal(completed.filter(x=>x[1]===actor).length,0,'Native completion waits for animation');
 genie.finish(job);genie.finish(job);assert.equal(completed.filter(x=>x[1]===actor).length,1,'Exactly one completion');assert.equal(stopped,1);assert.equal(actor.opacity,255);assert.ok(clone.destroyed);
}
const actor=new Actor(),clone=new Actor();genie.jobs.set(actor,{actor,clone,win:{},kind:'destroy'});genie.finish(genie.jobs.get(actor),true);assert.ok(clone.destroyed);assert.equal(completed.filter(x=>x[1]===actor).length,0);
const pendingActor=new Actor(),pendingClone=new Actor();
const pending={actor:pendingActor,clone:pendingClone,win:{},kind:'minimize',opacity:255,actorDestroy:pendingActor.connect('destroy',()=>{})};
genie.jobs.set(pendingActor,pending);genie.desktopSettings.get_boolean=()=>false;genie.motionChanged();assert.equal(genie.jobs.size,0);assert.ok(pendingClone.destroyed);assert.equal(genie.motionEnabled(),false);
genie.desktopSettings.get_boolean=()=>true;genie.settings.get_boolean=()=>false;assert.equal(genie.motionEnabled(),false);
genie.settings.get_boolean=()=>true;
const freshActor=new Actor(),freshClone=new Actor();freshClone.add_effect=()=>{};
const widget={mapped:false,width:0,height:0,get_transformed_position:()=>[800,850],get_transformed_size:()=>[84,60]};
const fresh={actor:freshActor,clone:freshClone,win:{},kind:'minimize',opacity:255,actorDestroy:freshActor.connect('destroy',()=>{}),rect:{x:0,y:0,width:1200,height:800},entry:{widget}};
genie.jobs.set(freshActor,fresh);genie.animate(fresh);
assert.equal(genie.jobs.get(freshActor),fresh,'New thumbnail must not skip minimize while awaiting layout');assert.equal(callbacks.size,1);assert.ok(!fresh.timeline);
widget.mapped=true;widget.width=84;widget.height=60;
const retry=callbacks.get(fresh.layoutWait);callbacks.delete(fresh.layoutWait);retry();
assert.ok(fresh.timeline.started,'Minimize begins after first allocation');assert.equal(fresh.timeline.duration,480);assert.equal(fresh.effect.progress,0);genie.finish(fresh);
const hiddenActor=new Actor(),hiddenClone=new Actor();
const hidden={actor:hiddenActor,clone:hiddenClone,win:{},kind:'minimize',opacity:255,actorDestroy:hiddenActor.connect('destroy',()=>{}),entry:{widget:{mapped:false}},layoutRetries:12};
genie.jobs.set(hiddenActor,hidden);genie.animate(hidden);assert.ok(!genie.jobs.has(hiddenActor),'Hidden dock must not leave Mutter waiting');
// Real preview builder: HiDPI width follows Downloads, title updates and restore menu works.
ctx.Clutter.BinLayout=class {};ctx.Clutter.ActorAlign={CENTER:0,END:1};ctx.St.Button=Actor;ctx.St.Side={BOTTOM:0};ctx.St.ThemeContext={get_for_stage:()=>({scale_factor:2})};
ctx.Main.uiGroup={add_child(){}};let restored=0,activated=0;ctx.Main.activateWindow=()=>activated++;
ctx.Shell={WindowTracker:{get_default:()=>({get_window_app:()=>({get_name:()=> 'Firefox',create_icon_texture:()=>new Actor()})})}};
class Menu {constructor(){this.actor=new Actor();this.items=[];}addAction(label,action){const item={label:{text:label},action};this.items.push(item);return item;}close(){}toggle(){}destroy(){this.destroyed=true;}}
ctx.PopupMenu={PopupMenu:Menu,PopupMenuManager:class {addMenu(){}removeMenu(){}}};
const reference=new Actor({width:84}),referenceButton=new Actor({width:120,height:100,get_child:()=>reference});
genie.dockRow=()=>({get_children:()=>[{},referenceButton],add_child(){}});
let title='Active Firefox tab';const win=new Actor({get_frame_rect:()=>({width:1440,height:900}),get_title:()=>title,unminimize:()=>restored++});
const entry=genie.preview(win,{});assert.equal(entry.image.width,84);assert.equal(entry.image.height,52.5);assert.equal(entry.widget.width,120);
assert.equal(entry.menu.items[0].label.text,'Open “Active Firefox tab”');title='Changed tab';win.ids.get(entry.titleSignal)();assert.equal(entry.menu.items[0].label.text,'Open “Changed tab”');
entry.menu.items[0].action();assert.equal(restored,1);assert.equal(activated,1);genie.removePreview(win);assert.equal(genie.previews.size,0);assert.equal(reference.ids.size,0);assert.equal(win.ids.size,0);
genie.disable();assert.equal(wm._shouldAnimateActor(),true);
console.log('Genie prototype: finite geometry/endpoints, reverse path, exactly-once completion and cleanup PASS');
