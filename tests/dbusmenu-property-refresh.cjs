const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const src = fs.readFileSync('overrides/appmenu/realMenuManager.js', 'utf8');
const queue = src.match(/    _queueMenuPropertyRefresh\(\) \{[\s\S]*?\n    \}/)[0];
const dispose = src.match(/    _disposeCurrentBackend\(\) \{[\s\S]*?\n    \}/)[0];
let next = 0, updates = 0;
const pending = new Map(), unsubscribed = [];
const context = {GLib:{PRIORITY_DEFAULT_IDLE:200,SOURCE_REMOVE:false,
 idle_add(_p, cb){pending.set(++next,cb);return next;},source_remove(id){pending.delete(id);}},
 Gio:{DBus:{session:{signal_unsubscribe(id){unsubscribed.push(id);}}}}};
vm.runInNewContext(`globalThis.methods = ({${queue},${dispose}})`, context);
const manager = Object.assign({_client:{disconnect(){}},_clientSignalIds:[],
 _menuPropertySignal:17,_menuPropertyRefresh:0,_emitChanged(){updates++;}},context.methods);
// Multiple property messages cause one refresh, after cache updates settle.
manager._queueMenuPropertyRefresh();manager._queueMenuPropertyRefresh();
assert.equal(pending.size,1);assert.equal(updates,0);
const [id,cb] = [...pending][0];pending.delete(id);cb();
assert.equal(updates,1);assert.equal(manager._menuPropertyRefresh,0);
// Switching apps cancels a queued refresh and disconnects the old publisher.
manager._queueMenuPropertyRefresh();manager._disposeCurrentBackend();
assert.equal(pending.size,0);assert.deepEqual(unsubscribed,[17]);
manager._queueMenuPropertyRefresh();assert.equal(pending.size,0);
assert.equal(manager._client,null);
console.log('DBus menu property bursts and backend cleanup PASS');
