const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
(async()=>{
 let action='apps',apps=0,search=0,hidden=0,handler,next=1,ungrabbed=[],allowed=[];
 const Main={sessionMode:{isLocked:false,hasWindows:true},overview:{hide(){hidden++;}},wm:{allowKeybinding(...a){allowed.push(a);}}};
 const settings={get_string:()=>action};
 const context={console,Main,GLib:{build_filenamev:a=>a.join('/'),get_user_data_dir:()=>'/test'},Gio:{Settings:function(){return settings;},SettingsSchemaSource:{new_from_directory:()=>({lookup:()=>({})}),get_default:()=>({})},File:{new_for_path:()=>({get_uri:()=>'/search'})}},Meta:{KeyBindingFlags:{NONE:0},external_binding_name_for_action:id=>`external-${id}`},Shell:{ActionMode:{NORMAL:1,OVERVIEW:2,NONE:0}},Extension:{lookupByUUID:()=>({path:'/search'})},loadSearch:async()=>({toggleSearchDialog(){search++;}}),global:{display:{grab_accelerator(key){assert(['F4','XF86LaunchB','XF86Search'].includes(key));return next++;},connect(_name,fn){handler=fn;return 42;},disconnect(id){assert.equal(id,42);},ungrab_accelerator(id){ungrabbed.push(id);}}}};
 let source=fs.readFileSync('extensions/macbook-menu@local/launcherKey.js','utf8').replace(/^import .*;$/gm,'').replace('export class LauncherKey','this.LauncherKey=class LauncherKey').replace(/^export /gm,'').replace('import(`${uri}/searchDialog.js`)','loadSearch(uri)');
 vm.runInNewContext(source,context);const key=new context.LauncherKey(()=>apps++);
 handler(null,1);assert.equal(apps,1);handler(null,99);assert.equal(apps,1);
 Main.sessionMode.isLocked=true;handler(null,1);assert.equal(apps,1);Main.sessionMode.isLocked=false;
 action='spotlight';await key.activate();assert.equal(search,1);assert.equal(hidden,1);
 key.destroy();assert.deepEqual(ungrabbed,[1,2,3]);await key.activate();assert.equal(search,1);
 assert(allowed.slice(-3).every(a=>a[1]===0));
 console.log('Launcher key: Apps/Spotlight dispatch, unrelated shortcuts, lock screen and cleanup PASS');
})().catch(e=>{console.error(e);process.exit(1);});
