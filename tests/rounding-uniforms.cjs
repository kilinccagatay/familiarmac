const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/../overrides/rounded-window-corners/effect/rounded_corners_effect.js','utf8');
let serial=0;
class FakeEffect {
 constructor(){this.id=++serial;this.uploads=[];this.repaints=0;this.actor={get_width:()=>800,get_height:()=>600};}
 get_uniform_location(key){return `${this.id}:${key}`;}
 set_uniform_float(key,count,values){assert.ok(key.startsWith(`${this.id}:`),'Locations must belong to this pipeline');assert.equal(values.length,count);assert.ok(values.every(Number.isFinite));this.uploads.push({key,values});}
 queue_repaint(){this.repaints++;}
}
const ctx={Shell:{GLSLEffect:FakeEffect},GObject:{registerClass:(_,cls)=>cls},readShader:()=>['',''],getPref:()=>0};
vm.runInNewContext(source.replace(/^import .*;\n/gm,'').replace('export const RoundedCornersEffect','globalThis.RoundedCornersEffect').replace('import.meta.url',"'test'"),ctx);
const config={borderColor:[0,0,0,0],borderRadius:12,padding:{left:0,right:0,top:0,bottom:0},smoothing:.2};
const bounds={x1:0,y1:0,x2:800,y2:600};
const a=new ctx.RoundedCornersEffect(),b=new ctx.RoundedCornersEffect();
a.updateUniforms(1,config,bounds);b.updateUniforms(1,config,bounds);
const first=a.uploads.length;
for(let i=0;i<100;i++)a.updateUniforms(1,config,bounds);
assert.equal(a.uploads.length,first);assert.equal(a.repaints,1,'Unchanged geometry must not queue repaint');
a.actor.get_width=()=>1600;a.updateUniforms(2,config,bounds);assert.equal(a.repaints,2);
a.updateUniforms(1,{...config,borderRadius:0},bounds);
a.updateUniforms(1,config,{x1:10,y1:20,x2:18,y2:26});
const radius=a.uploads.filter(x=>x.key.endsWith(':clipRadius')).at(-1).values[0];assert.equal(radius,3,'Radius must fit the shorter axis');
// Compare the specialized shader expression against the original superellipse.
for(let x=0;x<=32;x+=.125)for(let y=0;y<=32;y+=.125){
 const before=Math.pow(Math.pow(x,4)+Math.pow(y,4),.25);
 const after=Math.sqrt(Math.sqrt(x*x*x*x+y*y*y*y));
 assert.ok(Math.abs(before-after)<1e-10);
}
console.log('Per-pipeline uniforms, unchanged-geometry cache, scale/zero-radius/small-window handling and equivalent squircle math: PASS');
