const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const code=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/dockLaunch.js','utf8').replace(/^import .*;\n/gm,'').replace('export class','class');
let activated=0; let now=0, callback, count=0, windows=[],state=1;
const context={GLib:{get_monotonic_time:()=>now,timeout_add:(p,t,fn)=>{callback=fn;return 7;},source_remove(){},SOURCE_CONTINUE:true,SOURCE_REMOVE:false},Shell:{AppState:{STOPPED:0,STARTING:2}},global:{window_manager:{connect:()=>1,disconnect(){}}}};
vm.runInNewContext(code+'\nglobalThis.DockLaunch=DockLaunch;',context);
const app={get_id:()=> 'test',get_windows:()=>windows,get state(){return state;},can_open_new_window:()=>true,open_new_window(){count++;},activate(){activated++;}};
const d=new context.DockLaunch();
// A running background app responds immediately to its first click.
d.request(app);assert.equal(count,1);
// A closing last window coalesces clicks until exit.
const closing={is_override_redirect:()=>false};windows=[closing];d.closing.add(closing);
d.request(app);d.request(app);assert.equal(d.pending.size,1);assert.equal(callback(),true);
state=0;assert.equal(callback(),false);assert.equal(count,2);
// Startup completing while a click is pending must focus the new window.
state=2;windows=[];d.request(app);windows=[{is_override_redirect:()=>false}];callback();assert.equal(activated,1);
windows=[closing];state=1;d.request(app);now=1600000;callback();assert.equal(count,3);d.destroy();
console.log('Dock launch: first click, closing coalescence, startup activation and bounded wait PASS');
