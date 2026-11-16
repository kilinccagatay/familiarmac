const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/../extensions/familiarmac-icons@local/extension.js','utf8').replace(/^import .*;\n/gm,'').replace('export default class','class');
let pending,completed,runs=0,rescans=0,killed=0;
const context={console,Extension:class{},Gio:{Settings:class {connect(){return 1;}disconnect(){}},SubprocessFlags:{STDOUT_PIPE:1,STDERR_PIPE:2},Subprocess:{new(){runs++;return {communicate_utf8_async(a,b,fn){completed=fn;},communicate_utf8_finish(){return [true,'{"changed":true}',''];},get_successful(){return true;},force_exit(){killed++;}};}}},GLib:{timeout_add(a,b,fn){pending=fn;return 1;},source_remove(){pending=null;},build_filenamev:p=>p.join('/'),get_home_dir:()=>'/home/test'},Shell:{AppSystem:{get_default:()=>({connect(){return 2;},disconnect(){}})}},St:{TextureCache:{get_default:()=>({rescan_icon_theme(){rescans++;}})}}};
vm.runInNewContext(source+';globalThis.IconAlignment=IconAlignment;',context);
const extension=new context.IconAlignment();extension.enable();extension._schedule();pending();assert.equal(runs,1);
extension._schedule();extension._schedule();assert.equal(runs,1);completed(extension._process,{});assert.equal(rescans,1);pending();assert.equal(runs,2);
extension.disable();completed(extension._process,{});assert.equal(rescans,1);assert.equal(killed,1);
console.log('Icon watcher: coalesced events, serialized work, cache refresh and disable cleanup PASS');
