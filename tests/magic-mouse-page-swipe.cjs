const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let mask=0,focus={},now=0,events=[],positions=[],tick,removed=[];
const ctx={Clutter:{ModifierType:{CONTROL_MASK:1,MOD1_MASK:2,SUPER_MASK:4,SHIFT_MASK:8,BUTTON1_MASK:16,BUTTON2_MASK:32,BUTTON3_MASK:64},InputDeviceType:{POINTER_DEVICE:1},ScrollSource:{FINGER:2},ScrollFinishFlags:{NONE:0,HORIZONTAL:1},get_default_backend:()=>({get_default_seat:()=>({create_virtual_device:()=>({notify_absolute_motion:(t,x,y)=>positions.push([x,y]),notify_scroll_continuous:(t,x,y,source,flags)=>events.push({x,y,source,flags})})})})},GLib:{get_monotonic_time:()=>now,timeout_add:(_p,_t,f)=>{tick=f;return 1},source_remove:i=>removed.push(i)},Shell:{ActionMode:{NORMAL:1}},Main:{sessionMode:{isLocked:false,hasWindows:true},overview:{visible:false},actionMode:1},global:{get_pointer:()=>[320,240,mask],display:{get focus_window(){return focus},connect:()=>1,disconnect:()=>{}}}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/magicMousePageSwipe.js','utf8').replace(/^import .*;$/gm,'').replace('export class MagicMousePageSwipe','this.Page=class MagicMousePageSwipe'),ctx);
const a=new ctx.Page(),p=(phase,dx,id=1,natural=true)=>({type:'page-swipe',phase,dx,id,natural});
a.handle(p('begin',300));assert.equal(events.length,0);
a.handle(p('update',500));assert.equal(events.at(-1).x,-30);assert.equal(events.at(-1).source,2);assert.deepEqual(positions.at(-1),[320,240]);
a.handle(p('update',500));assert.equal(events.length,1,'heartbeat cannot scroll twice');
a.handle(p('update',350));assert.equal(events.at(-1).x,22.5,'reversal is continuous');assert.equal(positions.length,1,'stationary mouse must not inject moves during scroll');
a.handle(p('end',350));assert.equal(events.at(-1).flags,1);assert.equal(a.state,null);
events=[];a.handle(p('update',999));assert.equal(events.length,0);
a.handle(p('begin',300,2));a.handle(p('update',700,2));a.handle(p('cancel',0,1));assert.ok(a.state);
a.handle(p('cancel',0,2));assert.deepEqual(events.map(e=>e.x),[-60,60,0]);
events=[];a.handle(p('begin',300));a.handle(p('update',500));focus={};a.cancel();assert.deepEqual(events.map(e=>e.x),[-30,0],'do not rewind another window');
events=[];a.handle(p('begin',300));a.handle(p('update',Infinity));assert.equal(events.length,0);now=1600000;tick();assert.equal(a.state,null);
for(const state of ['modal','overview','lock','button']){
 ctx.Main.actionMode=state==='modal'?4:1;ctx.Main.overview.visible=state==='overview';ctx.Main.sessionMode.isLocked=state==='lock';mask=state==='button'?16:0;
 a.handle(p('begin',300));assert.equal(a.state,null,state);
}
ctx.Main.actionMode=1;ctx.Main.overview.visible=false;ctx.Main.sessionMode.isLocked=false;mask=0;
events=[];a.handle(p('begin',-300,5,false));a.handle(p('end',-500,5,false));assert.equal(events[0].x,-30);assert.equal(events.at(-1).flags,1);
a.destroy();console.log('Page swipe: native finger stream, reversal, release, no duplicate scroll, stale ID, focus, timeout and modal guards PASS');
