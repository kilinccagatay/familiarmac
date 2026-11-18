const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
function emitter(){return {signals:new Map(),connect(n,f){this.signals.set(n,f);return n;},disconnect(n){this.signals.delete(n);}};}
const wm=emitter(),tracker=emitter();let idle,scheduled=0,removed=0;
const laters={add(type,f){assert.equal(type,7);idle=f;scheduled++;return 1;},remove(){removed++;}};
const c={Meta:{LaterType:{BEFORE_REDRAW:7}},Shell:{WindowTracker:{get_default:()=>tracker}},global:{window_manager:wm,compositor:{get_laters:()=>laters},get_window_actors:()=>[]}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/dockRefresh.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class')+';globalThis.Refresh=DockRefresh;',c);
const r=new c.Refresh(),box=emitter(),dash=Object.assign(emitter(),{_box:box,mapped:true,_redisplay(){this.count=(this.count??0)+1;}});box._delegate=dash;r.track(box);
wm.signals.get('map')(wm,{});tracker.signals.get('tracked-windows-changed')();assert.equal(scheduled,1);idle();assert.equal(dash.count,1);
dash.mapped=false;wm.signals.get('map')(wm,{});idle();assert.equal(dash.count,1);
dash.mapped=true;dash.signals.get('notify::mapped')();idle();assert.equal(dash.count,2);
dash._dragPlaceholder={};wm.signals.get('destroy')();idle();assert.equal(dash.count,2);
const window=Object.assign(emitter(),{is_override_redirect:()=>false});
r.watchWindow(window);window.signals.get('notify::skip-taskbar')();idle();
assert.equal(window.signals.size,3);window.signals.get('unmanaged')();assert.equal(window.signals.size,0);
r.queue();r.destroy();assert.equal(removed,1);assert.equal(wm.signals.size,0);assert.equal(tracker.signals.size,0);assert.equal(dash.signals.size,0);
console.log('Dock tray return: before-redraw scheduling, map/tracker coalescing, skip-taskbar updates, hidden-to-visible refresh, drag protection and cleanup PASS');
