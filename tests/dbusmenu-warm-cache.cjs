const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let source=fs.readFileSync('overrides/appmenu/realMenuManager.js','utf8')
 .replace(/^import .*;$/gm,'').replace('export class RealMenuManager','class RealMenuManager');
source+='\nglobalThis.Manager=RealMenuManager;';
let next=0,created=0;const callbacks=new Map(),pending=new Map();
const Gio={_promisify(){},DBusConnection:{prototype:{}},DBusSignalFlags:{NONE:0},DBus:{session:{
 signal_subscribe(...args){callbacks.set(++next,args.at(-1));return next;},signal_unsubscribe(id){callbacks.delete(id);}}}};
const GLib={getenv:()=> 'wayland',PRIORITY_DEFAULT_IDLE:200,SOURCE_REMOVE:false,
 idle_add(_p,cb){pending.set(++next,cb);return next;},source_remove(id){pending.delete(id);}};
function item(sub=true,ready=false){return {calls:0,property_get:()=>sub?'submenu':'',get_children:()=>ready?[{}]:[],send_about_to_show(){this.calls++;}};}
class Client{constructor(){created++;this.rows=[item(),item(true,true),item(false)];}connect(){return ++next;}disconnect(){}get_root(){return {get_children:()=>this.rows};}}
const D={Client,CLIENT_SIGNAL_ROOT_CHANGED:'root-changed',CLIENT_SIGNAL_LAYOUT_UPDATED:'layout-updated'};
const ctx={Gio,GLib,Logger:{debug(){},error(e){throw Error(e);}},_:x=>x,imports:{gi:{versions:{},Dbusmenu:D}}};
vm.runInNewContext(source,ctx);const m=new ctx.Manager(null,()=>{});
const window=id=>({get_xwindow:()=>id});const reg=path=>({service:':1.42',path});
m._currentWindow=window(1);m._setBackend('dbusmenu',reg('/one'));const first=m._client;
assert.equal(first.rows[0].calls,1);assert.equal(first.rows[1].calls,0);assert.equal(first.rows[2].calls,0);
m._dbusLayoutChanged();assert.equal(first.rows[0].calls,1);
// A new tree item gets primed, but nested children are never traversed.
first.rows.push(item());m._dbusLayoutChanged();assert.equal(first.rows[3].calls,1);
m._setBackend(null,null);m._currentWindow=window(2);m._setBackend('dbusmenu',reg('/two'));
assert.notEqual(m._client,first);m._setBackend(null,null);
m._currentWindow=window(1);m._setBackend('dbusmenu',reg('/one'));
assert.equal(m._client,first);assert.equal(created,2);assert.equal(first.rows[0].calls,1);
// Unregistration invalidates inactive entries so reused paths are not stale.
m._setBackend(null,null);m._currentWindow=null;
callbacks.get(1)(null,null,null,null,'WindowUnregistered',{deepUnpack:()=>[1]});
m._currentWindow=window(1);m._setBackend('dbusmenu',reg('/one'));assert.notEqual(m._client,first);
for(let n=3;n<15;n++){m._setBackend(null,null);m._currentWindow=window(n);m._setBackend('dbusmenu',reg('/w'+n));}
assert.ok(m._menuClients.size<=8);
m.destroy();assert.equal(m._menuClients.size,0);assert.equal(callbacks.size,0);assert.equal(pending.size,0);
console.log('Window-specific live menu cache, bounded retention, invalidation and one-shot prefetch PASS');
