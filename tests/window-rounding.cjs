const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/../overrides/rounded-window-corners/manager/utils.js','utf8');
const functions=['unwrapActor','getRoundedCornersEffect'].map(name=>source.match(new RegExp('export function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))[0].replace('export ',''));
const context={ROUNDED_CORNERS_EFFECT:'rounded',};vm.runInNewContext(functions.join('\n'),context);
const effect={};const inner={get_effect:()=>{throw Error('Interior content must not be clipped');}};
const outer={firstChild:inner,get_first_child:()=>inner,get_effect:name=>{assert.equal(name,'rounded');return effect;}};
assert.equal(context.unwrapActor(outer),outer);assert.equal(context.getRoundedCornersEffect(outer),effect);
console.log('Rounding attachment and lookup both target the outer window: PASS');
const boundsCode=source.match(/export function computeBounds\([\s\S]*?\n\}/)[0].replace('export ','');
const boundsContext={getPref:()=>false};vm.runInNewContext(boundsCode,boundsContext);
const frame={width:1440,height:850,metaWindow:{maximizedHorizontally:true,maximizedVertically:true}};
let bounds=boundsContext.computeBounds(frame,[0,0,0,0]);
assert.deepEqual(JSON.parse(JSON.stringify(bounds)),{x1:0,y1:0,x2:1440,y2:850});
frame.metaWindow.maximizedHorizontally=false;frame.metaWindow.maximizedVertically=false;
bounds=boundsContext.computeBounds(frame,[0,0,0,0]);assert.equal(bounds.x1,1);assert.equal(bounds.y1,1);
console.log('Maximized clipping reaches all work-area edges; floating inset preserved: PASS');

const safety=source.match(/export function safeEffectSize\([\s\S]*?\n\}/)[0].replace('export ','');
vm.runInNewContext(safety,context);
assert.equal(context.safeEffectSize(11700,7446,70),false,'Remote multi-monitor window must not allocate huge effect targets');
assert.equal(context.safeEffectSize(2880,1800,70),true,'Current display retains its rounding');
assert.equal(context.safeEffectSize(3840,2160,140),true,'4K display retains its rounding');
for(const v of [0,-1,Infinity,NaN])assert.equal(context.safeEffectSize(v,100,70),false);
assert.equal(context.safeEffectSize(4096,4096,70),false,'Shadow padding counts toward allocation budget');
console.log('Offscreen effect budget: oversized remote windows, invalid dimensions and normal HiDPI windows PASS');

{
const shadowCode=source.match(/export function updateShadowActorStyle\([\s\S]*?\n\}/)[0].replace('export ','');
const shadowContext={CLIP_SHADOW_EFFECT:'shadow-clip',ClipShadowEffect:class{},SHADOW_PADDING:70,global:{stage:{}},St:{ThemeContext:{get_for_stage:()=>({scaleFactor:1})}},windowScaleFactor:()=>1,boxShadowCss:()=>'',getPref:()=>({smoothing:.2})};
vm.runInNewContext(shadowCode,shadowContext);
let effect={},redraws=0,removed=0,added=0;
const shadowActor={firstChild:{queue_redraw(){redraws++;}},remove_effect_by_name(){effect=null;removed++;},get_effect(){return effect;},add_effect_with_name(_,value){effect=value;added++;}};
const pad={left:0,right:0,top:0,bottom:0};
shadowContext.updateShadowActorStyle({},shadowActor,12,{opacity:0},pad);
assert.equal(effect,null);assert.equal(shadowActor.opacity,0);assert.equal(redraws,0);
shadowContext.updateShadowActorStyle({},shadowActor,12,{opacity:60},pad);
assert.ok(effect);assert.equal(shadowActor.opacity,255);assert.equal(added,1);assert.equal(redraws,1);
shadowContext.updateShadowActorStyle({maximizedHorizontally:true},shadowActor,12,{opacity:60},pad);
assert.equal(effect,null);assert.equal(shadowActor.opacity,0);
shadowContext.updateShadowActorStyle({},shadowActor,12,{opacity:60},pad);
assert.equal(added,2);assert.equal(shadowActor.opacity,255);
console.log('Disabled/maximized shadows release buffers and recreate clipping when visible: PASS');

}
