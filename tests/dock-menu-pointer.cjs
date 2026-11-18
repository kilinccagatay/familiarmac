const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const ctx={};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/dockMenuPointer.js','utf8').replace(/^import .*;$/gm,'').replaceAll('export ', '')+';globalThis.place=pointerPlacement;globalThis.draw=drawDockOutline;',ctx);
const normal=ctx.place(400,300,0,1440,28,8);
assert.equal(normal.x,372);assert.equal(normal.tip,28);
const edge=ctx.place(1400,300,0,1440,28,8);
assert.equal(edge.x,1132);assert.equal(edge.tip,268);assert.equal(edge.x+edge.tip,1400);
const monitor=ctx.place(1800,300,1440,2880,28,8);assert.equal(monitor.x,1772);
const retina=ctx.place(800,600,0,2880,56,16);assert.equal(retina.x,744);assert.equal(retina.tip,56);
const curves=[];ctx.draw({moveTo(){},lineTo(){},arc(){},closePath(){},curveTo(...a){curves.push(a)}},300,208,12,8,28,12,1);
assert.equal(curves.length,2);assert.equal(curves[0][4],28);assert.equal(curves[0][5],207.5);
assert.equal(curves[0][3],curves[0][5],'horizontal tangent at rounded tip');
assert.equal(curves[1][1],curves[0][5],'continuous tangent on other side');
console.log('Dock pointer: leading alignment, screen edge, second monitor, HiDPI and rounded tip PASS');

// Model BoxPointer's explicit vfunc_allocate: only _border and bin are allocated.
class Area {
 constructor(){this.signals=new Map();this.allocated=false;this.destroyed=false;}
 connect(name,fn){this.signals.set(name,fn);return name;}
 allocate(){this.allocated=true;}
 queue_repaint(){} destroy(){this.destroyed=true;}
}
const native=new Area(),bin=new Area(),classes=new Set();
const pointer={_border:native,bin,children:[native,bin],signals:new Map(),
 _reposition(){},remove_child(a){this.children=this.children.filter(c=>c!==a);},
 add_child(a){this.children.push(a);},set_child_below_sibling(){},
 connect(name,fn){this.signals.set(name,fn);return name;},disconnect(name){this.signals.delete(name);},
 allocate(){this._border.allocate();this.bin.allocate();}};
ctx.St={DrawingArea:Area};
const menu={_boxPointer:pointer,actor:{add_style_class_name:c=>classes.add(c),remove_style_class_name:c=>classes.delete(c)}};
vm.runInNewContext('globalThis.install=installDockMenuPointer;',ctx);
const restore=ctx.install(menu,{}),replacement=pointer._border;
pointer.allocate();assert.equal(replacement.allocated,true,'paint surface receives native allocation');
assert.notEqual(replacement,native);assert.equal(native.destroyed,false);
restore();assert.equal(pointer._border,native);assert.equal(replacement.destroyed,true);assert.equal(classes.size,0);
ctx.install(menu,{});pointer.signals.get('destroy')();assert.equal(native.destroyed,true,'detached native surface cleaned up with menu');
console.log('Dock pointer allocation: uses native border slot, restores native surface, cleans detached actor PASS');
