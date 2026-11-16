const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const root = __dirname + '/..';
let source = fs.readFileSync(root+'/extensions/macbook-menu@local/controlCenter.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class');
const panelClasses=new Set(), menuClasses=new Set(); let added=0,destroyed=0;
const panel={add_style_class_name:x=>panelClasses.add(x),remove_style_class_name:x=>panelClasses.delete(x),menu:{connect:()=>1,disconnect:()=>{},box:{add_style_class_name:x=>menuClasses.add(x),remove_style_class_name:x=>menuClasses.delete(x)}},_indicators:{add_child:()=>added++}};
const ctx={WifiSurface:class{constructor(){this.actor={}}destroy(){}},BatterySurface:class{constructor(){this.actor={}}sync(){}destroy(){}},ControlSurface:class{constructor(){this.actor={}}syncMedia(){}destroy(){}},StatusButtons:class{destroy(){}},Main:{panel:{statusArea:{quickSettings:panel}}},Gio:{File:{new_for_path:x=>x},FileIcon:class{}},St:{Icon:class{destroy(){destroyed++}}}};
vm.runInNewContext(source+'\nglobalThis.C=ControlCenter;',ctx);
const c=new ctx.C('/tmp');assert.equal(added,1);assert.equal(menuClasses.size,1);c.destroy();c.destroy();assert.equal(destroyed,1);assert.equal(menuClasses.size,0);assert.equal(panelClasses.size,0);
ctx.Main.panel.statusArea.quickSettings=null;new ctx.C('/tmp').destroy();
const manager=fs.readFileSync(root+'/overrides/appmenu/menuManager.js','utf8');
const order=manager.slice(manager.indexOf('        const helpLabels'),manager.indexOf('        // Ensure we have exactly'));
for(const label of ['Help','Yardım','_Help']) {
 const action=()=>{};const data=[{label:'App'},{label,action},{label:'Window'},{label:'Custom'}];
 vm.runInNewContext(order,{newMenuData:data,_:()=> 'Yardım'});
 assert.deepEqual(data.map(x=>x.label),['App','Window','Custom',label]);assert.equal(data[3].action,action);
}
console.log('Panel control cleanup and localized Help ordering passed');
// Reorder native actors without reparenting: submenu metadata stays attached.
function actor(name){return {name,visible:true,get_parent:()=>grid,connect:()=>1,disconnect(){},destroy(){const i=children.indexOf(this);if(i>=0)children.splice(i,1)}}}
const children=[];const grid={get_children:()=>children.slice(),set_child_at_index(a,i){children.splice(children.indexOf(a),1);children.splice(i,0,a)}};
const hardware={};for(const name of ['_system','_brightness','_volumeOutput','_network','_bluetooth','_darkMode']){hardware[name]={quickSettingsItems:[actor(name)]};children.push(...hardware[name].quickSettingsItems)}
const before=children.slice();Object.assign(panel,hardware);grid.show=()=>{};panel.menu.box.insert_child_at_index=()=>{};panel.menu._grid=grid;panel.menu.addItem=a=>children.push(a);
ctx.Main.panel.statusArea.quickSettings=panel;ctx.GLib={get_language_names:()=>['en_US']};let banners=true;
ctx.Gio.Settings=class{get_boolean(){return banners}set_boolean(k,v){banners=v}connect(){return 1}disconnect(){}};
ctx.QuickSettings={QuickToggle:class{constructor(){Object.assign(this,actor('focus'));delete this.connect;}connect(n,fn){this.click=fn;return 1}}};ctx.St.Label=class{constructor(){Object.assign(this,actor('label'))}};
const cc=new ctx.C('/tmp');cc.arrange();cc.arrange();assert.equal(children.filter(x=>x.name==='focus').length,1);
assert.ok(children.indexOf(hardware._network.quickSettingsItems[0])<children.indexOf(hardware._brightness.quickSettingsItems[0]));
assert.equal(children.at(-1),hardware._system.quickSettingsItems[0]);cc.focus.checked=true;cc.focus.click();assert.equal(banners,false);
cc.destroy();assert.deepEqual(children,before);

// Shared hardware popup must follow every individual button and restore its
// original Control Center anchor/grid after closing (including switching).
const statusSource=fs.readFileSync(root+'/extensions/macbook-menu@local/statusButtons.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class');
vm.runInNewContext(statusSource+'\nglobalThis.S=StatusButtons',ctx);
const sm=Object.create(ctx.S.prototype);sm.mask=[];sm.spans=[];
const detailGrid={layout_manager:{get_child_meta:(_g,item)=>item.meta},get_children:()=>[item]};
const item={visible:true,connect(){return 1},disconnect(){},hide(){this.visible=false},meta:{column_span:1},get_parent:()=>detailGrid};
const control={};const detailMenu={sourceActor:control,focusActor:control,_arrowAlignment:0,_grid:detailGrid,
 box:{add_style_class_name(){},remove_style_class_name(){}},close(){this.isOpen=false;sm.restore()},
 open(){this.isOpen=true;this.openedAt=this.sourceActor}};
sm.panel={menu:detailMenu,remove_style_pseudo_class(){}};sm.owner={labels:[],arrange(){}};
for(const key of ['_network','_bluetooth','_volumeOutput','_system']){
 sm.panel[key]={quickSettingsItems:[item]};
 const button={add_style_pseudo_class(){},remove_style_pseudo_class(){}};
 sm.open(key,button);assert.equal(detailMenu.openedAt,button);assert.equal(detailMenu.focusActor,button);
 assert.equal(item.meta.column_span,key === '_system' ? 1 : 2);assert.equal(detailMenu._arrowAlignment,0.5);
 detailMenu.close();assert.equal(detailMenu.sourceActor,control);assert.equal(detailMenu.focusActor,control);
 assert.equal(item.meta.column_span,1);assert.equal(detailMenu._arrowAlignment,0);
}
console.log('All hardware detail anchors, focus targets and grid spans restore correctly');
