const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('extensions/familiarmac-lock@local/extension.js','utf8');
const method=source.match(/    _syncPanel\(\) \{[\s\S]*?\n    \}/)[0];
let visible=true, onVisible=()=>{};
const actor={get visible(){return visible},set visible(v){if(visible===v)return;visible=v;onVisible()},hide(){this.visible=false}};
const c={Main:{sessionMode:{currentMode:'unlock-dialog'},panel:{statusArea:{dateMenu:{container:actor}}}}};
vm.runInNewContext('globalThis.instance={'+method+'}',c);
onVisible=()=>{if(c.Main.sessionMode.currentMode==='unlock-dialog')c.instance._syncPanel()};
c.instance._syncPanel();assert.equal(visible,false);
// Reproduce GNOME showing the panel container after the mode change.
actor.visible=true;assert.equal(visible,false);
actor.visible=true;assert.equal(visible,false);
c.Main.sessionMode.currentMode='user';c.instance._syncPanel();assert.equal(visible,true);
actor.visible=false;c.Main.sessionMode.currentMode='unlock-dialog';c.instance._syncPanel();
c.Main.sessionMode.currentMode='user';c.instance._syncPanel();assert.equal(visible,false);
console.log('Lock panel clock: late panel rebuilds stay hidden; desktop visibility restored PASS');
