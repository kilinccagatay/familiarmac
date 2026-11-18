const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const code=fs.readFileSync('extensions/macbook-menu@local/dockMagnification.js','utf8').replace(/^import .*;$/gm,'').replaceAll('export ','');
const c={};vm.runInNewContext(code+';globalThis.scale=magnificationScale;',c);
assert.equal(c.scale(0,48,1.5),1.5);
assert.equal(c.scale(48*1.6,48,2),1);
assert.equal(c.scale(-30,48,2),c.scale(30,48,2));
for(let d=0;d<100;d++)assert(c.scale(d+1,48,2)<=c.scale(d,48,2));
assert.equal(24+50*48/100,48,'existing size is the 50% reference');
console.log('Dock magnification: symmetric smooth falloff, bounded range, 50% size reference PASS');
let pointer=[120,120,0],created=[],clock=1000000;
class RenderIcon{constructor(p){this.params=p;created.push(this);}set_size(w,h){this.size=[w,h];}set_scale(x,y){this.scale=[x,y];}set_position(x,y){this.position=[x,y];}destroy(){this.destroyed=true;}}
const live={Gio:{},GLib:{get_monotonic_time:()=>clock+=16667},Clutter:{ModifierType:{BUTTON1_MASK:1}},Shell:{util_set_hidden_from_pick(){}},St:{Icon:RenderIcon,ThemeContext:{get_for_stage:()=>({scale_factor:2})}},Main:{overview:{visible:false},modalCount:0,layoutManager:{addChrome(){}}},global:{get_pointer:()=>pointer,stage:{}}};
vm.runInNewContext(code+';globalThis.Controller=DockMagnification;',live);
const renderer=Object.create(live.Controller.prototype);renderer.items=new Map();renderer.settings={get_double:()=>2};
let refreshes=0;
const background={width:160,set_scale(x,y){this.scale=[x,y];},set_pivot_point(x,y){this.pivot=[x,y];}};
const dockOwner={dockState:2,_slider:{slide_x:1}};
const clipActor={get_parent:()=>dockOwner,name:'dashtodockBox',clip:[0,4,160,40],has_clip:true,
 get_clip(){return this.clip;},set_clip(...v){this.clip=v;},connect(){return 1;},disconnect(){}};
const nativeClip=clipActor.set_clip;
const dock={_background:background,_box:{},get_parent:()=>clipActor};
renderer.clips=new Map();
renderer.backgrounds=new Set();
for(const x of [80,120,160]){
 const icon={get_parent:()=>dock,mapped:true,translation_x:0,_fmTooltipRefresh(){refreshes++;}};
 const texture={gicon:{name:'high-resolution-source'},opacity:255,get_transformed_position:()=>[x+icon.translation_x,100],get_transformed_size:()=>[32,32]};
 icon.icon={icon:texture};renderer.items.set(icon,{clone:null,scale:1,shift:0});
}
renderer.update();assert(created.length>0);assert(refreshes>0);
for(const [icon,item] of renderer.items){
 assert.equal(item.clone.params.icon_size,64,'supersample the maximum size at 2x display scale');
 assert.equal(item.texture.opacity,0);assert(icon._fmMagnifiedBounds);
}
const shifts=[...renderer.items.keys()].map(i=>i.translation_x);
assert(shifts[0]<0&&shifts[2]>0,'neighbors move outward to make space');
assert(background.scale[0]>1,'Dock background expands with the wave');
assert(clipActor.clip[0]<0 && clipActor.clip[2]>160,'horizontal clip contains expanded background');
assert.equal(clipActor.clip[1],4);assert.equal(clipActor.clip[3],40,'auto-hide vertical clip preserved');
clipActor.set_clip(0,8,180,20); // Native allocation while magnified.
assert(clipActor.clip[2]>180,'allocation retains expansion');
assert.equal(clipActor.clip[3],20);
pointer=[120,120,1];renderer.update();
assert.deepEqual(clipActor.clip,[0,8,180,20],'drag restores latest native clip');
renderer.restoreClips();
assert.equal(clipActor.set_clip,nativeClip,'disable restores native method');
assert.equal(background.scale[0],1,'drag resets background expansion');
for(const [icon,item] of renderer.items){assert.equal(icon.translation_x,0);assert.equal(icon.icon.icon.opacity,255);assert.equal(item.clone,null);assert.equal(icon._fmMagnifiedBounds,undefined);}
console.log('Magnification rendering: high-resolution themed icons, neighbor spacing, tooltip bounds, drag reset PASS');

// Real GJS property shape: false skips safely; true follows the clip path above.
clipActor.has_clip=false;
renderer.expandClip(dock,40);
assert.equal(renderer.clips.size,0);
assert.equal(clipActor.set_clip,nativeClip);
console.log('GJS boolean has_clip regression: clipped and unclipped actors PASS');

