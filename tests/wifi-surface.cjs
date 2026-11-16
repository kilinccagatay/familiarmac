const fs=require('fs'),vm=require('vm'),assert=require('assert');
class Actor {
 constructor(props={}){Object.assign(this,props);this.children=[];this.handlers=new Map();this.id=0}
 add_child(a){this.insert_child_at_index(a,this.children.length)}
 insert_child_at_index(a,i){assert(!a.parent);this.children.splice(i,0,a);a.parent=this}
 remove_child(a){this.children.splice(this.children.indexOf(a),1);a.parent=null}
 get_parent(){return this.parent}get_children(){return [...this.children]}
 connect(n,f){this.handlers.set(++this.id,{n,f});return this.id}disconnect(id){this.handlers.delete(id)}
 emit(n,...args){for(const h of this.handlers.values())if(h.n===n)h.f(this,...args)}
 add_style_class_name(){}setToggleState(v){this.state=v}setSensitive(v){this.sensitive=v}
 destroy(){assert.equal(this.children.length===0||!this.children.includes(native),true)}
}
const native=new Actor(),parent=new Actor();parent.add_child(native);
const section=new Actor();section.actor=native;
let starts=0,stops=0,closes=0;
const wireless=new Actor({checked:true,reactive:true,_client:{wireless_hardware_enabled:true,wireless_enabled:true},_itemsSection:section,_startScanning(){starts++},_stopScanning(){stops++}});
const ctx={St:{BoxLayout:Actor,ScrollView:Actor,PolicyType:{NEVER:0,AUTOMATIC:1}},PopupMenu:{PopupSwitchMenuItem:Actor,PopupMenuItem:Actor},Util:{spawn(){}}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/wifiSurface.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class')+'\nglobalThis.W=WifiSurface',ctx);
const w=new ctx.W({panel:{_network:{_wirelessToggle:wireless},menu:{close(){closes++}}}},false);
assert.equal(w.toggle.state,true);w.show();w.show();assert.equal(starts,1);assert.equal(native.parent,w.list);
section.emit('activate');assert.equal(closes,1);
w.toggle.emit('toggled',false);assert.equal(wireless._client.wireless_enabled,false);
wireless._client.wireless_hardware_enabled=false;w.toggle.emit('toggled',true);assert.equal(wireless._client.wireless_enabled,false);
w.hide();w.hide();assert.equal(stops,1);assert.equal(native.parent,parent);assert.equal(section.handlers.size,0);
w.show();w.destroy();assert.equal(native.parent,parent);assert.equal(stops,2);assert.equal(wireless.handlers.size,0);
console.log('Wi-Fi live list borrowing, hardware switch guard, activation and cleanup PASS');
