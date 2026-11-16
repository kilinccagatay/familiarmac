const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/panelOrder.js','utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');
const ctx={};vm.runInNewContext(source+'\nglobalThis.move=moveBefore;globalThis.C=PanelOrder',ctx);
assert.deepEqual(Array.from(ctx.move(['a','b','c'],'a','c',true)),['b','c','a']);
assert.deepEqual(Array.from(ctx.move(['a','b','c'],'c','a',false)),['c','a','b']);
assert.deepEqual(Array.from(ctx.move(['a','b'],'missing','b',true)),['a','b']);
const children=[];const box={get_children:()=>children.slice(),set_child_at_index(a,i){children.splice(children.indexOf(a),1);children.splice(i,0,a)}};
const area={};for(const id of ['sound','battery','clock']){const actor={get_parent:()=>box};area[id]={container:actor};children.push(actor)}
ctx.Main={panel:{statusArea:area}};const p=Object.create(ctx.C.prototype);p.box=box;p.apply(['clock','clock','obsolete','sound']);assert.deepEqual(Array.from(p.order()),['clock','sound','battery']);p.apply(['sound','battery','clock']);assert.equal(children[0],area.sound.container);
const clock=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/panelClock.js','utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');vm.runInNewContext(clock+'\nglobalThis.format=formatPanelDate',ctx);
assert.equal(ctx.format({get_day_of_week:()=>1,get_day_of_month:()=>16,get_month:()=>11,format:()=> '10:50:30'}),'Mon 16 Nov 10:50:30');
console.log('Panel reordering, stale/duplicate saved IDs and English seconds format passed');
