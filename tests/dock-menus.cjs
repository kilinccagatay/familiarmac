const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
class Item {
 constructor(label){this.label=label;this.signals={};this.classes=new Set();this.sensitive=true;this.actor=this;}
 connect(n,fn){this.signals[n]=fn;return n} disconnect(n){delete this.signals[n]}
 add_child(){} setOrnament(v){this.ornament=v} setSensitive(v){this.sensitive=v}
 add_style_class_name(n){this.classes.add(n)} remove_style_class_name(n){this.classes.delete(n)} hide(){} destroy(){this.destroyed=true}
}
class Menu extends Item {
 constructor(){super();this.items=[];this.box=this;this.isOpen=false;this._boxPointer={_reposition(){}}}
 addMenuItem(i){this.items.push(i)} addAction(label,fn){const i=new Item(label);i.action=fn;this.items.push(i);return i}
 removeAll(){this.items=[]} open(){this.isOpen=true;this.signals['open-state-changed']?.(this,true)} close(){this.isOpen=false;this.signals['open-state-changed']?.(this,false)}
}
let pinned=true,opened=0,quit=0,hidden=0,preview=0;
const info={get_filename:()=>'/usr/share/applications/example.desktop',list_actions:()=>['new-private-window'],get_action_name:()=> 'New Private Window'};
const app={state:0,get_id:()=> 'example.desktop',get_app_info:()=>info,get_windows:()=>app.state?[{is_override_redirect:()=>false,skip_taskbar:false,get_title:()=> 'Document',has_focus:()=>true,minimize:()=>hidden++}]:[],can_open_new_window:()=>true,activate:()=>opened++,request_quit:()=>quit++};
const icon=new Item();Object.assign(icon,{app,popupMenu(){},_menu:new Menu(),_windowPreviews:()=>preview++});
const context={Gio:{},GLib:{},Shell:{AppState:{STOPPED:0}},St:{Side:{LEFT:0},Icon:Item},Clutter:{ActorAlign:{END:2},EventType:{BUTTON_PRESS:1,TOUCH_BEGIN:2,KEY_PRESS:3},KEY_Escape:27,EVENT_STOP:1},Main:{uiGroup:{add_child(){}},activateWindow(){}},global:{stage:{get_event_actor:()=>({})},settings:{is_writable:()=>true}},AppFavorites:{getAppFavorites:()=>({isFavorite:()=>pinned,removeFavorite:()=>pinned=false,addFavorite:()=>pinned=true})},PopupMenu:{PopupMenu:Menu,PopupMenuItem:Item,PopupSeparatorMenuItem:class extends Item {constructor(){super('separator')}},Ornament:{CHECK:1,NONE:0},PopupMenuManager:class{addMenu(){} removeMenu(){} _onCapturedEvent(){return 0}}}};
const source=fs.readFileSync('extensions/macbook-menu@local/dockMenus.js','utf8').replace(/^import .*;$/gm,'').replaceAll('export ','');
vm.runInNewContext(source+'\nglobalThis.Controller=DockMenus;globalThis.position=flyoutPosition',context);
const controller=new context.Controller();controller.autostart=()=>({enabled:false});controller.track(icon);
const original=icon._menu._rebuildMenu;
icon.signals['menu-state-changed'](icon,true);icon._menu._rebuildMenu();
assert.deepEqual(icon._menu.items.map(i=>i.label),['Options','Open']);
let record=controller.icons.get(icon);assert.equal(record.flyout.items[0].label,'Remove from Dock');
icon._menu.items[1].action();assert.equal(opened,1);
const options=icon._menu.items[0];
options.activate();assert(options.classes.has('fm-submenu-open'));
record.flyout.close();assert(!options.classes.has('fm-submenu-open'));
icon._menu.items[0].activate();assert.equal(record.flyout.isOpen,true);icon._menu.close();assert.equal(record.flyout.isOpen,false);
// One outside click, touch or Escape closes both levels, preserving inside clicks.
icon._menu.contains=()=>false;
record.flyout.contains=()=>false;
for (const type of [1,2,3]) {
 icon._menu.open();record.flyout.open();record.manager.activeMenu=record.flyout;
 assert.equal(record.manager._onCapturedEvent(record.flyout,{type:()=>type,get_key_symbol:()=>27}),1);
 assert.equal(icon._menu.isOpen,false);assert.equal(record.flyout.isOpen,false);assert(!options.classes.has('fm-submenu-open'));
}
icon._menu.open();record.flyout.open();record.flyout.contains=()=>true;
assert.equal(record.manager._onCapturedEvent(record.flyout,{type:()=>1}),0);
assert.equal(icon._menu.isOpen,true);
const pos=context.position({x:100,width:200},120,{width:180,height:150},{x:0,y:0,width:1000,height:700},1);
assert.equal(pos.x,294);assert.equal(pos.y,115);
const edge=context.position({x:800,width:180},650,{width:180,height:150},{x:0,y:0,width:1000,height:700},1);
assert.equal(edge.x,626);assert.equal(edge.y,550);
app.state=1;icon._menu._rebuildMenu();
assert.deepEqual(icon._menu.items.map(i=>i.label),['Document','separator','New Private Window','New Window','Options','separator','Show All Windows','Hide','Quit']);
assert.equal(record.flyout.items[0].ornament,1);
icon._menu.items.find(i=>i.label==='Hide').action();assert.equal(hidden,1);
icon._menu.items.find(i=>i.label==='Quit').action();assert.equal(quit,1);
app.get_id=()=> 'org.gnome.Nautilus.desktop';icon._menu._rebuildMenu();assert.equal(record.flyout.items[0].sensitive,false);assert(!icon._menu.items.some(i=>i.label==='Quit'));
controller.destroy();assert.equal(icon._menu._rebuildMenu,original);assert.equal(controller.icons.size,0);
console.log('Dock menu: stopped/running actions, Focus-independent flyout cleanup, Finder protection and restoration PASS');

// The theme's 12px content margins must not cancel the 6px visible overlap.
const css=fs.readFileSync('extensions/macbook-menu@local/stylesheet.css','utf8');
assert.match(css,/\.fm-dock-menu \.popup-menu-content \{ margin: 0;/);
for(const scale of [1,2]) {
 const p=context.position({x:100,width:200*scale},120,{width:180*scale,height:150},{x:0,y:0,width:2000,height:700},scale);
 assert.equal(100+200*scale-p.x,6*scale);
}
