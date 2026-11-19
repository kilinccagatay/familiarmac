const fs=require('fs'),vm=require('vm'),assert=require('assert');
let disconnected=0,origin,opens=0,closes=0;
const pointer={_reposition(){},open(){opens++},close(_a,done){closes++;done?.()},
 add_style_class_name(){},remove_style_class_name(){},remove_all_transitions(){},ease(o){this.translation_x=o.translation_x;o.onComplete?.()},
 get_parent:()=>({transform_stage_point:(x,y)=>[true,x,y]})};
const oldOpen=pointer.open,oldClose=pointer.close,oldReposition=pointer._reposition;
const box={style:'original',get_style(){return this.style},set_style(s){this.style=s}};
let selectedDate;const layout={_frozen:true,set frozen(v){this._frozen=v}};
const area={...box,get_parent:()=>({layout_manager:layout})},calendar={...box,connect_after(_name,fn){selectedDate=fn;return 7},disconnect(id){assert.equal(id,7);selectedDate=null},set_height(h){this.height=h},get_preferred_height:()=>[100,584],y_expand:true,layout_manager:{column_homogeneous:false}};
const menu={_boxPointer:pointer,box,sourceActor:{},isOpen:true};
const ctx={global:{stage:{}},St:{ThemeContext:{get_for_stage:()=>({scale_factor:2})}},Clutter:{ActorAlign:{START:1},AnimationMode:{EASE_OUT_QUAD:1}},Main:{panel:{height:56,get_transformed_position:()=>[0,0]},layoutManager:{findMonitorForActor:()=>({x:0,y:0,width:2880,height:1800}),connect(){return 1},disconnect(){disconnected++}}}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/notificationDrawer.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class')+'\nglobalThis.D=NotificationDrawer',ctx);
const d=new ctx.D(menu,area,calendar);pointer.open(1);assert.equal(layout._frozen,false);layout.frozen=true;selectedDate();assert.equal(layout._frozen,false);assert.equal(opens,1);assert.equal(pointer.translation_x,0);assert.match(box.style,/max-height: 872px/);assert.ok(!/(^|; )height:/.test(box.style));assert.ok(!/(^|; )height:/.test(area.style));pointer._reposition({get_width:()=>680,set_origin:(x,y)=>origin=[x,y]});assert.deepEqual(origin,[2200,56]);
assert.match(calendar.style,/min-height: 292px/);
// A larger agenda must not consume the calendar's reserved height.
d.resize();assert.match(calendar.style,/min-height: 292px/);
let done=0;pointer.close(1,()=>done++);assert.equal(done,1);assert.equal(pointer._muteInput,true);d.destroy();assert.equal(pointer.open,oldOpen);assert.equal(pointer.close,oldClose);assert.equal(pointer._reposition,oldReposition);assert.equal(box.style,'original');assert.equal(calendar.style,'original');assert.equal(calendar.y_expand,true);assert.equal(calendar.layout_manager.column_homogeneous,false);assert.equal(disconnected,1);assert.equal(selectedDate,null);assert.equal(layout._frozen,true);
console.log('Date drawer geometry, animation callbacks and complete restoration PASS');
