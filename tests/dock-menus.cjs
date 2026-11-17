const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
class Item {
 constructor(label){this.label=label;this.signals={};this.classes=new Set();this.sensitive=true;this.actor=this;}
 connect(n,fn){this.signals[n]=fn;return n} disconnect(n){delete this.signals[n]}
 add_child(){} setOrnament(v){this.ornament=v} setSensitive(v){this.sensitive=v}
 add_style_class_name(n){this.classes.add(n)} remove_style_class_name(n){this.classes.delete(n)} hide(){} destroy(){this.destroyed=true}
}
class Menu extends Item {
 constructor(){super();this.items=[];this.box=this;this.isOpen=false;this._boxPointer={_reposition(){}}}
 _getMenuItems(){return this.items} addMenuItem(i){this.items.push(i)} addAction(label,fn){const i=new Item(label);i.action=fn;this.items.push(i);return i}
 removeAll(){this.items=[]} open(){this.isOpen=true;this.signals['open-state-changed']?.(this,true)} close(){this.isOpen=false;this.signals['open-state-changed']?.(this,false)}
}
let pinned=true,opened=0,quit=0,hidden=0,preview=0;
const info={get_filename:()=>'/usr/share/applications/example.desktop',list_actions:()=>['new-private-window'],get_action_name:()=> 'New Private Window'};
const app={state:0,get_id:()=> 'example.desktop',get_app_info:()=>info,get_windows:()=>app.state?[{is_override_redirect:()=>false,skip_taskbar:false,get_title:()=> 'Document',has_focus:()=>true,minimize:()=>hidden++}]:[],can_open_new_window:()=>true,activate:()=>opened++,request_quit:()=>quit++};
const icon=new Item();Object.assign(icon,{app,popupMenu(){},_menu:new Menu(),_windowPreviews:()=>preview++});
const context={BoxPointer:{PopupAnimation:{NONE:0}},Gio:{DesktopAppInfo:{new:()=>null}},GLib:{},Shell:{AppState:{STOPPED:0}},St:{Side:{LEFT:0},Icon:Item},Clutter:{ActorAlign:{END:2},EventType:{BUTTON_PRESS:1,TOUCH_BEGIN:2,KEY_PRESS:3,MOTION:4,ENTER:5},KEY_Escape:27,EVENT_STOP:1,EVENT_PROPAGATE:0},Main:{uiGroup:{add_child(){}},activateWindow(){}},global:{stage:{get_event_actor:()=>({})},settings:{is_writable:()=>true}},AppFavorites:{getAppFavorites:()=>({isFavorite:()=>pinned,removeFavorite:()=>pinned=false,addFavorite:()=>pinned=true})},PopupMenu:{PopupMenu:Menu,PopupMenuItem:Item,PopupSeparatorMenuItem:class extends Item {constructor(){super('separator')}},Ornament:{CHECK:1,NONE:0},PopupMenuManager:class{addMenu(){} removeMenu(){} _onCapturedEvent(){return 0}}}};
const source=fs.readFileSync('extensions/macbook-menu@local/dockMenus.js','utf8').replace(/^import .*;$/gm,'').replaceAll('export ','');
vm.runInNewContext(source+'\nglobalThis.Controller=DockMenus;globalThis.position=flyoutPosition;globalThis.selectRow=selectParentPointerRow;globalThis.returns=pointerReturnsToParent',context);
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
let launched;
context.settingsPanels=()=>[{name:'About',args:['system','about']},{name:'Sound',args:['sound']}];
context.settingsCommand=()=>'/home/test/.local/bin/familiarmac-settings';
context.Util={spawn:argv=>launched=argv};
app.get_id=()=> 'org.gnome.Settings.desktop';
for (const state of [0,1]) {
 app.state=state;icon._menu._rebuildMenu();
 assert.deepEqual(icon._menu.items.slice(0,4).map(i=>i.label),['About','Sound','separator','Options']);
 icon._menu.items[0].action();
 assert.equal(JSON.stringify(launched),JSON.stringify(['/home/test/.local/bin/familiarmac-settings','system','about']));
}
context.Gio.DesktopAppInfo.new=()=>({launch(){launched='genie-prefs';}});
icon._menu._rebuildMenu();icon._menu.items.find(i=>i.label==='Dock & Window Effects…').action();assert.equal(launched,'genie-prefs');
controller.destroy();assert.equal(icon._menu._rebuildMenu,original);assert.equal(controller.icons.size,0);
console.log('Dock menu: stopped/running actions, Focus-independent flyout cleanup, Finder protection and restoration PASS');

