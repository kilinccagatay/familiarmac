const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let now=1000000,picked=null,signals={},unexported=false,disconnected=0;
const context={Gio:{DBus:{session:{}},DBusExportedObject:{wrapJSObject:()=>({export(){},unexport(){unexported=true;}})}},GLib:{get_monotonic_time:()=>now},Clutter:{PickMode:{REACTIVE:0}},global:{get_pointer:()=>[1,2],stage:{get_actor_at_pos:()=>picked},backend:{get_dnd:()=>({connect:(name,fn)=>(signals[name]=fn,name),disconnect(){disconnected++;}})}}};
const code=fs.readFileSync(__dirname+'/../extensions/macbook-menu@local/trashDrop.js','utf8').replace(/^import .*;\n/gm,'').replace('export class','class');
vm.runInNewContext(code+';globalThis.TrashDrop=TrashDrop;',context);
const bridge=new context.TrashDrop();
const trash={app:{appInfo:{location:{get_uri:()=> 'trash:///'}}},get_parent:()=>null};
picked={get_parent:()=>trash};signals['dnd-enter']();signals['dnd-position-change'](null,1,2);signals['dnd-leave']();
assert.equal(bridge.ConsumeDrop(),true);assert.equal(bridge.ConsumeDrop(),false);
signals['dnd-enter']();signals['dnd-position-change'](null,1,2);signals['dnd-leave']();now+=800000;assert.equal(bridge.ConsumeDrop(),false);
signals['dnd-enter']();signals['dnd-position-change'](null,1,2);picked=null;assert.equal(bridge.ConsumeDrop(),false);
bridge.destroy();assert.equal(disconnected,3);assert.equal(unexported,true);
// Run the actual injected handler: cancellation must make no call; snapshot
// excludes special icons, uses trash (never permanent delete), ignores errors.
let handler,calls=0,callback,trashed=[];
const sourceContext={widget:{},Gtk:{DragResult:{NO_TARGET:1,USER_CANCELLED:2}},GLib:{VariantType:class{}},Gio:{DBusCallFlags:{NONE:0},DBus:{session:{call(...args){calls++;callback=args.at(-1);}}}},imports:{dbusUtils:{RemoteFileOperations:{TrashURIsRemote:files=>trashed.push(files)}}},log(){}};
sourceContext.manager={_fileList:[{isSelected:true,isSpecial:false,file:{get_uri:()=> 'file:///test'}},{isSelected:true,isSpecial:true,file:{get_uri:()=> 'file:///home'}}]};
sourceContext.host={_desktopManager:sourceContext.manager,connectSignal(w,n,fn){handler=fn;}};
vm.runInNewContext('(function(){'+fs.readFileSync(__dirname+'/../patches/desktop-trash-drop.js','utf8')+'}).call(host);',sourceContext);
handler(null,null,2);assert.equal(calls,0);handler(null,null,1);assert.equal(calls,1);
sourceContext.manager._fileList=[];callback({call_finish:()=>({deep_unpack:()=>[true]})},{});assert.deepEqual(Array.from(trashed[0]),['file:///test']);
console.log('Trash drop: actual release only, cancel/no-target safety, stale/off-target rejection, one-shot, selected-file snapshot PASS');
