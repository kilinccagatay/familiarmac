const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
class Actor {
 constructor(){this.classes=new Set();this.signals=new Map();}
 connect(n,fn){this.signals.set(n,fn);return n;} disconnect(n){this.signals.delete(n);}
 has_style_class_name(n){return this.classes.has(n);} add_style_class_name(n){this.classes.add(n);} remove_style_class_name(n){this.classes.delete(n);}
}
const box=new Actor(),app=new Actor(),system=new Actor();app.menu={actor:new Actor()};system.menu={actor:new Actor()};
let idle;
const context={TrayActivation:class {track(){} untrack(){} destroy(){}},Main:{panel:{_leftBox:new Actor(),_centerBox:new Actor(),_rightBox:box,statusArea:{'appindicator-chat':app,quickSettings:system}}},GLib:{PRIORITY_DEFAULT_IDLE:0,SOURCE_REMOVE:false,idle_add(p,fn){idle=fn;return 1;},source_remove(){idle=null;}}};
const source=fs.readFileSync('extensions/macbook-menu@local/indicatorMenus.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class');
vm.runInNewContext(source+';globalThis.Controller=IndicatorMenus',context);
const c=new context.Controller();assert(app.menu.actor.classes.has('fm-dock-menu'));assert.equal(system.menu.actor.classes.size,0);
const second=new Actor();second.menu={actor:new Actor()};context.Main.panel.statusArea['appindicator-second']=second;
box.signals.get('child-added')();idle();assert(second.menu.actor.classes.has('fm-indicator-menu'));
const old=app.menu.actor;app.menu={actor:new Actor()};app.signals.get('menu-set')();assert.equal(old.classes.size,0);assert(app.menu.actor.classes.has('fm-indicator-menu'));
c.destroy();assert.equal(app.menu.actor.classes.size,0);assert.equal(second.signals.size,0);assert.equal(box.signals.size,0);
console.log('Indicator menus: existing/new apps, replacement menu, system-menu isolation and cleanup PASS');
