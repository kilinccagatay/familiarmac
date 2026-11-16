const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/launcherDrag.js','utf8').replace(/^import .*;$/gm,'').replace('export function','function');
const idle=new Map();let next=1,removed=[],nativeDestroyed=0;
class Icon {
 constructor(app){this.app=app;this.handlers={};this.dragHandlers={};this._draggable={connect:(name,fn)=>this.dragHandlers[name]=fn};}
 set(p){Object.assign(this,p)}
 get_child(){return {get_parent:()=>null,destroy:()=>nativeDestroyed++}}
 connect(name,fn){(this.handlers[name]??=[]).push(fn)}
 destroy(){for(const f of this.handlers.destroy??[])f()}
}
const ctx={AppDisplay:{AppIcon:Icon},GLib:{idle_add(_p,fn){const id=next++;idle.set(id,fn);return id},source_remove(id){removed.push(id);idle.delete(id)},SOURCE_REMOVE:false}};
vm.runInNewContext(src+'\nglobalThis.make=launcherAppButton',ctx);
let launched=0,closed=0,shown=0,hidden=0,popped=0,pushed=0;
const app={activate(){launched++}};
const dialog={_timeoutId:80,_timer:81,close(){closed++},popModal(){popped++},hide(){hidden++},show(){shown++},pushModal(){pushed++;return true}};
const b=ctx.make(app,dialog,{style_class:'test'});
assert.ok(b instanceof Icon);assert.equal(b.app,app); // native dash recognises source
b.activate();assert.equal(launched,1);assert.equal(closed,1);
b._dragging=true;b.activate();assert.equal(launched,1);
b.dragHandlers['drag-begin']();assert.equal(hidden,1);assert.equal(popped,1);assert.equal(dialog._timeoutId,0);assert.equal(dialog._timer,0);
b.dragHandlers['drag-end'](null,0,true);assert.equal(closed,1); // don't destroy source before DND ungrabs
for(const [id,fn] of idle){idle.delete(id);fn()}assert.equal(closed,2);
b.dragHandlers['drag-end'](null,0,false);
for(const [id,fn] of idle){idle.delete(id);fn()}assert.equal(shown,1);assert.equal(pushed,1);
b.dragHandlers['drag-end'](null,0,true);b.destroy();assert.equal(idle.size,0);assert.equal(nativeDestroyed,1);
console.log('Launcher native app drag: modal release, deferred close, cancellation, cleanup and no drag-launch passed');
