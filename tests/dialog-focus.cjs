const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
let actions = 0;
const focusEvents = [];
class NativeDialog {
 constructor(){this.children=[];this._initialKeyFocus=null;this.buttonLayout={get_children:()=>this.children};}
 get initialKeyFocus(){return this._initialKeyFocus || this;}
 addButton(info){const b={visible:true,reactive:true,can_focus:true,grab_key_focus(){focusEvents.push(this);},click:()=>info.action?.()};this.children.push(b);if(!this._initialKeyFocus||info.default)this._initialKeyFocus=b;return b;}
}
const native=NativeDialog.prototype.addButton;
const getter=Object.getOwnPropertyDescriptor(NativeDialog.prototype,'initialKeyFocus').get;
const ctx={Dialog:{Dialog:NativeDialog},Clutter:{KEY_Escape:27}};
const src=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/dialogFocus.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class');
vm.runInNewContext(src+'\nglobalThis.Policy=DialogFocus;',ctx);
const policy=new ctx.Policy();
function pair(extra={}){const d=new NativeDialog();const cancel=d.addButton({key:27,action:()=>actions++,...extra.cancel});const confirm=d.addButton({action:()=>actions++,...extra.confirm});return {d,cancel,confirm};}
for(const name of ['restart','shutdown','logout','generic confirmation']){
 const {d,cancel,confirm}=pair();focusEvents.length=0;
 d.initialKeyFocus.grab_key_focus();
 assert.deepEqual(focusEvents,[confirm],name+': first and only focus must be confirmation');
 assert.equal(d._initialKeyFocus,cancel,'Native state remains unchanged');
}
assert.equal(actions,0);
for(const extra of [{cancel:{default:true}},{confirm:{default:false}},{confirm:{key:42}}]){const {d,cancel}=pair(extra);assert.equal(d.initialKeyFocus,cancel);}
{const {d,confirm}=pair({confirm:{default:true}});assert.equal(d.initialKeyFocus,confirm);}
for(const property of ['reactive','can_focus']){const {d,cancel,confirm}=pair();confirm[property]=false;assert.equal(d.initialKeyFocus,cancel);}
{const {d}=pair();const entry={};d._initialKeyFocus=entry;assert.equal(d.initialKeyFocus,entry);}
{const {d,cancel}=pair();d.addButton({});assert.equal(d.initialKeyFocus,cancel);}
{const {d,confirm}=pair();d.addButton({}).visible=false;assert.equal(d.initialKeyFocus,confirm);}
{const {d,cancel,confirm}=pair();d.children=[cancel];assert.equal(d.initialKeyFocus,cancel);d.children=[cancel,confirm];assert.equal(d.initialKeyFocus,confirm);}
{const {d,cancel}=pair();policy.destroy();assert.equal(d.initialKeyFocus,cancel);assert.equal(NativeDialog.prototype.addButton,native);assert.equal(Object.getOwnPropertyDescriptor(NativeDialog.prototype,'initialKeyFocus').get,getter);}
console.log('Dialog focus: synchronous first focus, defaults, input, hidden/disabled alternatives and restoration PASS');
