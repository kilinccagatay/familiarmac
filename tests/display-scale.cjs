const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const emitter=()=>({signals:new Map(),connect(n,f){this.signals.set(n,f);return n;},disconnect(n){this.signals.delete(n);}});
let next=1;const timers=new Map(),laters=new Map(),context=emitter(),layout=emitter();
class Icon {
 constructor(size){this.icon_size=size;this.styles=0;this.frozen=0;this.children=[];}
 ensure_style(){this.styles++;} freeze_notify(){this.frozen++;} thaw_notify(){this.frozen--;}
 get_children(){return this.children;}
}
const named=new Icon(42),file=new Icon(16),css=new Icon(-1),app=new Icon(24);
const windowGroup={get_children:()=>[app]};
const root={get_children:()=>[named,file,css,windowGroup]};
const c={St:{Icon,ThemeContext:{get_for_stage:()=>context}},Main:{layoutManager:layout,uiGroup:root},
 GLib:{PRIORITY_DEFAULT:0,SOURCE_REMOVE:false,timeout_add(_p,_ms,f){const id=next++;timers.set(id,f);return id;},Source:{remove:id=>timers.delete(id)}},
 Meta:{LaterType:{BEFORE_REDRAW:1}},Extension:class{},global:{stage:{},window_group:windowGroup,compositor:{get_laters:()=>({add(_t,f){const id=next++;laters.set(id,f);return id;},remove:id=>laters.delete(id)})}}};
vm.runInNewContext(fs.readFileSync('extensions/familiarmac-display-scale@local/extension.js','utf8').replace(/^import .*;$/gm,'').replace('export function','function').replace('export default class','class')+';globalThis.DisplayScale=DisplayScale;',c);
function flush(map){const callbacks=[...map.values()];map.clear();for(const f of callbacks)f();}
const extension=new c.DisplayScale();extension.enable();
layout.signals.get('monitors-changed')();context.signals.get('notify::scale-factor')();assert.equal(timers.size,1);
flush(timers);assert.equal(laters.size,1);flush(laters);
for(const [icon,size] of [[named,42],[file,16],[css,-1]]){assert.equal(icon.icon_size,size);assert.equal(icon.styles,1);assert.equal(icon.frozen,0);}
assert.equal(app.styles,0,'Never touch client window surfaces');
layout.signals.get('monitors-changed')();flush(timers);layout.signals.get('monitors-changed')();assert.equal(laters.size,0,'Cancel stale redraw during another mode change');
flush(timers);extension.disable();assert.equal(laters.size,0);assert.equal(timers.size,0);assert.equal(layout.signals.size,0);assert.equal(context.signals.size,0);
extension.enable();extension.disable();assert.equal(timers.size,0);
console.log('Display scale: named/file/CSS icon sizes preserved, client windows excluded, events coalesced, stale redraw cancelled, teardown PASS');
