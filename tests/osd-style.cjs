const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Actor {
 constructor(p={}){Object.assign(this,{opacity:255,visible:true,classes:new Set(),signals:new Map(),children:[]},p)}
 connect(n,f){const id=this.signals.size+1;this.signals.set(id,[n,f]);return id}disconnect(id){this.signals.delete(id)}
 add_child(a){this.children.push(a)}add_style_class_name(s){this.classes.add(s)}remove_style_class_name(s){this.classes.delete(s)}
 get_style(){return this.style??null}set_style(s){this.style=s}destroy(){this.destroyed=true}
}
const window=new Actor({_hbox:new Actor({vertical:false}),_vbox:new Actor(),_level:new Actor({value:0.5})});
let shown=0;const original=()=>shown++;const manager={_osdWindows:[window],_showOsdWindow:original};
const ctx={St:{BoxLayout:Actor,Widget:Actor},Main:{osdWindowManager:manager}};
const code=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/osdStyle.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class');
vm.runInNewContext(code+';globalThis.C=OsdStyle',ctx);const style=new ctx.C();
for(const name of ['audio-volume-high-symbolic','display-brightness-symbolic','keyboard-brightness-symbolic'])manager._showOsdWindow(0,{to_string:()=>name});
assert.equal(shown,3);assert.equal(style.saved.size,1);assert.equal(window._hbox.vertical,true);
const ticks=window._vbox.children[0].children;assert.equal(ticks.length,16);assert.equal(ticks.filter(t=>t.classes.has('filled')).length,8);
manager._showOsdWindow(0,{to_string:()=> 'other-symbolic'});assert.equal(style.saved.size,0);assert.equal(window._hbox.vertical,false);assert.equal(window._level.opacity,255);
style.destroy();assert.equal(manager._showOsdWindow,original);assert.equal(window._level.signals.size,0);
console.log('OSD hardware-only styling, segments, reuse and complete restoration PASS');

const css=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/stylesheet.css','utf8');
const osd=css.match(/\.osd-window\.fm-hardware-osd \{([^}]+)\}/)[1];
assert.match(osd,/width: 140px/);assert.match(osd,/height: 140px/);
assert.match(css,/\.osd-window\.fm-hardware-osd > StIcon \{[^}]*color: #ffffff/);
