const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/statusButtons.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class');
const ctx={};vm.runInNewContext(src+'\nglobalThis.C=StatusButtons',ctx);
function actor(visible=true){let v=visible;const callbacks=new Map();return {get visible(){return v},set visible(x){if(v===x)return;v=x;for(const cb of callbacks.values())cb()},hide(){this.visible=false},connect(n,f){callbacks.set(1,f);return 1},disconnect(id){callbacks.delete(id)}}}
const sound=actor(),network=actor(),hidden=actor(false),overlay=actor(),heading=actor();
const menu={isOpen:false,close(){this.isOpen=false},open(){this.isOpen=true},box:{add_style_class_name(){},remove_style_class_name(){}},_grid:{get_children:()=>[sound,network,hidden,overlay,heading],layout_manager:{_overlay:overlay}}};
menu._grid.layout_manager.get_child_meta=(_grid,item)=>item.meta;
for(const item of [sound,network,hidden,overlay,heading]) {item.meta={column_span:1};item.get_parent=()=>menu._grid;}
const c=Object.create(ctx.C.prototype);Object.assign(c,{panel:{remove_style_pseudo_class(name){assert.equal(name,'active');},menu,_volumeOutput:{quickSettingsItems:[sound]}},owner:{arrange(){},labels:[{item:sound,label:heading}]},mask:[],spans:[]});
const button={add_style_pseudo_class(){},remove_style_pseudo_class(){}};
c.open('_volumeOutput',button);assert.equal(sound.visible,true);assert.equal(network.visible,false);assert.equal(heading.visible,true);assert.equal(overlay.visible,true);
hidden.visible=true;assert.equal(hidden.visible,false);c.restore();assert.equal(network.visible,true);assert.equal(hidden.visible,true);
c.open('_volumeOutput',button);c.open('_volumeOutput',button);assert.equal(menu.isOpen,false);assert.equal(network.visible,true);assert.equal(c.mask.length,0);
console.log('Independent status detail filtering, state changes, repeated click and restoration passed');
