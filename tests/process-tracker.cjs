const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let source=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/processTracker.js','utf8');
source=source.replace(/^import .*;$/gm,'').replace(/export /g,'')+'\nglobalThis.Tracker=ProcessTracker;';
const ctx={};vm.runInNewContext(source,ctx);
const identities=new Map([[20,'100']]);let pids=[20];
const tracker=new ctx.Tracker(pid=>identities.get(pid)??null);
const app={get_id:()=> 'example.desktop',get_pids:()=>pids};
assert.equal(tracker.isRunning(app),true);
pids=[];assert.equal(tracker.isRunning(app),true); // no windows, same process alive
identities.set(20,'200');assert.equal(tracker.isRunning(app),false); // reused PID
pids=[21];identities.set(21,'300');assert.equal(tracker.isRunning(app),true);
pids=[];identities.delete(21);assert.equal(tracker.isRunning(app),false); // exited
console.log('Background process, exit and PID reuse: PASS');
