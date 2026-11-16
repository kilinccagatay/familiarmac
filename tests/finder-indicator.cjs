const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/extension.js','utf8');
const begin=source.indexOf('        this._finderIndicators = new Map();');
const end=source.indexOf('        const tr =',begin);
let count=0, paints=0, tick, onDestroy;
class NativeDots {get _number(){return count;}}
const indicator=new NativeDots();indicator._area={queue_repaint(){paints++;},connect(s,fn){onDestroy=fn;return 1;},disconnect(){}};indicator._computeStyle=()=>{};
const actor={app:{get_id:()=> 'org.gnome.Nautilus.desktop'},_indicator:{_indicators:[indicator]},get_children:()=>[]};
const context={_trashDrop:{track(){}},_dockMenus:{track(){}},_downloadsStack:{track(){}},_dockOrder:{track(){},trackSeparator(){}},_dockLaunch:{track(){}},ProcessTracker:class {isRunning(){return false;}},Main:{uiGroup:{get_children:()=>[{name:'dashtodockContainer',get_children:()=>[actor]},{name:'unrelated',get_children(){throw Error('must not scan unrelated UI');}}]}},GLib:{PRIORITY_DEFAULT:0,SOURCE_CONTINUE:true,timeout_add_seconds:(p,t,fn)=>{tick=fn;return 1;}}};
vm.runInNewContext(source.slice(begin,end),context);
assert.equal(indicator._number,1);assert.equal(paints,1);
tick();assert.equal(paints,1);
count=2;assert.equal(indicator._number,2);
onDestroy();assert.equal(context._finderIndicators.size,0);assert.equal(paints,1);count=0;assert.equal(indicator._number,0);
assert.equal(Object.hasOwn(indicator,'_number'),false);
console.log('Native Finder renderer: persistent dot, real count and restore PASS');
