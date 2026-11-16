// Exercise callback visibility and asset selection without changing the live display.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname+'/..';
const code=fs.readFileSync(root+'/config/macbook.script','utf8').replace(/^\s*#.*$/gm,'').replace(/\bfun\s+/g,'function ');
let mode='boot';const callbacks={};
const image=(name)=>{assert.ok(fs.existsSync(root+'/assets/boot/'+name));return {Scale(){return this;}}};
const context={Math:{...Math,Int:Math.floor,Sin:Math.sin},Window:{GetHeight:()=>832,GetWidth:()=>1280,GetX:()=>0,GetY:()=>0,SetBackgroundTopColor(){},SetBackgroundBottomColor(){}},Image:image,
Sprite:()=>({SetPosition(){},SetX(){},SetImage(){},SetOpacity(v){this.opacity=v;}}),
Plymouth:new Proxy({GetMode:()=>mode},{get:(target,key)=>target[key]||((fn)=>callbacks[key]=fn)})};
vm.runInNewContext(code,context);
callbacks.SetRefreshFunction();assert.equal(context.logo.opacity,1);assert.equal(context.track.opacity,1);
assert.equal(context.bar_y,748);assert.equal(context.size,88);
for(const next of ['shutdown','reboot','suspend']){mode=next;callbacks.SetRefreshFunction();for(const key of ['logo','track','fill','activity'])assert.equal(context[key].opacity,0);}
mode='boot';callbacks.SetBootProgressFunction(1,.5);callbacks.SetRefreshFunction();assert.equal(context.logo.opacity,1);assert.ok(context.fill.opacity>0);
console.log('Boot/reboot/shutdown visibility and asset selection: PASS (callback simulation)');
