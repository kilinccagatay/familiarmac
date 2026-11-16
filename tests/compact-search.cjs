const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const code=fs.readFileSync(__dirname+'/../overrides/appmenu/searchDialog.js','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
let opened=false;
let clipboard;
const context={_:s=>s,St:{ClipboardType:{CLIPBOARD:1},Clipboard:{get_default:()=>({set_text:(_type,text)=>clipboard=text})}},Clutter:{EventType:{BUTTON_PRESS:1,TOUCH_BEGIN:2,KEY_PRESS:3}},GObject:{registerClass:c=>c},ModalDialog:{ModalDialog:class {open(){opened=true;}}},GLib:{build_filenamev:p=>p.join('/'),get_user_data_dir:()=>'/tmp'},Main:{layoutManager:{currentMonitor:{height:900}}},global:{get_current_time:()=>1}};
vm.runInNewContext(fs.readFileSync('overrides/appmenu/calculator.js','utf8').replace(/^export /gm,'')+'\n'+code+';globalThis.SearchDialog=SearchDialog;',context);
const p=context.SearchDialog.prototype;
const obj=Object.create(p);Object.assign(obj,{_destroyed:false,_entry:{set_text(){},grab_key_focus(){}},dialogLayout:{_dialog:{}},_resultsBox:{visible:true,destroy_all_children(){},add_child(){throw Error('Blank query must not add results');}}});
obj.open();assert.equal(opened,true);assert.equal(obj._resultsBox.visible,false);assert.equal(obj.dialogLayout._dialog.translation_y,180);
let results;obj._renderResults=r=>results=r;obj._apps=()=>Array.from({length:12},(_,i)=>({title:'app '+i,type:'app'}));obj._settings=()=>[];obj._recent=()=>[];
obj._search('app');assert.equal(results.length,5);obj._search('  ');assert.equal(results.length,0);
assert.equal(obj.dialogLayout._dialog.translation_y,180);
console.log('Compact search: empty launch, inner top margin retained across queries, bounded results PASS');

// Exercise the layout setup as well as open(): BinLayout ignores START for
// non-expanding children, even when the surrounding wrapper fills the monitor.
const layoutTarget={dialogLayout:{_dialog:{}}};
const setup=code.slice(code.indexOf('this.dialogLayout.x_expand = true;'), code.indexOf('this.buttonLayout.hide();'));
vm.runInNewContext('(function(){'+setup+'}).call(target)', {target:layoutTarget,Clutter:{ActorAlign:{FILL:0,START:1}}});
assert.equal(layoutTarget.dialogLayout.y_expand,true);
assert.equal(layoutTarget.dialogLayout._dialog.y_expand,true);
assert.equal(layoutTarget.dialogLayout._dialog.y_align,1);
const css=fs.readFileSync('overrides/appmenu/search.css','utf8');
const outer=css.match(/\.modal-dialog\.appmenu-search-dialog \{([^}]+)/)[1];
const inner=css.match(/\.appmenu-search-dialog \.appmenu-search-result \{([^}]+)/)[1];
const radius=s=>Number(s.match(/border-radius: (\d+)px/)[1]);
assert.equal(radius(outer)-radius(inner),Number(outer.match(/padding: (\d+)px/)[1]));
console.log('Spotlight: expanding top-aligned card and concentric inset corners PASS');

let closed=0;obj.close=()=>closed++;obj.dialogLayout._dialog={get_transformed_position:()=>[100,100],get_transformed_size:()=>[460,60]};
assert.equal(obj._closeOnOutsidePress({type:()=>1,get_coords:()=>[120,120]}),false);
assert.equal(obj._closeOnOutsidePress({type:()=>1,get_coords:()=>[50,120]}),true);
assert.equal(closed,1);assert.equal(obj._closeOnOutsidePress({type:()=>3}),false);
console.log('Search dismissal: outside clicks close; inside clicks and keyboard preserved PASS');

obj._search('700/12');assert.equal(results[0].type,'calculator');assert.equal(results[0].title,'58.3333333333');obj._activate(results[0]);assert.equal(clipboard,'58.3333333333');
console.log('Search calculator result selection copies answer PASS');

// Exercise the actual captured-event handler while the search owns modal focus.
const handlerSource=code.slice(code.indexOf("(_actor, event) => {"),code.indexOf('\n    _closeOnOutsidePress'));
const handler=handlerSource.slice(0,handlerSource.lastIndexOf('});')+1);
const keyContext={Clutter:{EventType:{KEY_PRESS:3},KEY_space:32,KEY_Escape:27,ModifierType:{SUPER_MASK:64},EVENT_STOP:1,EVENT_PROPAGATE:0}};
const target={_destroyed:false,_closeOnOutsidePress:()=>false,close:()=>closed++};
const onKey=vm.runInNewContext('(function(){return '+handler+'}).call(target)',{...keyContext,target});
const before=closed;
assert.equal(onKey(null,{type:()=>3,get_key_symbol:()=>32,get_state:()=>64}),1);
assert.equal(closed,before+1);
assert.equal(onKey(null,{type:()=>3,get_key_symbol:()=>32,get_state:()=>0}),0);
assert.equal(closed,before+1);
console.log('Spotlight modal Super+Space closes; plain Space remains input PASS');
