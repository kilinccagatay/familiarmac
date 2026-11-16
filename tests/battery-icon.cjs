const fs=require('fs'),vm=require('vm'),assert=require('assert');
let callback,disconnected=0,repaints=0,visible;
const ctx={St:{DrawingArea:class{connect(){}queue_repaint(){repaints++}destroy(){}}},Clutter:{ActorAlign:{CENTER:1}}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/batteryIcon.js','utf8').replace(/^import .*;$/gm,'').replace(/export /g,'')+'\nglobalThis.B=BatteryIcon;globalThis.model=batteryDisplay',ctx);
assert.equal(ctx.model({IsPresent:true,Percentage:130,State:4}).text,'100');assert.equal(ctx.model({IsPresent:true,Percentage:NaN}).text,'—');assert.equal(ctx.model({IsPresent:false}).present,false);
assert.equal(ctx.model({IsPresent:true,Percentage:12,State:2}).low,true);assert.equal(ctx.model({IsPresent:true,Percentage:12,State:1}).low,false);
const proxy={IsPresent:true,Percentage:75,State:1,connect(_s,f){callback=f;return 9},disconnect(id){assert.equal(id,9);disconnected++}};
const b=new ctx.B(proxy,p=>visible=p);assert.equal(b.state.charging,true);assert.equal(visible,true);proxy.Percentage=42;proxy.State=2;callback();assert.equal(b.state.text,'42');assert.equal(b.state.charging,false);proxy.IsPresent=false;callback();assert.equal(visible,false);assert.equal(repaints,3);b.destroy();assert.equal(disconnected,1);
console.log('Battery glyph clamping, unknown/missing, charging/low states and signal cleanup PASS');
