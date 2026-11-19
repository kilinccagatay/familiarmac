const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
function load(file,context,expose){const code=fs.readFileSync(__dirname+'/../'+file,'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');vm.runInNewContext(code+';Object.assign(globalThis,{'+expose+'});',context);return context;}
let favorites=['brave.desktop','org.gnome.Nautilus.desktop','org.familiarmac.Apps.desktop'],writes=0,callback;
let pointerY=200,removed=null,later;
const ui={};
const order=load('extensions/macbook-menu@local/dockOrder.js',{Clutter:{EVENT_PROPAGATE:false,AnimationMode:{EASE_OUT_QUAD:1}},Main:{uiGroup:ui,overview:{visible:false}},St:{ThemeContext:{get_for_stage:()=>({scale_factor:2})}},Meta:{LaterType:{BEFORE_REDRAW:0}},DND:{addDragMonitor(){},removeDragMonitor(){},DragMotionResult:{MOVE_DROP:2,CONTINUE:3,NO_DROP:0}},AppFavorites:{getAppFavorites:()=>({removeFavorite:id=>removed=id})},global:{settings:{is_writable:()=>true},stage:{},get_pointer:()=>[10,pointerY],compositor:{get_laters:()=>({add(t,fn){later=fn;}})}},Gio:{Settings:class {connect(n,fn){callback=fn;return 1;}disconnect(){}get_strv(){return favorites;}set_strv(k,v){favorites=v;writes++;callback?.();}}}},'finderFirst,DockOrder,insertionSlot,isFixedApp,DockGapMotion');
const controller=new order.DockOrder();assert.deepEqual(Array.from(favorites),['org.gnome.Nautilus.desktop','org.familiarmac.Apps.desktop','brave.desktop']);assert.equal(writes,1);
favorites=['org.gnome.Nautilus.desktop','org.familiarmac.Apps.desktop','brave.desktop'];callback();assert.equal(writes,1);
favorites=['brave.desktop'];callback();assert.deepEqual(Array.from(favorites),['org.gnome.Nautilus.desktop','org.familiarmac.Apps.desktop','brave.desktop']);
let started=0,released=0;const drag={startDrag(){started++;},fakeRelease(){released++;},_maybeStartDrag(){this.startDrag();if(!this._dragActor)throw Error('missing drag actor');}};const original=drag.startDrag;const originalMaybe=drag._maybeStartDrag;
const icon={app:{get_id:()=> 'org.gnome.Nautilus.desktop'},_draggable:drag,get_parent:()=>({}),connect:()=>1,disconnect(){}};
controller.track(icon);drag.startDrag();assert.equal(started,0);assert.equal(released,1);
assert.equal(drag._maybeStartDrag({}),false);assert.equal(started,0);assert.equal(released,2);
const movable={...icon,app:{get_id:()=> 'brave.desktop'},_draggable:{startDrag(){},connect:()=>1,disconnect(){}},get_transformed_position:()=>[10,500]};
controller.track(movable);assert.equal(controller.canUnpin(movable),true);
assert.equal(ui._delegate.acceptDrop(movable),true);assert.equal(removed,null);later();assert.equal(removed,'brave.desktop');
pointerY=450;assert.equal(controller.canUnpin(movable),false);assert.equal(controller.canUnpin(icon),false);
controller.destroy();assert.equal(ui._delegate,undefined);assert.equal(drag.startDrag,original);assert.equal(drag._maybeStartDrag,originalMaybe);
const browser=load('extensions/macbook-menu@local/appsBrowser.js',{GObject:{registerClass:c=>c},ModalDialog:{ModalDialog:class{}}},'matchesApp,installedApps,suggestedApps,COLUMNS');
const app={get_name:()=> 'Browser',get_description:()=> 'Web browsing',get_app_info:()=>({get_keywords:()=>['internet'],get_categories:()=> 'Network;WebBrowser;'})};
assert.equal(browser.matchesApp(app,'internet','Network'),true);assert.equal(browser.matchesApp(app,'Browser','Office'),false);assert.equal(browser.matchesApp(app,'  WEB  ',''),true);
console.log('Apps/dock: fixed Finder, free remaining order, drag lock cleanup, app search/category matching PASS');

