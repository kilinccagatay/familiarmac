const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const source = fs.readFileSync(__dirname + '/../extensions/macbook-menu@local/extension.js', 'utf8');
const code = source.match(/pointer\._reposition = allocation => \{[\s\S]*?\n        \};/)[0];
let calls = 0;
const actor = {};
const pointer = {_sourceActor: actor, get_parent: () => ({transform_stage_point: x => [true, x, 0]})};
let monitor = {x: 1440, y: 0};
const Main = {layoutManager: {findMonitorForActor: a => {assert.equal(a, actor); return monitor;}}};
const allocation = {y1: 28, set_origin(x, y) {this.x1=x; this.y1=y;}};
const reposition = box => {assert.equal(box, allocation); calls++;};
vm.runInNewContext(code, {pointer, Main, reposition, Math});
pointer._reposition(allocation);
assert.equal(calls, 1); assert.equal(allocation.x1, 1444); assert.equal(allocation.y1, 28);
monitor = null; pointer._reposition(allocation); assert.equal(calls, 2);
pointer._sourceActor = null; pointer._reposition(allocation); assert.equal(calls, 3);
console.log('GNOME 46 single-argument allocation and multi-monitor alignment: PASS');

// Application menu titles use their leading edge regardless of title length.
const appSource = fs.readFileSync(__dirname + '/../overrides/appmenu/menuManager.js', 'utf8');
const appCode = appSource.match(/pointer\._reposition = allocation => \{[\s\S]*?\n      \};/)[0];
let titleX = 77;
const appPointer = {_sourceActor: {get_transformed_position: () => [titleX, 0]},
 _workArea: {x:0,y:28,width:1440,height:900}, get_preferred_size:()=>[0,0,585,350],
 get_parent:()=>({transform_stage_point:x=>[true,x,0]})};
vm.runInNewContext(appCode,{pointer:appPointer,reposition:()=>{},Math});
appPointer._reposition(allocation);assert.equal(allocation.x1,77);
titleX=1200;appPointer._reposition(allocation);assert.equal(allocation.x1,855);
appPointer._workArea={x:1440,y:28,width:1440,height:900};titleX=1517;
appPointer._reposition(allocation);assert.equal(allocation.x1,1517);
assert.equal(allocation.y1,28);
console.log('App menu leading-edge alignment, screen bounds and second monitor PASS');
