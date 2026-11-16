const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const c={};vm.runInNewContext(fs.readFileSync('extensions/familiarmac-lock@local/geometry.js','utf8').replace('export function','function'),c);
for (const scale of [1,2]) for (const h of [768,900,1080]) for (const keyboard of [0,300]) {
 const p=c.positions(1440*scale,h*scale,340*scale,200*scale,400*scale,120*scale,keyboard*scale,scale);
 assert.equal(p.promptX,550*scale);
 assert.ok(p.promptY>=0);
 assert.ok(p.promptY+200*scale <= (h-keyboard)*scale);
 assert.ok(p.notificationHeight>=0);
 if(p.clockVisible) assert.ok(p.clockY+120*scale+24*scale<=p.promptY);
}
const small=c.positions(800,400,300,300,400,120,100,1);
assert.equal(small.clockVisible,false);assert.equal(small.notificationHeight,0);
console.log('Lock layout: keyboard clearance, compact displays, scale factors, clock/prompt separation PASS');
