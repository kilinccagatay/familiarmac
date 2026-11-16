import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {GtkMenuModel} from '../overrides/appmenu/gtkMenuModel.js';
const connection=Gio.bus_get_sync(Gio.BusType.SESSION, null);
const actions=new Gio.SimpleActionGroup();
let activated=null;
const action=new Gio.SimpleAction({name:'pick',parameter_type:new GLib.VariantType('s')});
action.connect('activate',(_a,target)=>activated=target.get_string()[0]);
actions.add_action(action);
const menu=new Gio.Menu();const file=new Gio.Menu();
const item=Gio.MenuItem.new('Choose',null);
item.set_action_and_target_value('app.pick',new GLib.Variant('s','target-document'));
file.append_item(item);menu.append_submenu('_File',file);
const section=new Gio.Menu();section.append_submenu('_File',file);menu.append_section(null,section);
connection.export_action_group('/test/app',actions);
connection.export_menu_model('/test/menu',menu);
let proxy;let phase=0;let failure=null;
const loop=new GLib.MainLoop(null,false);
function check(value,message){if(!value)throw Error(message);}
proxy=new GtkMenuModel(connection.get_unique_name(),'/test/menu','/test/app',null,()=>{
 try{
 const tree=proxy.build('fixture');if(!tree)return;
 const child=tree.topLevelMenus[0]?.children[0];if(!child)return;
 check(tree.topLevelMenus.length===1,'duplicate top-level menus');
 if(phase===0&&child.sensitive){
  const count=proxy._models.size;
  for(let i=0;i<20;i++)proxy.build('fixture');
  check(proxy._models.size===count,'menu subscriptions grow each render');
  child.activate();phase=1;
 }
 if(phase===2&&!child.sensitive){phase=3;proxy.destroy();loop.quit();}
 }catch(e){failure=e;loop.quit();}
});
proxy.build('fixture');
GLib.timeout_add(GLib.PRIORITY_DEFAULT,50,()=>{
 if(phase===1&&activated==='target-document'){phase=2;action.set_enabled(false);}
 return phase===3?GLib.SOURCE_REMOVE:GLib.SOURCE_CONTINUE;
});
GLib.timeout_add(GLib.PRIORITY_DEFAULT,3000,()=>{if(phase!==3){failure=Error('menu/action timeout');loop.quit();}return GLib.SOURCE_REMOVE;});
loop.run();
if(failure)throw failure;
check(phase===3,'state change not received');
check(proxy._signals.length===0&&proxy._models.size===0,'subscriptions leaked');
print('GMenu integration: export, deduplication, target activation, enabled-state, stable subscriptions and cleanup PASS');
