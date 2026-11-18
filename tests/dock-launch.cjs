const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const code=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/dockLaunch.js','utf8').replace(/^import .*;\n/gm,'').replace('export class','class');
let now=0,next=0;const timers=new Map(),processes=new Map();
const overview={visible:false,hide(){this.visible=false;this.hides++;},hides:0};
const context={Main:{overview},console:{warn(){}},GLib:{get_monotonic_time:()=>now,timeout_add:(p,t,fn)=>{timers.set(++next,fn);return next;},source_remove:id=>timers.delete(id),SOURCE_CONTINUE:true,SOURCE_REMOVE:false},Shell:{AppState:{STOPPED:0,STARTING:2}},global:{window_manager:{connect:()=>1,disconnect(){}}}};
vm.runInNewContext(code+'\nglobalThis.DockLaunch=DockLaunch;',context);
const tick=()=>{for(const [id,fn] of [...timers])if(!fn())timers.delete(id);};
function app(id,pid){return {id,pid,state:1,windows:[],count:0,activated:0,callbacks:new Map(),get_id(){return this.id;},get_windows(){return this.windows;},get_pids(){return [this.pid];},connect(s,fn){this.callbacks.set(s,fn);return s;},disconnect(s){this.callbacks.delete(s);},can_open_new_window:()=>true,open_new_window(){this.count++;},activate(){this.activated++;}};}
const d=new context.DockLaunch(pid=>processes.get(pid)??null);
const a=app('any.desktop',100);processes.set(100,'old');
const closing={is_override_redirect:()=>false};a.windows=[closing];d._remember(a);d.closing.add(closing);
d.request(a);d.request(a);assert.equal(a.count,1);assert.equal(d.pending.size,1);
a.windows=[];a.state=0;now=2000000;tick();assert.equal(a.count,1,'STOPPED alone must not trigger relaunch while old PID exists');
processes.delete(100);tick();assert.equal(a.count,2);tick();assert.equal(a.count,2,'retry at most once');
a.windows=[{is_override_redirect:()=>false}];tick();assert.equal(a.activated,1);assert.equal(d.pending.size,0);
// Background app can respond immediately, without waiting for its process to die.
const b=app('background.desktop',200);processes.set(200,'live');d.request(b);assert.equal(b.count,1);
b.windows=[{is_override_redirect:()=>false}];tick();assert.equal(d.pending.size,0);
// A PID reused by another process must not hold the request hostage.
const c=app('pid-reuse.desktop',300);processes.set(300,'before');d.request(c);c.state=0;processes.set(300,'after');tick();assert.equal(c.count,2);
// Existing startup is focused without spawning another instance.
const s=app('starting.desktop',400);s.state=2;d.request(s);assert.equal(s.count,0);s.windows=[{is_override_redirect:()=>false}];tick();assert.equal(s.activated,1);assert.equal(s.count,0);
// Bounded cleanup; no indefinite polling and no late launches after disable.
now=18000000;tick();assert.equal(d.pending.size,0);
const pending=app('pending.desktop',500);d.request(pending);d.destroy();assert.equal(timers.size,0);assert.equal(pending.callbacks.size,0);
console.log('Dock launch: immediate request, actual-exit retry, coalescing, PID reuse, startup focus, bounded cleanup PASS');

let toggles=0;
const internal=new context.DockLaunch(()=>null,()=>toggles++);
const apps=app('org.familiarmac.Apps.desktop',999);apps.state=2;
for(let i=0;i<8;i++)internal.request(apps);
assert.equal(toggles,8);assert.equal(internal.pending.size,0);
assert.equal(apps.count,0);assert.equal(timers.size,0);
internal.destroy();
console.log('Apps launcher: every click reaches Shell toggle, no window wait or process launch PASS');

const overviewDock=new context.DockLaunch(()=>null);
const running=app('running.desktop',600);running.windows=[{is_override_redirect:()=>false}];
let forwarded=0;
const icon={app:running,_activate(){assert.equal(overview.visible,false);forwarded++;},connect:()=>1,disconnect(){}};
overviewDock.track(icon);overview.visible=true;icon._activate({button:1,modifiers:0});assert.equal(forwarded,1);
overview.visible=true;const fresh=app('fresh.desktop',601);overviewDock.request(fresh);assert.equal(overview.visible,false);assert.equal(fresh.count,1);
// Right click must not dismiss overview.
const menuIcon={app:running,_activate(){assert.equal(overview.visible,true);},connect:()=>1,disconnect(){}};
overviewDock.track(menuIcon);overview.visible=true;menuIcon._activate({button:3,modifiers:0});
overviewDock.destroy();console.log('Overview exits for fresh launch and running-app activation; context menus preserve overview PASS');
