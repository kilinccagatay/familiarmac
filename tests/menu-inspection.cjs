const fs=require('fs'), vm=require('vm'), assert=require('assert');
let source=fs.readFileSync('overrides/appmenu/menuInspection.js','utf8').replace(/^import .*;$/gm,'').replace('export class MenuInspection','class MenuInspection');
let callback, destroyed=0, refreshed=0, model=null, running=true;
let closes=0, stateHandler=null, serial=0;
const window={get_transient_for:()=>null,get_wm_class:()=> 'test',can_close:()=>true,delete:()=>closes++};
const app={get_windows:()=>running?[window]:[],get_name:()=> 'Test',get_state:()=>running?1:0,
activate:()=>{running=true;},connect:(s,fn)=>(stateHandler=fn,1),disconnect:()=>{stateHandler=null;}};
class Probe {updateForWindow(){} buildCurrentMenuModel(){return model;} destroy(){destroyed++;}}
const context={Gio:{DBus:{session:{}},DBusExportedObject:{wrapJSObject:()=>({export(){},unexport(){}})}},global:{get_current_time:()=>123},GLib:{uuid_string_random:()=>`token-${++serial}`,Variant:class{constructor(t,v){this.value=v;}},timeout_add:(p,t,c)=>(callback=c,1),source_remove(){},SOURCE_REMOVE:false},Shell:{AppState:{STOPPED:0},AppSystem:{get_default:()=>({lookup_app:()=>app})}},RealMenuManager:Probe};
vm.createContext(context);vm.runInContext(source+';globalThis.Inspection=MenuInspection;',context);
const service=new context.Inspection(null,()=>refreshed++);
let result, error;const inv={return_value:v=>result=JSON.parse(v.value[0]),return_dbus_error:(...e)=>error=e};
running=false;service.RecheckAsync(['test.desktop'],inv);assert.equal(result.status,'not-running');assert.equal(destroyed,0);
running=true;service.RecheckAsync(['test.desktop'],inv);service.RecheckAsync(['other.desktop'],inv);assert.equal(error[0],'org.familiarmac.Busy');callback();assert.equal(result.status,'not-exported');
model={topLevelMenus:[{label:'File',children:[{label:'Open',shortcut:'Ctrl+O'},{type:'separator'},{label:'Close'}]}]};
service.RecheckAsync(['test.desktop'],inv);callback();assert.equal(result.status,'adapted');assert.equal(result.commands,2);assert.equal(result.shortcuts,1);
service.RecheckAsync(['test.desktop'],inv);service.destroy();assert.equal(error[0],'org.familiarmac.Stopped');assert.equal(destroyed,3);assert.equal(refreshed,2);
console.log('Per-app menu inspection: closed, empty, busy, detected hints and cancellation PASS');

const owned=new context.Inspection(null,()=>{});
assert.equal(owned.OpenForInspection('test.desktop'),'');
owned.RecheckOwnedAsync(['test.desktop',''],inv);callback();assert.equal(closes,0);
running=false;let token=owned.OpenForInspection('test.desktop');assert(token);
owned.RecheckAsync(['test.desktop'],inv);callback();assert.equal(closes,0);
model=null;owned.RecheckOwnedAsync(['test.desktop',token],inv);callback();assert.equal(closes,0);
model={appMenuChildren:[{label:'Quit'}]};
owned.RecheckOwnedAsync(['test.desktop',token],inv);callback();assert.equal(closes,1);assert.equal(result.closeRequested,true);
owned.RecheckOwnedAsync(['test.desktop',token],inv);callback();assert.equal(closes,1);
running=false;token=owned.OpenForInspection('test.desktop');running=false;stateHandler();running=true;
owned.RecheckOwnedAsync(['test.desktop',token],inv);callback();assert.equal(closes,1);
running=false;token=owned.OpenForInspection('test.desktop');owned.launches.get(token).created-=600001;
owned.RecheckOwnedAsync(['test.desktop',token],inv);callback();assert.equal(closes,1);
owned.destroy();assert.equal(stateHandler,null);
console.log('Owned launch: existing apps, unsuccessful checks, reused/expired tokens and restarted apps never closed PASS');
