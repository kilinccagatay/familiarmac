const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/panelOrder.js','utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');
const ctx={};vm.runInNewContext(source+'\nglobalThis.move=moveBefore;globalThis.C=PanelOrder',ctx);
assert.deepEqual(Array.from(ctx.move(['a','b','c'],'a','c',true)),['b','c','a']);
assert.deepEqual(Array.from(ctx.move(['a','b','c'],'c','a',false)),['c','a','b']);
assert.deepEqual(Array.from(ctx.move(['a','b'],'missing','b',true)),['a','b']);
const children=[];const box={get_children:()=>children.slice(),set_child_at_index(a,i){children.splice(children.indexOf(a),1);children.splice(i,0,a)}};
const area={};for(const id of ['sound','battery','clock']){const actor={get_parent:()=>box};area[id]={container:actor};children.push(actor)}
ctx.Main={panel:{statusArea:area}};const p=Object.create(ctx.C.prototype);p.box=box;p.apply(['clock','clock','obsolete','sound']);assert.deepEqual(Array.from(p.order()),['clock','sound','battery']);p.apply(['sound','battery','clock']);assert.equal(children[0],area.sound.container);
const clock=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/panelClock.js','utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');vm.runInNewContext(clock+'\nglobalThis.format=formatPanelDate;globalThis.names=dateNameFormatters',ctx);
const date={get_year:()=>2026,get_month:()=>11,get_day_of_month:()=>16,format:key=>{assert.equal(key,'%H:%M:%S');return '10:50:30'}};
assert.equal(ctx.format(date,ctx.names(['en_US.UTF-8','C'])),'Mon 16 Nov 10:50:30');
assert.equal(ctx.format(date,ctx.names(['tr_TR.UTF-8','C'])),'Pzt 16 Kas 10:50:30');
assert.equal(ctx.format(date,ctx.names(['C.UTF-8'])),'Mon 16 Nov 10:50:30');
console.log('Panel order and UI-language names independent of regional date formats passed');
ctx.Clutter={ModifierType:{BUTTON1_MASK:1,CONTROL_MASK:2,SUPER_MASK:4},EventType:{MOTION:1,BUTTON_RELEASE:2,KEY_PRESS:3,KEY_RELEASE:4,BUTTON_PRESS:5},KEY_Escape:9,KEY_Control_L:10,EVENT_STOP:1,EVENT_PROPAGATE:0};
let removed=0,saved=0;ctx.GLib={source_remove(){removed++}};
p.save=()=>saved++;p.hit=()=>({});
const begin=()=>{p.apply(['battery','sound','clock']);p.drag={before:['sound','battery','clock'],moved:true};p.dragWatch=123;};
const ev=(type,state=0,key=0)=>({type:()=>type,get_state:()=>state,get_key_symbol:()=>key,get_button:()=>1,get_coords:()=>[0,0]});
begin();p.event(ev(1,2));assert.equal(p.drag,null);assert.deepEqual(Array.from(p.order()),['sound','battery','clock']);
// Further hover must not rearrange anything or create a new drag.
p.event(ev(1,0));assert.equal(p.drag,null);assert.equal(saved,0);
begin();p.event(ev(4,1,10));assert.equal(p.drag,null);assert.equal(saved,0);
begin();p.event(ev(2));assert.equal(p.drag,null);assert.equal(saved,1);assert.equal(removed,3);
assert.equal(p.held(3),true);assert.equal(p.held(2),false);assert.equal(p.held(1),true);
console.log('Lost release, modifier release, subsequent hover and normal drop regressions passed');

// No pointer grab may trap desktop input, even if button release is lost.
let watchdog;
ctx.GLib.timeout_add=(_priority,_ms,fn)=>{watchdog=fn;return 456};
ctx.global={get_pointer:()=>[0,0,0],stage:{grab(){throw Error('Panel must never grab input')}}};
p.hit=()=>({id:'sound',actor:{get_transformed_position:()=>[0,0],get_transformed_size:()=>[100,30]}});
p.event(ev(5,2));assert.equal(p.drag.id,'sound');
p.event(ev(1,1));assert.ok(p.drag);
watchdog();assert.equal(p.drag,null);assert.equal(p.dragWatch,0);
p.event(ev(1,0));assert.equal(p.drag,null);
p.event(ev(5,2));p.event(ev(2));assert.equal(p.drag,null);
console.log('No input grab, lost release watchdog and normal release passed');
// The right-aligned clock needs no mirrored notification spacer and must
// retain date as the trailing item. Disabling restores the native structure.
const pad={},indicator={},label={text:'',y_align:9,connect(){return 1},disconnect(){}};
const clockChildren=[pad,label,indicator];
const clockBox={get_children:()=>clockChildren.slice(),remove_child(a){clockChildren.splice(clockChildren.indexOf(a),1)},add_child(a){clockChildren.push(a)},set_child_at_index(a,i){clockChildren.splice(clockChildren.indexOf(a),1);clockChildren.splice(i,0,a)}};
label.get_parent=()=>clockBox;
ctx.Main.panel.statusArea.dateMenu={_indicator:indicator,_clockDisplay:label,_clock:{force_seconds:false,clock:'native'}};
ctx.Gio={Settings:class{set_boolean(){}}};ctx.GLib={get_language_names_with_category:()=>['en'],DateTime:{new_now_local:()=>date}};
ctx.Clutter.ActorAlign={CENTER:1};
vm.runInNewContext('globalThis.PC=PanelClock',ctx);
const pc=new ctx.PC();assert.deepEqual(clockChildren,[indicator,label]);assert.equal(label.y_align,1);
pc.destroy();assert.deepEqual(clockChildren,[pad,label,indicator]);assert.equal(label.y_align,9);
console.log('Clock spacer removal, leading notification icon and complete restoration PASS');
