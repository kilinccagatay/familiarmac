const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Actor {constructor(p={}){Object.assign(this,p);this.children=[]}add_child(c){this.children.push(c)}connect(){return 1}destroy(){this.destroyed=true}}
let callback,disconnected=false;
const proxy={IsPresent:true,Percentage:74,State:2,connect(_s,f){callback=f;return 1},disconnect(){disconnected=true}};
const ctx={St:{BoxLayout:Actor,Label:Actor,Button:Actor},Clutter:{ActorAlign:{FILL:1}},Util:{spawn(){}}};
const src=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/batterySurface.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class');
vm.runInNewContext(src+';globalThis.B=BatterySurface',ctx);
const b=new ctx.B({panel:{_system:{_systemItem:{powerToggle:{_proxy:proxy}}}}},false);
assert.equal(b.percent.text,'74%');assert.match(b.source.text,/Source: Battery$/);
proxy.State=1;proxy.TimeToFull=121;callback();assert.match(b.source.text,/Power Adapter/);assert.match(b.state.text,/3 min/);
proxy.State=4;callback();assert.equal(b.state.text,'Fully Charged');
proxy.IsPresent=false;callback();assert.equal(b.percent.text,'—');assert.equal(b.state.text,'');
b.destroy();assert.equal(disconnected,true);
console.log('Battery menu: live power source, charge estimate, full/absent state and cleanup PASS');
