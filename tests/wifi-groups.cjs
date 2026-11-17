const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
class Actor {
 constructor(props={}){Object.assign(this,props);this.children=[];this.handlers={};this.visible=props.visible??true;}
 add_child(c){this.insert_child_at_index(c,this.children.length);}
 insert_child_at_index(c,i){assert(!c.parent);this.children.splice(i,0,c);c.parent=this;}
 set_child_at_index(c,i){this.remove_child(c);this.insert_child_at_index(c,i);}
 remove_child(c){this.children.splice(this.children.indexOf(c),1);c.parent=null;}
 set_style_class_name(v){this.style_class=v;}
 get_parent(){return this.parent;}get_children(){return [...this.children];}
 connect(n,f){this.handlers[n]=f;}
 destroy(){this.parent?.remove_child(this);for(const c of [...this.children])c.destroy();}
}
class Item extends Actor {constructor(name){super();this.label=new Actor({text:name});this.add_child(this.label);}}
const ctx={St:{BoxLayout:Actor,Bin:Actor,Label:Actor,Icon:Actor},Clutter:{ActorAlign:{END:1}},PopupMenu:{PopupMenuItem:Item}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/wifiGroups.js','utf8').replace(/^import .*;$/gm,'').replace(/^export /gm,'')+';globalThis.Groups=WifiGroups;',ctx);
let activated=0,closed=0;
const net=(name,known,active=false)=>({name,known,is_active:active,secure:true,icon_name:'wifi',hasAccessPoints:()=>true,hasConnections(){return this.known;},compare(b){return this.name.localeCompare(b.name);},activate(){activated++;}});
const a=net('Known',true,true),b=net('Other',false),nets=new Map([[a,{}],[b,{}]]);
const wireless={_items:new Map([[1,{_networkItems:nets}]])};
const parent=new Actor(),g=new ctx.Groups(parent,wireless,()=>closed++,false);
g.sync();assert.equal(activated,0);assert.equal(g.known.children.length,1);assert.equal(g.other.children.length,1);assert.equal(g.other.visible,false);
assert.equal(g.rows.get(a).badge.style_class,'fm-wifi-badge connected');assert.equal(g.rows.get(b).badge.style_class,'fm-wifi-badge');
assert(!g.rows.get(a).item.children.some(c=>c.icon_name==='object-select-symbolic'));
a.is_active=false;g.sync();assert.equal(g.rows.get(a).badge.style_class,'fm-wifi-badge');
g.otherButton.handlers.activate();assert.equal(g.other.visible,true);
const row=g.rows.get(b);g.sync();assert.equal(g.rows.get(b),row);
b.known=true;g.sync();assert.equal(row.item.parent,g.known);assert.equal(g.otherButton.visible,false);
row.item.handlers.activate();assert.equal(activated,1);assert.equal(closed,1);
nets.delete(b);g.sync();assert.equal(g.rows.has(b),false);g.destroy();assert.equal(parent.children.length,0);
console.log('Wi-Fi groups: saved profiles, expand/collapse, no automatic activation, row reuse and cleanup PASS');
