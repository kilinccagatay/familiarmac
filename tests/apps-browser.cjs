const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
function load(file,context,expose){const code=fs.readFileSync(__dirname+'/../'+file,'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');vm.runInNewContext(code+';Object.assign(globalThis,{'+expose+'});',context);return context;}
let favorites=['brave.desktop','org.gnome.Nautilus.desktop','org.familiarmac.Apps.desktop'],writes=0,callback;
let pointerY=200,removed=null,later;
const ui={};
const order=load('extensions/macbook-menu@local/dockOrder.js',{Main:{uiGroup:ui,overview:{visible:false}},St:{ThemeContext:{get_for_stage:()=>({scale_factor:2})}},Meta:{LaterType:{BEFORE_REDRAW:0}},DND:{DragMotionResult:{MOVE_DROP:2,CONTINUE:3}},AppFavorites:{getAppFavorites:()=>({removeFavorite:id=>removed=id})},global:{stage:{},get_pointer:()=>[10,pointerY],compositor:{get_laters:()=>({add(t,fn){later=fn;}})}},Gio:{Settings:class {connect(n,fn){callback=fn;return 1;}disconnect(){}get_strv(){return favorites;}set_strv(k,v){favorites=v;writes++;callback?.();}}}},'finderFirst,DockOrder');
const controller=new order.DockOrder();assert.deepEqual(Array.from(favorites),['org.gnome.Nautilus.desktop','brave.desktop','org.familiarmac.Apps.desktop']);assert.equal(writes,1);
favorites=['org.gnome.Nautilus.desktop','org.familiarmac.Apps.desktop','brave.desktop'];callback();assert.equal(writes,1);
favorites=['brave.desktop'];callback();assert.deepEqual(Array.from(favorites),['org.gnome.Nautilus.desktop','brave.desktop']);
let started=0,released=0;const drag={startDrag(){started++;},fakeRelease(){released++;}};const original=drag.startDrag;
const icon={app:{get_id:()=> 'org.gnome.Nautilus.desktop'},_draggable:drag,get_parent:()=>({}),connect:()=>1,disconnect(){}};
controller.track(icon);drag.startDrag();assert.equal(started,0);assert.equal(released,1);
const movable={...icon,app:{get_id:()=> 'brave.desktop'},_draggable:{startDrag(){}},get_transformed_position:()=>[10,500]};
controller.track(movable);assert.equal(controller.canUnpin(movable),true);
assert.equal(ui._delegate.acceptDrop(movable),true);assert.equal(removed,null);later();assert.equal(removed,'brave.desktop');
pointerY=450;assert.equal(controller.canUnpin(movable),false);assert.equal(controller.canUnpin(icon),false);
controller.destroy();assert.equal(ui._delegate,undefined);assert.equal(drag.startDrag,original);
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
const sep={visible:true,has_style_class_name:()=>true,connect:()=>4,disconnect(){disconnected++},hide(){hidden++},show(){shown++}};
const dock=new order.DockOrder();dock.trackSeparator(sep);dock.trackSeparator(sep);assert.equal(hidden,1);dock.destroy();assert.equal(shown,1);assert.equal(disconnected,1);