const info=(id,visible=true)=>({get_id:()=>id,should_show:()=>visible});
const shellApp={get_name:()=> 'Visible App',activate(){}};
assert.deepEqual(Array.from(browser.installedApps({get_installed:()=>[info('visible'),info('hidden',false),info('missing'),info('org.familiarmac.Apps.desktop')],lookup_app:id=>id==='visible'?shellApp:null})),[shellApp]);

assert.equal(browser.COLUMNS,7);
const mk=id=>({get_id:()=>id});
const apps=['a','b','c','d','e','f'].map(mk);
const suggested=browser.suggestedApps(apps,{a:1000000,b:999999,c:0},[mk('a'),mk('c'),mk('d'),mk('e'),mk('f')],1000001);
assert.deepEqual(Array.from(suggested,a=>a.get_id()),['a','c','d','e','f']);
assert.equal(browser.suggestedApps(apps,{a:1},[],2000000).length,0);
let hidden=0,shown=0,disconnected=0;
const signals=new Map();let nextSignal=0;
const sep={visible:true,show_on_set_parent:true,has_style_class_name:()=>true,
 connect:(name,fn)=>{signals.set(++nextSignal,{name,fn});return nextSignal;},
 disconnect(id){signals.delete(id);disconnected++},
 hide(){hidden++;this.visible=false;},
 show(){shown++;this.visible=true;for(const {name,fn} of signals.values())if(name==='notify::visible')fn();}};
const dock=new order.DockOrder();dock.trackSeparator(sep);dock.trackSeparator(sep);
assert.equal(hidden,1);assert.equal(sep.show_on_set_parent,false);
// Simulate dock redisplay trying to reveal the favorites/running separator.
sep.show();assert.equal(sep.visible,false);assert.equal(hidden,2);
// Hidden actors contribute neither their own width nor an extra box spacing.
const gap=6,dockLayout=[{visible:true,width:54},sep,{visible:true,width:54}];
const visible=dockLayout.filter(a=>a.visible);
assert.equal(visible.reduce((n,a)=>n+a.width,0)+(visible.length-1)*gap,114);
dock.destroy();assert.equal(sep.visible,true);assert.equal(sep.show_on_set_parent,true);assert.equal(disconnected,2);

