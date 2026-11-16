const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
class Item {
 constructor(label){this.label=label;this.signals={};this.sensitive=true;this.actor=this;}
 connect(n,fn){this.signals[n]=fn;return n} disconnect(n){delete this.signals[n]}
 add_child(){} setOrnament(v){this.ornament=v} setSensitive(v){this.sensitive=v}
 add_style_class_name(){} remove_style_class_name(){} hide(){} destroy(){this.destroyed=true}
}
class Menu extends Item {
 constructor(){super();this.items=[];this.box=this;this.isOpen=false}
 addMenuItem(i){this.items.push(i)} addAction(label,fn){const i=new Item(label);i.action=fn;this.items.push(i);return i}
 removeAll(){this.items=[]} open(){this.isOpen=true} close(){this.isOpen=false;this.signals['open-state-changed']?.(this,false)}
}
let pinned=true,opened=0,quit=0,hidden=0,preview=0;
const info={get_filename:()=>'/usr/share/applications/example.desktop',list_actions:()=>['new-private-window'],get_action_name:()=> 'New Private Window'};
const app={state:0,get_id:()=> 'example.desktop',get_app_info:()=>info,get_windows:()=>app.state?[{is_override_redirect:()=>false,skip_taskbar:false,get_title:()=> 'Document',has_focus:()=>true,minimize:()=>hidden++}]:[],can_open_new_window:()=>true,activate:()=>opened++,request_quit:()=>quit++};
const icon=new Item();Object.assign(icon,{app,popupMenu(){},_menu:new Menu(),_windowPreviews:()=>preview++});
const context={Gio:{},GLib:{},Shell:{AppState:{STOPPED:0}},St:{Side:{LEFT:0},Icon:Item},Clutter:{ActorAlign:{END:2}},Main:{uiGroup:{add_child(){}},activateWindow(){}},global:{settings:{is_writable:()=>true}},AppFavorites:{getAppFavorites:()=>({isFavorite:()=>pinned,removeFavorite:()=>pinned=false,addFavorite:()=>pinned=true})},PopupMenu:{PopupMenu:Menu,PopupMenuItem:Item,PopupSeparatorMenuItem:class extends Item {constructor(){super('separator')}},Ornament:{CHECK:1,NONE:0},PopupMenuManager:class{addMenu(){} removeMenu(){}}}};
const source=fs.readFileSync('extensions/macbook-menu@local/dockMenus.js','utf8').replace(/^import .*;$/gm,'').replaceAll('export ','');
vm.runInNewContext(source+'\nglobalThis.Controller=DockMenus',context);
const controller=new context.Controller();controller.autostart=()=>({enabled:false});controller.track(icon);
const original=icon._menu._rebuildMenu;
icon.signals['menu-state-changed'](icon,true);icon._menu._rebuildMenu();
assert.deepEqual(icon._menu.items.map(i=>i.label),['Options','Open']);
let record=controller.icons.get(icon);assert.equal(record.flyout.items[0].label,'Remove from Dock');
icon._menu.items[1].action();assert.equal(opened,1);
icon._menu.items[0].activate();assert.equal(record.flyout.isOpen,true);icon._menu.close();assert.equal(record.flyout.isOpen,false);
app.state=1;icon._menu._rebuildMenu();
assert.deepEqual(icon._menu.items.map(i=>i.label),['Document','separator','New Private Window','New Window','Options','separator','Show All Windows','Hide','Quit']);
assert.equal(record.flyout.items[0].ornament,1);
icon._menu.items.find(i=>i.label==='Hide').action();assert.equal(hidden,1);
icon._menu.items.find(i=>i.label==='Quit').action();assert.equal(quit,1);
app.get_id=()=> 'org.gnome.Nautilus.desktop';icon._menu._rebuildMenu();assert.equal(record.flyout.items[0].sensitive,false);assert(!icon._menu.items.some(i=>i.label==='Quit'));
controller.destroy();assert.equal(icon._menu._rebuildMenu,original);assert.equal(controller.icons.size,0);
console.log('Dock menu: stopped/running actions, Focus-independent flyout cleanup, Finder protection and restoration PASS');
