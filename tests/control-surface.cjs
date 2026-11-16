const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Actor {
 constructor(p={}){Object.assign(this,{visible:true,children:[],signals:new Map(),clutter_text:{},value:0},p)}
 connect(s,f){const id=this.signals.size+1;this.signals.set(id,[s,f]);return id}
 disconnect(id){this.signals.delete(id)}
 emit(s){for(const [name,f] of this.signals.values())if(name===s)f()}
 add_child(a){this.children.push(a)}set_child(a){this.children=[a]}get_child(){return this.children[0]}
 set_style_class_name(){}add_style_class_name(){}remove_style_class_name(){}destroy(){this.destroyed=true}
}
const native=new Actor({icon_name:'network-wireless-symbolic',subtitle:'Connected',checked:true});
const brightness=new Actor({slider:new Actor({value:0.4})});const sound=new Actor({slider:new Actor({value:0.2})});
const p={_network:{_wirelessToggle:native,_wiredToggle:native},_bluetooth:{quickSettingsItems:[native]},_backlight:{quickSettingsItems:[native]},_brightness:{quickSettingsItems:[brightness]},_volumeOutput:{quickSettingsItems:[sound]},menu:{close(){}}};
const ctx={St:{BoxLayout:Actor,Button:Actor,Icon:Actor,Label:Actor},Slider:Actor,Clutter:{ActorAlign:{CENTER:1}},Main:{panel:{statusArea:{}}},Util:{spawn(){}}};
let code=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/controlSurface.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class');vm.runInNewContext(code+';globalThis.C=ControlSurface',ctx);
const surface=new ctx.C({panel:p,focus:native,statusButtons:{buttons:[],open(){}}},false);
const displayCard=surface.actor.children[1],slider=displayCard.children[1].children[1];
brightness.slider.value=0.7;brightness.slider.emit('notify::value');assert.equal(slider.value,0.7);
slider.value=0.3;slider.emit('notify::value');assert.equal(brightness.slider.value,0.3);
let drags=0;brightness.slider.connect('drag-end',()=>drags++);slider.emit('drag-end');assert.equal(drags,1);
surface.syncMedia();assert.equal(surface.play.reactive,false);
surface.destroy();assert.equal(native.signals.size,0);assert.equal(surface.actor.destroyed,true);
console.log('Control cards: native slider synchronization, drag-end forwarding, absent media and cleanup PASS');
