const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('overrides/appmenu/menuManager.js', 'utf8');
const method = source.match(/    rebuildMenu\(children, openHandler = null\) \{[\s\S]*?\n    \}\n\n    destroy/)[0].replace(/\n\n    destroy$/, '');
const context = {};
vm.runInNewContext(`globalThis.rebuild = ({${method}}).rebuildMenu`, context);
let queried = 0;
function menu(rows=[], isOpen=false) {
 return {isOpen, _getMenuItems:()=>rows, removeAll(){rows=[];}, setRows(v){rows=v;},
 open(){this.isOpen=true;if (!button._restoringMenu) queried++;}};
}
const oldNested=menu([],true), oldChild=menu([{label:{text:'Recent'},menu:oldNested}],true);
const root=menu([{label:{text:'Open'},menu:oldChild}],true);
const nested=menu(), child=menu([{label:{text:'Recent'},menu:nested}]);
const button={menu:root,_disconnectMenuSignals(){},_setMenuOpenHandler(){},
 _buildSubMenu(){root.setRows([{label:{text:'Open'},menu:child}]);}};
context.rebuild.call(button,[]);
assert.equal(child.isOpen,true);assert.equal(nested.isOpen,true);
assert.equal(queried,0);assert.equal(button._restoringMenu,false);
// Removed actions must not reopen an unrelated submenu at the same index.
button._buildSubMenu=()=>root.setRows([{label:{text:'Different'},menu:menu()}]);
context.rebuild.call(button,[]);
assert.equal(root._getMenuItems()[0].menu.isOpen,false);
console.log('Lazy submenu replacement preserves open path without repeat requests PASS');