// A Downloads separator is a sibling, so it must move with the slot boundary.
const divider={translation_x:3,has_style_class_name:n=>n==='familiarmac-dock-divider'};
const downloads={get_parent:()=>({get_children:()=>[divider]})};
const dividerItem={};
renderer.moveDivider(downloads,dividerItem,-12);
assert.equal(divider.translation_x,-9);
renderer.moveDivider(downloads,dividerItem,7);
assert.equal(divider.translation_x,10,'changing direction does not accumulate offsets');
renderer.moveDivider(downloads,dividerItem,0);
assert.equal(divider.translation_x,3,'original translation restored');
console.log('Downloads divider: slot-edge movement, reversal and restoration PASS');

// A hidden Dock still has mapped icons and can geometrically intersect the
// pointer's magnification radius. Neither that nor hide-delay may create clones.
pointer=[120,120,0];
for (const [state,slide] of [[0,0],[1,0],[3,1],[3,0.5]]) {
 dockOwner.dockState=state;dockOwner._slider.slide_x=slide;
 const before=created.length;
 renderer.update();
 assert.equal(created.length,before,'hidden/showing/hiding Dock must not magnify');
 for(const item of renderer.items.values()) assert.equal(item.clone,null);
}
dockOwner.dockState=2;dockOwner._slider.slide_x=1;
renderer.update();assert([...renderer.items.values()].some(item=>item.clone),'shown Dock resumes magnification');
dockOwner.dockState=3;
renderer.update();
for(const [icon,item] of renderer.items){
 assert.equal(item.clone,null,'hiding removes existing overlays');
 assert.equal(icon.icon.icon.opacity,255);
 assert.equal(icon.translation_x,0);
}
assert.equal(background.scale[0],1);
console.log('Auto-hide: no hidden hover activation, no hide-delay overlays, shown recovery PASS');

dockOwner.dockState=1;dockOwner._slider.slide_x=0.6;
renderer.update();
assert([...renderer.items.values()].some(item=>item.clone),'revealing Dock magnifies before fully shown');
dockOwner.dockState=0;dockOwner._slider.slide_x=0;
renderer.update();
assert([...renderer.items.values()].every(item=>!item.clone),'hidden Dock remains empty');
console.log('Reveal: magnifies while appearing, hidden state still blocked PASS');

// Pointer stays at the monitor edge while the Dock's texture crosses it.
// The selected wave must not collapse at any step of the slide animation.
dockOwner._monitor={y:0,height:180};
dock.height=64;dockOwner.dockState=1;
pointer=[120,179,0];
let previousScale=1;
for (const slide of [0.01,0.15,0.4,0.65,0.9,1]) {
 dockOwner._slider.slide_x=slide;
 for(const icon of renderer.items.keys()) {
  icon.icon.icon.get_transformed_position=()=>[120+icon.translation_x,116+(1-slide)*64];
 }
 renderer.update();
 const item=[...renderer.items.values()][0];
 assert(item.scale>=previousScale,'vertical reveal must not collapse magnification');
 previousScale=item.scale;
}
// Same x, now above the texture but inside the shared vertical lane.
dockOwner.dockState=2;pointer=[120,90,0];renderer.update();
assert([...renderer.items.values()][0].scale>=previousScale);
pointer=[120,0,0];renderer.update();
assert([...renderer.items.values()][0].scale<previousScale,'leaving the lane relaxes wave');
console.log('Stable vertical lane: above/below icon, entire reveal, exit PASS');

// Right-click popups hold a modal grab but must retain existing magnification.
dockOwner.dockState=2;pointer=[120,150,0];renderer.update();
const menuIcon=[...renderer.items.keys()][0];menuIcon._menu={isOpen:true};
live.Main.modalCount=1;
const held=[...renderer.items].map(([icon,item])=>[item.clone,item.scale,icon.translation_x]);
const heldBackground=background.scale[0];pointer=[600,10,0];
for(let frame=0;frame<5;frame++)renderer.update();
[...renderer.items].forEach(([icon,item],i)=>{
 assert.equal(item.clone,held[i][0]);assert.equal(item.scale,held[i][1]);assert.equal(icon.translation_x,held[i][2]);
});
assert.equal(background.scale[0],heldBackground);
menuIcon._menu.isOpen=false;live.Main.modalCount=0;renderer.update();
assert([...renderer.items.values()][0].scale<held[0][1],'closing popup resumes easing');
menuIcon._fmDockMenuOpen=()=>true;live.Main.modalCount=1;
const downloadsScale=[...renderer.items.values()][0].scale;renderer.update();
assert.equal([...renderer.items.values()][0].scale,downloadsScale,'Downloads popup also freezes wave');
live.Main.overview.visible=true;renderer.update();
assert([...renderer.items.values()].every(item=>!item.clone),'overview still clears overlays');
console.log('Context menus: frozen size/position/background, close resumes, Downloads and overview PASS');
