const fs=require('fs'),vm=require('vm'),assert=require('assert');
class Actor {
 constructor(props={}){Object.assign(this,props);this.children=[];this.handlers=new Map();this.seq=0}
 add_child(a){this.insert_child_at_index(a,this.children.length)}
 insert_child_at_index(a,i){assert(!a.parent);this.children.splice(i,0,a);a.parent=this}
 remove_child(a){this.children.splice(this.children.indexOf(a),1);a.parent=null}
 get_parent(){return this.parent}get_children(){return [...this.children]}
 connect(n,f){this.handlers.set(++this.seq,{n,f});return this.seq}disconnect(id){this.handlers.delete(id)}
 emit(n){for(const h of this.handlers.values())if(h.n===n)h.f(this)}destroy(){}
}
const row=new Actor(),menu=new Actor(),slider=new Actor({value:.4}),devices=new Actor();row.add_child(slider);menu.add_child(devices);
const native=new Actor({slider,_deviceSection:{actor:devices},getIcon(){return 'audio-volume-low-symbolic'}});
const ctx={St:{BoxLayout:Actor,Label:Actor,Icon:Actor,Button:Actor,ScrollView:Actor,PolicyType:{NEVER:0,AUTOMATIC:1}},PopupMenu:{PopupMenuItem:Actor},Util:{spawn(){}}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/soundSurface.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class')+'\nglobalThis.S=SoundSurface',ctx);
const s=new ctx.S({panel:{_volumeOutput:{_output:native},menu:{close(){}}}},false);
s.show();s.show();assert.equal(s.moves.length,2);assert.equal(slider.parent,s.row);assert.equal(slider.value,.4);assert.equal(devices.parent,s.devices);assert.equal(s.icon.icon_name,'audio-volume-low-symbolic');
let muted=0;const id=native.connect('icon-clicked',()=>muted++);s.row.children[0].emit('clicked');assert.equal(muted,1);native.disconnect(id);
s.hide();s.hide();assert.equal(slider.parent,row);assert.equal(devices.parent,menu);
s.show();s.destroy();assert.equal(slider.parent,row);assert.equal(devices.parent,menu);assert.equal(native.handlers.size,0);
console.log('Sound native slider/device ownership, mute forwarding and cleanup PASS');
