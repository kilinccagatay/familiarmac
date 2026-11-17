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

assert.equal(browser.COLUMNS,5);
const mk=id=>({get_id:()=>id});
const apps=['a','b','c','d','e','f'].map(mk);
const suggested=browser.suggestedApps(apps,{a:1000000,b:999999,c:0},[mk('a'),mk('c'),mk('d'),mk('e'),mk('f')],1000001);
assert.deepEqual(Array.from(suggested,a=>a.get_id()),['a','b','c','d','e']);
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
assert.match(css,/\.modal-dialog\.familiarmac-apps \.modal-dialog-content-box \{ margin: 0; padding: 0; max-width: 560px;/);

// Mixed layout: suggestions stay as a five-tile row, app list fills from left.
class Actor {
 constructor(props={}) {Object.assign(this,props);this.children=[];}
 add_child(child){this.children.push(child)} set_child(child){this.child=child}
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
Object.assign(dialog,{_apps:renderApps,_added:{},_list:true,_category:'',_categoryButtons:[],_entry:{get_text:()=>''},_results:new Actor(),_scroll:{vadjustment:{}}});
dialog._render();
assert.equal(dialog._rows[0].length,5);
assert.equal(dialog._rows.length,7);
for(const tile of dialog._rows[0]) {
 assert.equal(tile.style_class,'familiarmac-apps-tile');assert.equal(tile.child.vertical,true);
 assert.equal(tile.child.children[0].size,48);
}
for(const row of dialog._rows.slice(1)) {
 assert.equal(row.length,1);const item=row[0];
 assert.equal(item.style_class,'familiarmac-apps-list-item');assert.equal(item.x_expand,true);
 assert.equal(item.child.x_expand,true);assert.equal(item.child.x_align,2);
 assert.equal(item.child.children[1].x_align,0);
}
dialog._list=false;dialog._render();
assert.deepEqual(Array.from(dialog._rows,row=>row.length),[5,5,1]);
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
const source={app:favs[2]};tracker.icons.set(source,{dragSize:{width:60,height:50}});
dash.handleDragOver(source,null,400,0,0);
assert.equal(dash._dragPlaceholder.child.width,60);assert.equal(dash._dragPlaceholder.child.height,50);
assert.equal(dash._fmDrop.pos,3);assert.equal(committed,null);
assert(dash.acceptDrop(source));assert.equal(committed,null);later();assert.deepEqual(committed,['a',3]);
tracker.icons.delete(source);tracker.destroy();assert.equal(dash.handleDragOver,native);assert.equal(dash.acceptDrop,nativeDrop);
// A real draggable completes actor construction before collapsing its source.
const life=new order.DockOrder();let endHandlers={},sourceHidden=false;
const container={width:60,height:50,visible:true,get_transformed_position:()=>[100,500],hide(){sourceHidden=true;this.visible=false;},show(){sourceHidden=false;this.visible=true;}};
const d={startDrag(){assert(!sourceHidden);this._dragActor={};},connect(n,f){endHandlers[n]=f;return n;},disconnect(n){delete endHandlers[n];}};
const sourceIcon={app:appFor('brave.desktop'),_draggable:d,get_parent:()=>container,connect:()=>1,disconnect(){}};
life.track(sourceIcon);d.startDrag();assert(sourceHidden);assert.equal(life.icons.get(sourceIcon).dragSize.width,60);
order.St.Label=class {set_position(){} show(){this.visible=true;}hide(){this.visible=false;}destroy(){}};
order.Shell={util_set_hidden_from_pick(){}};ui.add_child=()=>{};pointerY=200;
assert.equal(life.delegate.handleDragOver(sourceIcon),2);assert.equal(life.removeLabel.visible,true);
life.removeMonitor.dragMotion();assert.equal(life.removeLabel.visible,false);
assert.equal(life.canUnpin({...sourceIcon,app:appFor('org.familiarmac.Apps.desktop')}),false);

endHandlers['drag-cancelled']();assert(!sourceHidden);d.startDrag();endHandlers['drag-end']();assert(!sourceHidden);
life.destroy();assert.equal(Object.keys(endHandlers).length,0);

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
