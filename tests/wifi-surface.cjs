const fs=require('fs'),vm=require('vm'),assert=require('assert');
class Actor {
 constructor(props={}){Object.assign(this,props);this.children=[];this.handlers=new Map();this.id=0}
 add_child(a){this.insert_child_at_index(a,this.children.length)}
 insert_child_at_index(a,i){assert(!a.parent);this.children.splice(i,0,a);a.parent=this;this.emit('child-added',a)}
 remove_child(a){this.children.splice(this.children.indexOf(a),1);a.parent=null}
 get_parent(){return this.parent}get_children(){return [...this.children]}
 connect(n,f){this.handlers.set(++this.id,{n,f});return this.id}disconnect(id){this.handlers.delete(id)}
 emit(n,...args){for(const h of this.handlers.values())if(h.n===n)h.f(this,...args)}
 has_style_class_name(name){return this.style_class===name}
 add_style_class_name(){}setToggleState(v){this.state=v}setSensitive(v){this.sensitive=v}
 destroy(){assert.equal(this.children.length===0||!this.children.includes(native),true)}
}
class Label extends Actor {}
const native=new Actor(),parent=new Actor();parent.add_child(native);
const section=new Actor();section.actor=native;
let starts=0,stops=0,closes=0;
const wireless=new Actor({checked:true,reactive:true,_client:{wireless_hardware_enabled:true,wireless_enabled:true},_itemsSection:section,_startScanning(){starts++},_stopScanning(){stops++}});
const ctx={Atk:{Role:{CHECK_BOX:1}},Clutter:{ActorAlign:{CENTER:2,END:3}},St:{Label,Button:Actor,BoxLayout:Actor,ScrollView:Actor,PolicyType:{NEVER:0,AUTOMATIC:1}},PopupMenu:{Switch:Actor,PopupMenuItem:Actor},Util:{spawn(){}}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/wifiSurface.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class')+'\nglobalThis.W=WifiSurface',ctx);
const w=new ctx.W({panel:{_network:{_wirelessToggle:wireless},menu:{close(){closes++}}}},false);
assert.equal(w.toggle.state,true);assert.equal(w.toggleRow.reactive,false);
w.toggleRow.emit('clicked');assert.equal(wireless._client.wireless_enabled,true);
w.show();w.show();assert.equal(starts,1);assert.equal(native.parent,w.list);
const row=new Actor({style_class:'nm-network-item'});
const icons=new Actor({y_align:0}),label=new Label({y_align:0,x_expand:false}),tick=new Actor({icon_name:'object-select-symbolic',y_align:0,x_align:0});
row.add_child(icons);row.add_child(label);row.add_child(tick);native.add_child(row);
assert.equal(label.y_align,2);assert.equal(label.x_expand,true);assert.equal(tick.y_align,2);assert.equal(tick.x_align,3);assert.equal(icons.y_align,2);
section.emit('activate');assert.equal(closes,1);
w.toggleButton.checked=false;w.toggleButton.emit('clicked');assert.equal(wireless._client.wireless_enabled,false);
wireless._client.wireless_hardware_enabled=false;w.toggleButton.checked=true;w.toggleButton.emit('clicked');assert.equal(wireless._client.wireless_enabled,false);
w.hide();w.hide();assert.equal(stops,1);assert.equal(native.parent,parent);assert.equal(section.handlers.size,0);
assert.equal(label.y_align,0);assert.equal(label.x_expand,false);assert.equal(tick.x_align,0);assert.equal(icons.y_align,0);assert.equal(row.handlers.size,0);
w.show();w.destroy();assert.equal(native.parent,parent);assert.equal(stops,2);assert.equal(wireless.handlers.size,0);
console.log('Wi-Fi live list borrowing, hardware switch guard, activation and cleanup PASS');
