const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const c={};vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/missionControl.js','utf8').split('export class MissionControl')[0].replace(/^import .*;$/gm,'').replace(/^export /gm,''),c);
const active={},other={},a={metaWindow:active},b={metaWindow:other};
const box={get_width:()=>1000,get_height:()=>600};
const slots=[[0,0,480,300,a],[520,0,480,300,b]];
const result=c.singleWindowSlot(slots,box,active);
assert.equal(result[0][2],480);assert(result[1][2]<480);
for(let i=0;i<slots.length;i++){const [x,y,w,h]=result[i],s=slots[i];assert(x>=s[0]&&y>=s[1]&&x+w<=s[0]+s[2]&&y+h<=s[1]+s[3]);assert(Math.abs(w/h-s[2]/s[3])<1e-10);}
assert.equal(c.singleWindowSlot(slots,box,{}),slots,'Unknown focus must leave the layout unchanged');
assert.equal(slots[1][2],480,'Never mutate native slots');
const single=c.singleWindowSlot([[0,0,1000,600,a]],box,active)[0];assert(single[2]<=720&&single[3]<=432);assert.equal(single[4],a);
console.log('Mission Control layout: focus emphasis, no overlaps, preserved aspect ratios and native slot immutability PASS');
const lifecycle={global:{workspace_manager:{}},Meta:{}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/missionControl.js','utf8').replace(/^import .*;$/gm,'').replace('export class MissionControl','this.MissionControl=class MissionControl').replace(/^export /gm,''),lifecycle);
const mission=Object.create(lifecycle.MissionControl.prototype),space={};let exited=0;
const full={unmake_fullscreen:()=>exited++,delete:()=>assert.fail('Fullscreen space control must never close the application')};mission.spaces=new Map([[full,{space}]]);
mission.closeSpace(space);assert.equal(exited,1);
console.log('Fullscreen space control exits fullscreen without closing the application PASS');
