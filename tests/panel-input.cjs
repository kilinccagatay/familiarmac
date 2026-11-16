const fs = require('node:fs');
const assert = require('node:assert/strict');
let methods = new Map();
let cleared = false;
const panel = {queue_relayout() {}};
const Main = {panel, sessionMode: {isLocked: false, isGreeter: false}};
class InjectionManager {
    overrideMethod(proto, name, factory) { methods.set(name, factory); }
    clear() { cleared = true; }
}
const source = fs.readFileSync('extensions/familiarmac-panel-layout@local/extension.js', 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export default class', 'class');
const Layout = new Function('Main', 'Clutter', 'Extension', 'InjectionManager',
    source + '\nreturn PanelLayout;')(Main, {EVENT_STOP: true}, class {}, InjectionManager);
const extension = new Layout();
extension.enable();
let grabs = 0;
const original = () => { grabs++; return 'original'; };
const handler = methods.get('_tryDragWindow')(original);
assert.equal(handler.call(panel, {}), true);
assert.equal(grabs, 0, 'Menu bar background must not start a window grab');
for (const mode of ['isLocked', 'isGreeter']) {
    Main.sessionMode[mode] = true;
    assert.equal(handler.call(panel, {}), 'original');
    Main.sessionMode[mode] = false;
}
assert.equal(handler.call({}, {}), 'original');
assert(!methods.has('_onButtonPress'), 'Keep native menu button dispatch');
extension.disable();
assert(cleared, 'Restore original methods on disable');
console.log('Panel background focus protection and lifecycle PASS');
