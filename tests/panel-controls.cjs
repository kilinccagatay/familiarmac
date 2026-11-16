const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const root = __dirname + '/..';
let source = fs.readFileSync(root+'/extensions/macbook-menu@local/controlCenter.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class');
const panelClasses=new Set(), menuClasses=new Set(); let added=0,destroyed=0;
const panel={add_style_class_name:x=>panelClasses.add(x),remove_style_class_name:x=>panelClasses.delete(x),menu:{box:{add_style_class_name:x=>menuClasses.add(x),remove_style_class_name:x=>menuClasses.delete(x)}},_indicators:{add_child:()=>added++}};
const ctx={Main:{panel:{statusArea:{quickSettings:panel}}},Gio:{File:{new_for_path:x=>x},FileIcon:class{}},St:{Icon:class{destroy(){destroyed++}}}};
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
