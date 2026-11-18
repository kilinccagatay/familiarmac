const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/statusButtons.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class');
const ctx={Gio:{SettingsSchemaSource:{new_from_directory:()=>({lookup:()=>({})}),get_default:()=>({})},Settings:class{}},GLib:{build_filenamev:()=>"",get_user_data_dir:()=>""}};vm.runInNewContext(src+'\nglobalThis.C=StatusButtons',ctx);
function actor(visible=true){let v=visible;const callbacks=new Map();return {get visible(){return v},set visible(x){if(v===x)return;v=x;for(const cb of callbacks.values())cb()},hide(){this.visible=false},connect(n,f){callbacks.set(1,f);return 1},disconnect(id){callbacks.delete(id)}}}
const sound=actor(),network=actor(),hidden=actor(false),overlay=actor(),heading=actor();
const menu={isOpen:false,close(){this.isOpen=false},open(){this.isOpen=true},box:{add_style_class_name(){},remove_style_class_name(){}},_grid:{get_children:()=>[sound,network,hidden,overlay,heading],layout_manager:{_overlay:overlay}}};
menu._grid.layout_manager.get_child_meta=(_grid,item)=>item.meta;
for(const item of [sound,network,hidden,overlay,heading]) {item.meta={column_span:1};item.get_parent=()=>menu._grid;}
const c=Object.create(ctx.C.prototype);Object.assign(c,{panel:{remove_style_pseudo_class(name){assert.equal(name,'active');},menu,_volumeOutput:{quickSettingsItems:[sound]}},owner:{arrange(){},labels:[{item:sound,label:heading}]},mask:[],spans:[]});
const button={visible:true,mapped:true,add_style_pseudo_class(){},remove_style_pseudo_class(){}};
c.open('_volumeOutput',button);assert.equal(sound.visible,true);assert.equal(network.visible,false);assert.equal(heading.visible,true);assert.equal(overlay.visible,true);
hidden.visible=true;assert.equal(hidden.visible,false);c.restore();assert.equal(network.visible,true);assert.equal(hidden.visible,true);
c.open('_volumeOutput',button);c.open('_volumeOutput',button);assert.equal(menu.isOpen,false);assert.equal(network.visible,true);assert.equal(c.mask.length,0);
console.log('Independent status detail filtering, state changes, repeated click and restoration passed');
// Ethernet and Wi-Fi can both be active: the Wi-Fi target must still select
// and expand the wireless native submenu, without exposing wired/VPN cards.
ctx.BoxPointer={PopupAnimation:{NONE:0}};
let expanded=0;network.menu={open(animation){assert.equal(animation,0);expanded++}};
c.panel._network={_wirelessToggle:network,quickSettingsItems:[sound,network]};
c.open('_network',button);assert.equal(expanded,1);assert.equal(sound.visible,false);assert.equal(network.visible,true);c.restore();
// Closing a detail must hide its parent BEFORE restoring native controls.
let handler;const order=[];
const closeMenu={connect(_name,fn){handler=fn;return 1},actor:{hide(){order.push('hide')}},close(animation){order.push(animation);handler(null,false)}};
ctx.C.prototype.install=function(){};
const manager=new ctx.C({panel:{menu:closeMenu,_system:{}},labels:[]});
manager.active={};manager.restore=()=>order.push('restore');closeMenu.close(99);
assert.deepEqual(order,['hide',0,'restore']);
console.log('Wi-Fi expands with Ethernet active; close hides shared surface before restoration PASS');
// Native indicators can arrive after extension enable: react immediately to
// insertion, coalesce additions, and wait until the setup turn has completed.
let childAdded,idle,installs=0,disconnections=0;
ctx.GLib={...ctx.GLib,PRIORITY_HIGH_IDLE:100,SOURCE_REMOVE:false,idle_add(_p,fn){idle=fn;return 9}};
ctx.C.prototype.install=function(){installs++};
const latePanel={menu:{close(){},connect(){return 1}},_indicators:{connect(_n,fn){childAdded=fn;return 2},disconnect(){disconnections++}}};
const late=new ctx.C({panel:latePanel});childAdded();assert.equal(installs,0);
latePanel._system={};idle();assert.equal(installs,1);assert.equal(disconnections,1);assert.equal(late.timer,0);
console.log('Startup indicators install on readiness without a polling delay PASS');
// Regression: custom details used to hide EVERY native row. GNOME 46 then
// computes (0 - 1) * row_spacing = -20 and can abort the entire session.
c.restore();
c.owner.wifi={show(){},hide(){}};
c.owner.sound={native:{},show(){},hide(){}};
for(const key of ['_network','_volumeOutput','_system']) {
 c.open(key,button);
 const rows=menu._grid.get_children().filter(a=>a!==overlay&&a.visible);
 assert.ok(rows.length>0,`${key}: native layout must retain rows`);
 assert.ok((rows.length-1)*20>=0,'native preferred spacing must not be negative');
 assert.equal(c.mask.length,0,'parent-hidden details must not mask children');
 c.restore();
}
console.log('Wi-Fi, sound, battery preserve native rows: fatal negative-height regression PASS');
