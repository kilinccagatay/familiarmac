const fs=require('fs'),vm=require('vm'),assert=require('assert');
class Actor {
 constructor(){this.children=[];this.visible=true;this.signals=new Map();this.seq=0;this.classes=new Set()}
 add_child(a){this.insert_child_at_index(a,this.children.length)}
 insert_child_at_index(a,i){assert(!a.parent);this.children.splice(i,0,a);a.parent=this}
 remove_child(a){this.children.splice(this.children.indexOf(a),1);a.parent=null}
 get_parent(){return this.parent} get_children(){return [...this.children]}
 connect(n,f){this.signals.set(++this.seq,[n,f]);return this.seq} disconnect(i){this.signals.delete(i)}
 hide(){this.visible=false} add_style_class_name(c){this.classes.add(c)} remove_style_class_name(c){this.classes.delete(c)}
 destroy(){this.parent?.remove_child(this)}
}
const area=new Actor(),list=new Actor(),column=new Actor(),heading=new Actor(),calendar=new Actor(),controls=new Actor(),label=new Actor(),toggle=new Actor(),clear=new Actor(),indicator=new Actor();
area.add_child(list);area.add_child(column);column.add_child(heading);column.add_child(calendar);
controls.add_child(label);controls.add_child(toggle);controls.add_child(clear);list._dndButton=toggle;list._clearButton=clear;indicator._sync=()=>indicator.visible=true;
let banners=false,changed;const settings={get_boolean:()=>banners,set_boolean(_k,v){banners=v;changed()},connect(_k,f){changed=f;return 1},disconnect(){changed=null}};
const menu={close(){},box:new Actor(),_boxPointer:{_sourceAlignment:.5},setSourceAlignment(v){this._boxPointer._sourceAlignment=v}};
const date={container:new Actor(),_messageList:list,_calendar:calendar,_date:heading,_indicator:indicator,menu};
const right=new Actor();right.add_child(date.container);
const context={Clutter:{ActorAlign:{START:0}},CalendarLanguage:class{destroy(){}},NotificationDrawer:class{destroy(){}},Gio:{Settings:class{constructor(){return settings}}},Gettext:{dgettext:(_d,t)=>t},St:{Icon:Actor},
 Main:{panel:{statusArea:{dateMenu:date},_rightBox:right,addToStatusArea(_id,b,i){right.insert_child_at_index(b.container,i)}}},
 PanelMenu:{Button:class extends Actor{constructor(){super();this.container=this;this.menu={box:new Actor(),items:[],addMenuItem(a){this.items.push(a)},addAction(){},close(){}}}}},
 PopupMenu:{PopupSwitchMenuItem:class extends Actor{setToggleState(v){this.state=v}},PopupSeparatorMenuItem:Actor}};
const src=fs.readFileSync('extensions/macbook-menu@local/notificationCenter.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class');
vm.runInNewContext(src+'\nglobalThis.N=NotificationCenter',context);
const nc=new context.N();assert.deepEqual(area.children,[heading,list,calendar,column]);assert.equal(column.visible,false);assert.equal(label.visible,false);assert.equal(toggle.visible,false);assert.equal(clear.visible,true);assert.equal(indicator.visible,false);assert.equal(nc.button.visible,true);assert.equal(nc.toggle.state,true);
settings.set_boolean('show-banners',true);assert.equal(nc.button.visible,false);assert.equal(nc.toggle.state,false);
settings.set_boolean('show-banners',false);assert.equal(nc.button.visible,true);
nc.destroy();assert.deepEqual(area.children,[list,column]);assert.deepEqual(column.children,[heading,calendar]);assert.equal(column.visible,true);assert.equal(toggle.visible,true);assert.equal(menu._boxPointer._sourceAlignment,.5);assert.equal(indicator.signals.size,0);assert.equal(changed,null);
console.log('Notification layout, independent DND setting sync and full cleanup PASS');