// The theme's 12px content margins must not cancel the 6px visible overlap.
const css=fs.readFileSync('extensions/macbook-menu@local/stylesheet.css','utf8');
assert.match(css,/\.fm-dock-menu \.popup-menu-content \{ margin: 0;/);
for(const scale of [1,2]) {
 const p=context.position({x:100,width:200*scale},120,{width:180*scale,height:150},{x:0,y:0,width:2000,height:700},scale);
 assert.equal(100+200*scale-p.x,6*scale);
}

// Virtual Trash is handled on its first opening despite no desktop filename.
let emptied=0;
const trashInfo={get_filename:()=>null,list_actions:()=>['empty-trash']};
const trashIcon=new Item();Object.assign(trashIcon,{app:{isTrash:true,get_app_info:()=>trashInfo,activate:()=>opened++,launch_action:action=>{assert.equal(action,'empty-trash');emptied++;}},popupMenu(){},_menu:new Menu()});
context.global.get_current_time=()=>123;
const trashMenus=new context.Controller();trashMenus.track(trashIcon);
trashIcon.signals['menu-state-changed'](trashIcon,true);
assert.deepEqual(trashIcon._menu.items.map(i=>i.label),['Open','Empty Trash']);
trashIcon._menu.items[1].action();assert.equal(emptied,1);
trashInfo.list_actions=()=>[];trashIcon._menu._rebuildMenu();
assert.equal(trashIcon._menu.items[1].sensitive,false);
trashMenus.destroy();

// Moving vertically through Options must release the nested grab to parent rows.
const rect=(x,y,w,h)=>({get_transformed_position:()=>[x,y],get_transformed_size:()=>[w,h]});
const parent=rect(100,50,200,600), row=rect(100,500,200,30), fly=rect(294,495,180,130);
assert.equal(context.returns(parent,row,fly,150,470),true);
assert.equal(context.returns(parent,row,fly,150,550),true);
assert.equal(context.returns(parent,row,fly,150,515),false);
assert.equal(context.returns(parent,row,fly,297,505),false); // overlapping flyout wins
assert.equal(context.returns(parent,row,fly,350,550),false);
assert.equal(context.returns(parent,row,fly,50,470),false);
for (const type of [4,5]) {
 let closed=0;
 const manager=record.manager;
 manager.parentMenu={actor:parent,_getMenuItems:()=>[]};
 row.active=true;
 manager.activeMenu={sourceActor:row,actor:fly,close:()=>{closed++;row.active=true;}};
 assert.equal(manager._onCapturedEvent(fly,{type:()=>type,get_coords:()=>[150,470]}),0);
 assert.equal(closed,1);assert.equal(row.active,false);
}
console.log('Dock flyout: parent-row pointer return, overlap and nested-grab release PASS');
// Pointer re-entry does not depend on a fresh notify::hover; scrolling checks
// the row's new allocation after layout and never consumes the scroll event.
const idle=new Map();let idleId=0;
Object.assign(context.GLib,{PRIORITY_DEFAULT_IDLE:0,SOURCE_REMOVE:false,
 idle_add:(_p,fn)=>{idle.set(++idleId,fn);return idleId;},source_remove:id=>idle.delete(id)});
context.Clutter.EventType.SCROLL=6;
let mouse=[150,515];context.global.get_pointer=()=>mouse;
const flushIdle=()=>{for(const [id,fn] of idle){idle.delete(id);fn();}};
const hoverIcon=new Item();Object.assign(hoverIcon,{app,popupMenu(){},_menu:new Menu()});
const hoverController=new context.Controller();hoverController.autostart=()=>({enabled:false});
hoverController.track(hoverIcon);hoverIcon.signals['menu-state-changed'](hoverIcon,true);hoverIcon._menu._rebuildMenu();
const hr=hoverController.icons.get(hoverIcon),ho=hr.menu.items.find(i=>i.label==='Options');
Object.assign(hr.menu,rect(100,50,200,600));Object.assign(ho,rect(100,500,200,30),{mapped:true});
hr.menu.open();hr.menu.signals['captured-event'](hr.menu,{type:()=>4});flushIdle();assert(hr.flyout.isOpen);
hr.flyout.close();ho.active=true;mouse=[150,470];hr.menu.signals['captured-event'](hr.menu,{type:()=>4});flushIdle();assert(!hr.flyout.isOpen);assert.equal(ho.active,false);
assert.equal(hr.menu.signals['captured-event'](hr.menu,{type:()=>6}),0);
Object.assign(ho,rect(100,455,200,30));
for(const [id,fn] of idle){idle.delete(id);fn();}
assert(hr.flyout.isOpen);
hr.flyout.close();
const other=Object.assign(new Item('Other'),rect(100,400,200,30),{mapped:true,reactive:true,can_focus:true,active:false});
hr.menu.items.push(other);Object.assign(ho,{reactive:true,can_focus:true});mouse=[150,410];
hr.manager.pointerReturned();
// Native leave/focus notifications land AFTER capture, before idle.
other.active=false;ho.active=true;
flushIdle();assert.equal(other.active,true);assert.equal(ho.active,false);
ho.signals['notify::allocation']();assert(idle.size);hoverController.destroy();assert.equal(idle.size,0);
assert(!hr.menu.signals['captured-event']);
console.log('Dock Options: hover re-entry, stationary-pointer scroll, idle cleanup PASS');
// Hover/focus is not an independent blue highlight; native .selected owns it.
assert.match(css,/\.fm-dock-menu \.popup-menu-item:active \{ background-color: transparent;/);
assert.match(css,/\.fm-system-light \.fm-dock-menu \.popup-menu-item\.selected:focus \{ background-color: #0868e9;/);
assert.match(css,/\.fm-system-dark \.fm-dock-menu \.popup-menu-item\.fm-submenu-open\.selected:hover/);

// Returning from the gray ancestor must select the newly pointed parent row,
// even if no enter/hover signal fires after the nested grab is released.
const first=Object.assign(rect(100,50,200,30),{mapped:true,reactive:true,can_focus:true,active:false});
const second=Object.assign(rect(100,90,200,30),{mapped:true,reactive:true,can_focus:true,active:true});
const divider=Object.assign(rect(100,125,200,10),{mapped:true,reactive:false,can_focus:false,active:false});
const selectionMenu={actor:rect(100,50,200,200),_getMenuItems:()=>[first,second,divider]};
context.selectRow(selectionMenu,150,65);assert.equal(first.active,true);assert.equal(second.active,false);
context.selectRow(selectionMenu,150,100);assert.equal(first.active,false);assert.equal(second.active,true);
context.selectRow(selectionMenu,150,130);assert.equal(first.active,false);assert.equal(second.active,false);assert.equal(divider.active,false);
first.active=true;context.selectRow(selectionMenu,50,65);assert.equal(first.active,true); // outside doesn't steal keyboard selection
console.log('Dock parent pointer: new row activates without enter event, separators clear, outside preserves focus PASS');