const css=fs.readFileSync('extensions/macbook-menu@local/stylesheet.css','utf8');
assert.match(css,/\.modal-dialog\.familiarmac-apps \.modal-dialog-content-box \{ margin: 0; padding: 0; spacing: 8px;/);

// Mixed layout: suggestions stay as a five-tile row, app list fills from left.
class Actor {
 constructor(props={}) {Object.assign(this,props);this.children=[];}
 add_child(child){this.children.push(child)} set_child(child){this.child=child}
 set_style(s){this.style=s;}
 connect(){} destroy_all_children(){this.children=[]}
}
const layout=load('extensions/macbook-menu@local/appsBrowser.js',{
 GObject:{registerClass:c=>c},ModalDialog:{ModalDialog:class{}},
 St:{BoxLayout:Actor,Label:Actor,Widget:Actor},Clutter:{ActorAlign:{START:0,CENTER:1,FILL:2}},
 Shell:{AppUsage:{get_default:()=>({get_most_used:()=>renderApps})}},
 launcherAppButton:(_app,_dialog,props)=>new Actor(props),
},'AppsDialog');
const renderApps=Array.from({length:6},(_,i)=>({get_id:()=>String(i),get_name:()=>`App ${i}`,get_description:()=>'',get_app_info:()=>null,create_icon_texture:size=>new Actor({size})}));
const dialog=Object.create(layout.AppsDialog.prototype);
Object.assign(dialog,{_columns:5,_geometry:{tileWidth:92},_scrollbarVisibility:{reset(){}},_apps:renderApps,_added:{},_list:true,_category:'',_categoryButtons:[],_entry:{get_text:()=>''},_results:new Actor(),_scroll:{vadjustment:{}}});
dialog._render();
assert.equal(dialog._rows[0].length,5);
assert.equal(dialog._rows.length,7);
for(const tile of dialog._rows[0]) {
 assert.equal(tile.style_class,'familiarmac-apps-tile');assert.equal(tile.child.vertical,true);
 assert.equal(tile.child.children[0].size,64);
}
for(const row of dialog._rows.slice(1)) {
 assert.equal(row.length,1);const item=row[0];
 assert.equal(item.style_class,'familiarmac-apps-list-item');assert.equal(item.x_expand,true);
 assert.equal(item.child.x_expand,true);assert.equal(item.child.x_align,2);
 assert.equal(item.child.children[1].x_align,0);
}
dialog._list=false;dialog._render();
assert.deepEqual(Array.from(dialog._rows,row=>row.length),[5,5,1]);
const gridRows=dialog._results.children.filter(a=>a.style_class==='familiarmac-apps-row');
assert.equal(gridRows[gridRows.length-1].style,gridRows[0].style); // incomplete row retains every column's width
assert(gridRows[0].style.includes('width: 552px'));
console.log('Apps mixed view: suggestions retain grid, list content fills left, grid toggle preserved PASS');

assert(order.isFixedApp('org.familiarmac.Apps.desktop'));
assert.equal(order.insertionSlot([20,70,130,190],0,4),2);
assert.equal(order.insertionSlot([20,70,130,190],150,4),3);
assert.equal(order.insertionSlot([20,70,130,190,240],999,4),4);
// Compact source removal and a real, transparent, full-width destination gap.
const appFor=id=>({get_id:()=>id,is_window_backed:()=>false});
let favs=['finder','apps','a','b'].map(appFor),committed=null;
order.AppFavorites.getAppFavorites=()=>({getFavorites:()=>favs,isFavorite:id=>favs.some(a=>a.get_id()===id),moveFavoriteToPos:(id,pos)=>committed=[id,pos]});
order.Dash={Dash:{getAppFromSource:s=>s.app},DashItemContainer:class {
 constructor(){this.visible=true;}
 destroy(){children.splice(children.indexOf(this),1);}
 setChild(child){this.child=child;}
 show(){}
 get_transformed_position(){return [240,0];}
 get_transformed_size(){return [60,40];}
}};
order.St.Bin=class {set_size(w,h){this.width=w;this.height=h;}};
const childFor=(app,left)=>({visible:true,width:60,child:{_delegate:{app},translation_x:0,remove_transition(){}},connect:()=>1,disconnect(){},get_transformed_position:()=>[left,0],get_transformed_size:()=>[60,40]});
const children=favs.map((a,i)=>childFor(a,100+i*60));
children[2].visible=false;
const box={width:180,get_children:()=>[...children],add_child:c=>children.push(c),set_child_at_index(c,i){children.splice(children.indexOf(c),1);children.splice(i,0,c);},get_transformed_position:()=>[100,0],get_transformed_size:()=>[180,40],connect:()=>1,disconnect(){}};
const native=()=>{throw Error('native index calculation must not include hidden source');};
const nativeDrop=()=>false;
const dash={_box:box,_isHorizontal:true,iconSize:40,handleDragOver:native,acceptDrop:nativeDrop};box._delegate=dash;
const tracker=new order.DockOrder();tracker.trackDash(box);
const source={app:favs[2]}, sourceContainer=children[2];let restoredBeforeDrop=false;
tracker.icons.set(source,{container:sourceContainer,dragSize:{width:60,height:50},restore(){
 restoredBeforeDrop=true;sourceContainer.visible=true;
}});
dash.handleDragOver(source,null,400,0,0);
assert.equal(dash._dragPlaceholder.child.width,60);assert.equal(dash._dragPlaceholder.child.height,50);
assert.equal(dash._fmDrop.pos,3);assert.equal(committed,null);
assert(dash.acceptDrop(source));assert(restoredBeforeDrop);
assert.equal(dash._dragPlaceholder,null);
assert.equal(children.indexOf(sourceContainer),3,'source occupies the gap before favorites change');
assert.deepEqual(children.map(c=>c.child._delegate.app.get_id()),['finder','apps','b','a']);assert.equal(committed,null);later();assert.deepEqual(committed,['a',3]);
// Moving back left also replaces the gap without returning to the old slot.
sourceContainer.visible=false;
dash.handleDragOver(source,null,0,0,0);
assert.equal(dash._fmDrop.pos,2);
assert(dash.acceptDrop(source));
assert.equal(dash._dragPlaceholder,null);
assert.equal(sourceContainer.visible,true);
assert.deepEqual(children.map(c=>c.child._delegate.app.get_id()),['finder','apps','a','b']);
later();assert.deepEqual(committed,['a',2]);
const boundary={visible:true,has_style_class_name:n=>n==='familiarmac-downloads-start',get_transformed_position:()=>[340,0]};
children.push(boundary);

assert.equal(dash.handleDragOver(source,null,250,0,0),0);
assert.equal(dash._fmDrop,null);assert.equal(dash.acceptDrop(source),false);
dash.handleDragOver(source,null,230,0,0);
assert(children.indexOf(dash._dragPlaceholder)<children.indexOf(boundary));
// Leaving and reentering repeatedly must never accumulate fading gap actors.
for(let i=0;i<10;i++) {
 dash._clearDragPlaceholder();
 assert.equal(children.filter(c=>c._fmDockGap).length,0);
 dash.handleDragOver(source,null,230,0,0);
 assert.equal(children.filter(c=>c._fmDockGap).length,1);
}
tracker.icons.delete(source);tracker.destroy();assert.equal(dash.handleDragOver,native);assert.equal(dash.acceptDrop,nativeDrop);
// A real draggable completes actor construction before collapsing its source.
const life=new order.DockOrder();let endHandlers={};
const container={width:60,height:50,visible:true,get_transformed_position:()=>[100,500],hide(){this.visible=false;},
// Match GNOME DashItemContainer: show animates but does NOT set visible.
show(){this.scale_x=1;this.opacity=255;}};
const d={startDrag(){assert(container.visible);this._dragActor={};},connect(n,f){endHandlers[n]=f;return n;},disconnect(n){delete endHandlers[n];}};
const sourceIcon={app:appFor('brave.desktop'),_draggable:d,get_parent:()=>container,connect:()=>1,disconnect(){}};
container.hide();container.show();assert.equal(container.visible,false);
container.visible=true;
let initialGap=0;
const startupDash={_isHorizontal:true,_box:{width:300,get_children:()=>[container],
 get_transformed_position:()=>[40,500],get_transformed_size:()=>[300,50]},
 handleDragOver(icon,actor,x){assert.equal(icon,sourceIcon);assert.equal(container.visible,false);assert.equal(x,90);initialGap++;}};
life.dashes.set(startupDash,{});
life.track(sourceIcon);d.startDrag();assert.equal(initialGap,1);
life.dashes.delete(startupDash);assert(!container.visible);assert.equal(life.icons.get(sourceIcon).dragSize.width,60);
order.St.Label=class {set_position(){} show(){this.visible=true;}hide(){this.visible=false;}destroy(){}};
order.Clutter.ActorAlign={CENTER:1};
order.St.BoxLayout=class extends order.St.Label {
 constructor(){super();this.children=[];}
 add_child(child){this.children.push(child);}
 get_preferred_width(){return [60,60];}
 get_preferred_height(){return [30,30];}
 set_position(x,y){this.x=x;this.y=y;}
};
order.St.DrawingArea=class {connect(){}};
order.Shell={util_set_hidden_from_pick(){}};ui.add_child=()=>{};pointerY=200;
assert.equal(life.delegate.handleDragOver(sourceIcon),2);assert.equal(life.removeLabel.visible,true);assert.equal(life.removeLabel.children.length,2);assert.equal(life.removeLabel.x,-20);assert.equal(life.removeLabel.y,158);
life.removeMonitor.dragMotion();assert.equal(life.removeLabel.visible,false);
assert.equal(life.canUnpin({...sourceIcon,app:appFor('org.familiarmac.Apps.desktop')}),false);

endHandlers['drag-cancelled']();assert(container.visible);d.startDrag();endHandlers['drag-end']();assert(container.visible);
const trashContainer={add_style_class_name(){},remove_style_class_name(){}};
let fileHover=0,fileDrop=0;
const trashIcon={app:{get_id:()=> 'trash',get_app_info:()=>({location:{get_uri:()=> 'trash:///'}})},
 get_parent:()=>trashContainer,connect:()=>1,disconnect(){},
 handleDragOver(){fileHover++;return 77;},acceptDrop(){fileDrop++;return true;}};
const nativeTrashOver=trashIcon.handleDragOver,nativeTrashDrop=trashIcon.acceptDrop;
life.track(trashIcon);
sourceIcon.get_transformed_position=()=>[100,500];
pointerY=500; // Same height as Dock: distance-based removal is not required.
assert.equal(life.canUnpin(sourceIcon),false);
assert.equal(trashIcon.handleDragOver(sourceIcon),2);
assert.equal(life.removeText.text,'Remove from Dock');
life.showRemoveLabel(sourceIcon);assert.equal(life.removeText.text,'Remove');
const savedFavoritesGetter=order.AppFavorites.getAppFavorites;
let soundCount=0;
order.Gio.SubprocessFlags={NONE:0};order.Gio.Subprocess={new(argv){assert.equal(argv[1],'--id=trash-empty');soundCount++;}};
const beforeUnpin=[...favorites];
let unpinned=null;order.AppFavorites.getAppFavorites=()=>({removeFavorite(id){unpinned=id;favorites=favorites.filter(x=>x!==id);}});
assert.equal(trashIcon.acceptDrop(sourceIcon),true);assert.equal(unpinned,null);
later();assert.equal(unpinned,'brave.desktop');assert.equal(soundCount,1);
life.removeFavoriteWithSound('brave.desktop');assert.equal(soundCount,1);
favorites=[...beforeUnpin];pointerY=200;
assert.equal(life.delegate.acceptDrop(sourceIcon),true);assert.equal(soundCount,1);
later();assert.equal(soundCount,2);
favorites=[...beforeUnpin];
order.AppFavorites.getAppFavorites=savedFavoritesGetter;
const fixedSource={app:appFor('org.familiarmac.Apps.desktop')};life.icons.set(fixedSource,{trash:false});
assert.equal(trashIcon.handleDragOver(fixedSource),0);assert.equal(trashIcon.acceptDrop(fixedSource),false);
life.icons.delete(fixedSource);
assert.equal(trashIcon.handleDragOver({uris:['file:///test']}),77);
assert.equal(trashIcon.acceptDrop({uris:['file:///test']}),true);
assert.equal(fileHover,1);assert.equal(fileDrop,1);
life.destroy();assert.equal(Object.keys(endHandlers).length,0);
assert.equal(trashIcon.handleDragOver,nativeTrashOver);assert.equal(trashIcon.acceptDrop,nativeTrashDrop);

// Real layout moves immediately; only the visual child eases from old to new.
let active=true,animations=true,animation=null,signalId=0;
const handlers=new Map();
const content={_delegate:{app:{}},translation_x:0,remove_transition(){},ease(options){animation=options;}};
const moving={x:100,child:content,connect(name,fn){handlers.set(++signalId,{name,fn});return signalId;},disconnect(id){handlers.delete(id);}};
const motion=new order.DockGapMotion(()=>active,()=>animations);
motion.watch([moving]);motion.watch([moving]);assert.equal(handlers.size,2);
const allocated=()=>[...handlers.values()].find(h=>h.name==='notify::allocation').fn();
moving.x=160;allocated();assert.equal(content.translation_x,-60);assert.equal(animation.translation_x,0);assert.equal(animation.duration,160);
// Reverse before the first animation finishes: continue from current visual x.
content.translation_x=-20;moving.x=100;allocated();assert.equal(content.translation_x,40);
animations=false;moving.x=160;allocated();assert.equal(content.translation_x,0);
active=false;moving.x=200;allocated();assert.equal(content.translation_x,0);
motion.destroy();assert.equal(handlers.size,0);assert.equal(content.translation_x,0);
console.log('Dock gap motion: neighbors slide, reversal continuous, reduced motion and teardown PASS');

const fixedMotion=new order.DockGapMotion(()=>true,()=>true);
let trashWatched=false;
fixedMotion.watch([{child:{_delegate:{app:{get_app_info:()=>({location:{get_uri:()=> 'trash:///'}})}}},connect(){trashWatched=true;}}]);
assert.equal(trashWatched,false,'trash must not slide beyond the Dock clip on drag exit');
fixedMotion.destroy();

const dockSettingsEntry=fs.readFileSync("config/familiarmac-genie-preferences.desktop","utf8");
assert.match(dockSettingsEntry,/^NoDisplay=true$/m);
assert.match(dockSettingsEntry,/^Exec=familiarmac-settings --dock-window$/m);

assert.deepEqual(Array.from(browser.suggestedApps(apps,{a:1000,b:999},[mk('c'),mk('a'),mk('d'),mk('e'),mk('f')],1599),a=>a.get_id()),['a','c','d','e','f']);
assert.deepEqual(Array.from(browser.suggestedApps(apps,{a:1000,b:999},[mk('c'),mk('a'),mk('d'),mk('e'),mk('f')],1600),a=>a.get_id()),['c','a','d','e','f']);
assert.deepEqual(Array.from(browser.suggestedApps(apps,{a:2000},[mk('c')],1600),a=>a.get_id()),['c']);
console.log('Newest install occupies one slot for ten minutes; expiry restores usage order PASS');

const sizes=load('extensions/macbook-menu@local/appsBrowser.js',{GObject:{registerClass:c=>c},ModalDialog:{ModalDialog:class{}}},'appsGeometry');
for(const [w,h,scale] of [[2880,1800,2],[1280,720,1],[1024,768,2]]) {
 const g=sizes.appsGeometry(w,h,scale);
 assert(g.columns*(g.tileWidth+12)+(g.columns-1)*8<=g.width+0.01);
 assert(g.width+48<=w/scale);assert(g.height+220<=h/scale);
}

assert.match(css,/\.familiarmac-apps-results \{ spacing: 10px; padding: 12px 0 0;/);

assert.equal(sizes.appsGeometry(2880,1800,2).columns,7);
assert(!css.includes(".familiarmac-apps-tile:hover"));

const listGeometry=sizes.appsGeometry(2880,1800,2,true);
assert.equal(listGeometry.columns,5);
assert.equal(listGeometry.width,580);
assert.equal(listGeometry.height,sizes.appsGeometry(2880,1800,2).height);

let savedView;
const preferences=load('extensions/macbook-menu@local/appsBrowser.js',{
 GObject:{registerClass:c=>c},ModalDialog:{ModalDialog:class{}}, TextDecoder,
 GLib:{file_get_contents(){if(savedView===undefined)throw Error('missing');return [true,Buffer.from(savedView)];},
 path_get_dirname:()=>'/tmp',mkdir_with_parents(){},file_set_contents(_path,value){savedView=value;}},
},'loadAppsView,saveAppsView');
assert.equal(preferences.loadAppsView('test'),'grid');
preferences.saveAppsView('test','list');assert.equal(preferences.loadAppsView('test'),'list');
preferences.saveAppsView('test','grid');assert.equal(preferences.loadAppsView('test'),'grid');
savedView='broken';assert.equal(preferences.loadAppsView('test'),'grid');
console.log('Apps view preference: list/grid round trip and corrupt/missing fallback PASS');
