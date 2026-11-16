const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
class Actor {
    constructor(props={}) {Object.assign(this, props); this.children=[];}
    add_child(a) {this.children.push(a); a.parent=this;}
    remove_child(a) {this.children.splice(this.children.indexOf(a),1); a.parent=null;}
    insert_child_at_index(a,i) {this.children.splice(i,0,a); a.parent=this;}
    get_parent() {return this.parent;}
    get_children() {return this.children;}
    destroy() {this.destroyed=true;}
}
let changed, disconnected=false;
const parent = new Actor(), sliderItem = new Actor({visible:true}), slider = new Actor(), discrete=new Actor();
sliderItem._slider=slider; sliderItem.add_child(slider);
sliderItem.connect=(_s,fn)=>{changed=fn;return 1;}; sliderItem.disconnect=()=>{disconnected=true;};
parent.add_child(sliderItem); parent.add_child(discrete);
const native={_sliderItem:sliderItem,_discreteItem:discrete};
const ctx={St:{BoxLayout:Actor,Label:Actor,Icon:Actor}};
const code=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/keyboardSurface.js','utf8').replace(/^import .*;\n/gm,'').replace('export class','class');
vm.runInNewContext(code+';globalThis.Surface=KeyboardSurface;',ctx);
const surface=new ctx.Surface({panel:{_backlight:{quickSettingsItems:[native]}}},false);
surface.show(); assert.equal(slider.get_parent(),surface.row);
surface.show(); assert.equal(surface.row.children.filter(a=>a===slider).length,1);
sliderItem.visible=false;changed();
assert.equal(slider.get_parent(),sliderItem);assert.equal(discrete.get_parent(),surface.row);
assert.equal(surface.icon.visible,false);
surface.hide();assert.equal(discrete.get_parent(),parent);assert.equal(parent.children[1],discrete);
sliderItem.visible=true;surface.show();surface.destroy();
assert.equal(slider.get_parent(),sliderItem);assert.equal(disconnected,true);
const absent=new ctx.Surface({panel:{}},false);absent.show();absent.destroy();
console.log('Keyboard surface: native control reuse, discrete fallback, repeated open and restore PASS');
