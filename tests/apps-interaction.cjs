const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('extensions/macbook-menu@local/appsBrowser.js','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
let focus,launches=0,repaints=0,writes=0,errors=0;
const Clutter={KEY_Escape:27,KEY_Left:37,KEY_Up:38,KEY_Right:39,KEY_Down:40,KEY_Return:13,KEY_KP_Enter:14,EVENT_STOP:true,EVENT_PROPAGATE:false};
const ctx={GObject:{registerClass:c=>c},ModalDialog:{ModalDialog:class{}},Clutter,global:{stage:{get_key_focus:()=>focus}},
 console:{error(){errors++}},GLib:{path_get_dirname:()=>'/test',mkdir_with_parents(){},file_set_contents(){writes++;throw Error('permission denied');}},
 St:{ThemeContext:{get_for_stage:()=>({scale_factor:2})}}};
vm.runInNewContext(source+';Object.assign(globalThis,{AppsDialog,AppsBrowser,appsGeometry,gridGeometry,saveAppsHistory});',ctx);
const d=Object.create(ctx.AppsDialog.prototype);
const actor=()=>({contains:()=>false,grab_key_focus(){focus=this},activate(){launches++}});
d._entry=actor();d._viewMenu={isOpen:false};d._buttons=Array.from({length:8},actor);d._rows=[d._buttons.slice(0,5),d._buttons.slice(5)];d.close=()=>{};
const key=k=>d._handleKey({get_key_symbol:()=>k});
focus=d._entry;assert.equal(key(37),false);assert.equal(focus,d._entry);
assert.equal(key(39),false);assert.equal(key(40),true);assert.equal(focus,d._buttons[0]);
key(38);assert.equal(focus,d._entry);
focus=actor();assert.equal(key(13),false);assert.equal(launches,0);
d._viewMenu.isOpen=true;focus=d._entry;assert.equal(key(13),false);assert.equal(launches,0);d._viewMenu.isOpen=false;
focus=d._entry;key(13);assert.equal(launches,1);
focus=d._buttons[4];key(40);assert.equal(focus,d._buttons[7]);key(38);assert.equal(focus,d._buttons[2]);
// An expiry callback must not destroy the active drag source. A canceled drag refreshes later.
d._results={destroy_all_children(){throw Error('destroyed during drag')}};
d.beginAppDrag();d._render();assert.equal(d._renderPending,true);
d._render=()=>{repaints++};d.endAppDrag();assert.equal(repaints,1);assert.equal(d._draggingApp,false);
// Geometry must fit the real content allocation, including fractional widths/scales.
for(const width of [180,271.5,400,548,580,804])for(const list of [false,true]) {
 const g=ctx.gridGeometry(width,list);assert(g.columns*(g.tileWidth+12)+(g.columns-1)*8<=width+0.001);
}
for(const scale of [1,1.25,1.5,2])for(const width of [640,1024,1920]) {
 const g=ctx.appsGeometry(width,768,scale);assert(g.width+56<=width/scale+0.001);
}
assert.equal(ctx.saveAppsHistory('/test',{}),false);assert.equal(writes,1);assert.equal(errors,1);
// Failed persistence still updates the in-memory history and does not escape the manager.
const manager=Object.create(ctx.AppsBrowser.prototype);manager._added=null;manager._historyFile='/test';
manager._system={get_installed:()=>[{get_id:()=> 'a',should_show:()=>true}],lookup_app:()=>({get_id:()=> 'a',get_name:()=> 'A'})};
assert.doesNotThrow(()=>manager._updateInstalled());assert.equal(manager._added.a,0);
// Keyboard focus beyond a viewport scrolls it into view.
d._scroll={vadjustment:{value:0},get_transformed_position:()=>[0,100],get_transformed_size:()=>[100,200]};
d._revealApp({get_transformed_position:()=>[0,320],get_transformed_size:()=>[60,40]});assert.equal(d._scroll.vadjustment.value,60);
d._categoryScroll={hadjustment:{value:0},get_transformed_position:()=>[100,0],get_transformed_size:()=>[200,30]};
d._revealCategory({get_transformed_position:()=>[290,0],get_transformed_size:()=>[100,30]});assert.equal(d._categoryScroll.hadjustment.value,90);
console.log('Apps regressions: focus routing, first row, drag expiry, allocated widths, failed writes and focus scrolling PASS');
