const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('extensions/macbook-menu@local/trayActivation.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class')+';globalThis.Controller=TrayActivation';
function setup(version='46.0') {
 let next=1;const jobs=new Map(),removed=[],cleared=[];
 const emitter=()=>({signals:new Map(),connect(name,fn){this.signals.set(name,fn);return name;},disconnect(name){this.signals.delete(name);}});
 const display=emitter(),tracker=Object.assign(emitter(),{get_window_app:w=>({get_id:()=>w.appId})});
 const c={console,Config:{PACKAGE_VERSION:version},Shell:{WindowTracker:{get_default:()=>tracker}},global:{display},GLib:{PRIORITY_DEFAULT:0,PRIORITY_DEFAULT_IDLE:200,SOURCE_REMOVE:false,timeout_add(p,t,f){jobs.set(next,f);return next++;},idle_add(p,f){jobs.set(next,f);return next++;},source_remove(id){removed.push(id);jobs.delete(id);}}};
 vm.runInNewContext(source,c);
 const control=new c.Controller();const original=()=>[{launch_failed:id=>cleared.push(id)},'token'];
 const indicator={_getActivationToken:original,_appInfo:{get_id:()=> 'test.desktop'}};
 function focus(id){display.focus_window={appId:id,minimized:false,is_override_redirect:()=>false};display.signals.get('notify::focus-window')?.();if(control.idle){const f=jobs.get(control.idle);jobs.delete(control.idle);f();}}
 return {control,indicator,original,cleared,jobs,focus,display};
}
const s=setup();s.control.track(s.indicator);assert.equal(s.indicator._getActivationToken()[1],'token');assert.equal(s.cleared.length,0);
s.focus('unrelated.desktop');assert.equal(s.cleared.length,0);s.focus('test.desktop');assert.deepEqual(s.cleared,['token']);assert.equal(s.jobs.size,0);s.focus('test.desktop');assert.equal(s.cleared.length,1);
s.control.untrack(s.indicator);assert.equal(s.indicator._getActivationToken,s.original);s.control.destroy();assert.equal(s.display.signals.size,0);
const expired=setup();expired.control.track(expired.indicator);expired.indicator._getActivationToken();const job=[...expired.jobs.values()][0];job();expired.focus('test.desktop');assert.equal(expired.cleared.length,0);expired.control.destroy();
const unknown=setup();delete unknown.indicator._appInfo;unknown.control.track(unknown.indicator);unknown.indicator._getActivationToken();assert.equal(unknown.jobs.size,0);unknown.control.destroy();
const modern=setup('49.0');modern.control.track(modern.indicator);assert.equal(modern.indicator._getActivationToken,modern.original);modern.control.destroy();
const pending=setup();pending.control.track(pending.indicator);pending.indicator._getActivationToken();pending.control.destroy();assert.equal(pending.jobs.size,0);assert.equal(pending.cleared.length,0);
console.log('Tray activation: focus-gated matching, token preservation, unrelated apps, expiry, version guard and cleanup PASS');
