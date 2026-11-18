const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const c={};vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/afterStartup.js','utf8').replace('export function','function'),c);
function fixture(starting){let event,idle,calls=0;const layout={_startingUp:starting,connect:(_s,cb)=>(event=cb,1),disconnect:()=>event=null};const loop={idle_add:(_p,cb)=>(idle=cb,2),source_remove:()=>idle=null};const cancel=c.afterStartup(layout,loop,()=>calls++);return {cancel,start:()=>event?.(),tick:()=>{let cb=idle;idle=null;cb?.();},count:()=>calls};}
let f=fixture(true);f.tick();assert.equal(f.count(),0);f.start();assert.equal(f.count(),0);f.tick();assert.equal(f.count(),1);
f=fixture(true);f.cancel();f.start();f.tick();assert.equal(f.count(),0);
f=fixture(false);assert.equal(f.count(),0);f.cancel();f.tick();assert.equal(f.count(),0);
f=fixture(false);f.tick();assert.equal(f.count(),1);f.cancel();
console.log('Overview startup waits for Shell initialization, uses idle allocation, and cancels on disable PASS');
