const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let pointer=[1,2],unexported=false,disconnected=0;
const context={Clutter:{ModifierType:{BUTTON1_MASK:256}},Gio:{DBus:{session:{}},DBusExportedObject:{wrapJSObject:()=>({export(){},unexport(){unexported=true;}})}},global:{get_pointer:()=>pointer}};
const code=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/trashDrop.js','utf8').replace(/^import .*;\n/gm,'').replace('export class','class');
vm.runInNewContext(code+';globalThis.TrashDrop=TrashDrop;',context);
const bridge=new context.TrashDrop();
const dot={opacity:255},area={opacity:180};
const trash={app:{isTrash:true},mapped:true,_dot:dot,_indicator:{_indicators:[{_area:area}]},get_transformed_position:()=>[100,900],get_transformed_size:()=>[80,80],connect:()=>1,disconnect(){disconnected++}};
bridge.track(trash);assert.equal(dot.opacity,0);assert.equal(area.opacity,0);
assert.equal(bridge.ConsumeDrop(),false);
pointer=[140,940];assert.equal(bridge.ConsumeDrop(),true); // Wayland: no Xdnd events needed.
pointer=[140,940,256];assert.equal(bridge.ConsumeDrop(),false);pointer=[140,940,0];
trash.mapped=false;assert.equal(bridge.ConsumeDrop(),false);trash.mapped=true;
pointer=[180,940];assert.equal(bridge.ConsumeDrop(),false); // outside exact icon bounds
bridge.destroy();assert.equal(disconnected,1);assert.equal(unexported,true);assert.equal(dot.opacity,255);assert.equal(area.opacity,180);
// Run the actual injected handler: cancellation must make no call; snapshot
// excludes special icons, uses trash (never permanent delete), ignores errors.
let handler,calls=0,callback,trashed=[],sounds=0,fail=false,pending;
const sourceContext={widget:{},Gtk:{DragResult:{NO_TARGET:1,USER_CANCELLED:2,ERROR:5}},GLib:{VariantType:class{},PRIORITY_DEFAULT:0,SpawnFlags:{SEARCH_PATH:1},find_program_in_path:()=>true,spawn_async(){sounds++;}},Gio:{File:{new_for_uri:uri=>({trash_async(priority,cancel,done){trashed.push(uri);pending=()=>done({trash_finish(){if(fail)throw Error('denied');return true;}},{});}})},DBusCallFlags:{NONE:0},DBus:{session:{call(...args){calls++;callback=args.at(-1);}}}},log(){}};
sourceContext.manager={_fileList:[{isSelected:true,isSpecial:false,file:{get_uri:()=> 'file:///test'}},{isSelected:true,isSpecial:true,file:{get_uri:()=> 'file:///home'}}]};
sourceContext.host={_desktopManager:sourceContext.manager,connectSignal(w,n,fn){handler=fn;}};
vm.runInNewContext('(function(){'+fs.readFileSync(__dirname+'/../patches/desktop-trash-drop.js','utf8')+'}).call(host);',sourceContext);
handler(null,null,2);assert.equal(calls,0);handler(null,null,1);assert.equal(calls,1);
const selected=sourceContext.manager._fileList;
sourceContext.manager._fileList=[];callback({call_finish:()=>({deep_unpack:()=>[true]})},{});
assert.deepEqual(trashed,['file:///test']);assert.equal(sounds,0);
pending();assert.equal(sounds,1); // only after actual successful completion
sourceContext.manager._fileList=selected;fail=true;handler(null,null,5);
callback({call_finish:()=>({deep_unpack:()=>[true]})},{});pending();assert.equal(sounds,1);
handler(null,null,1);callback({call_finish:()=>({deep_unpack:()=>[false]})},{});assert.equal(trashed.length,2);
console.log('Trash drop: Wayland hit test, cancel/off-target safety, selected-file snapshot, completion-only sound PASS');
