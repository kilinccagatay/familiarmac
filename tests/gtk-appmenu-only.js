import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {findGtkApplication,hasGtkAppMenu} from '../overrides/appmenu/gtkApplicationOwner.js';
import {GtkMenuModel} from '../overrides/appmenu/gtkMenuModel.js';
const bus=Gio.bus_get_sync(Gio.BusType.SESSION,null);
const name='org.example.MenuOnlyFixture',path='/org/example/MenuOnlyFixture';
bus.call_sync('org.freedesktop.DBus','/org/freedesktop/DBus','org.freedesktop.DBus','RequestName',new GLib.Variant('(su)',[name,0]),null,Gio.DBusCallFlags.NONE,-1,null);
const app=Gio.DBusExportedObject.wrapJSObject('<node><interface name="org.gtk.Application"><method name="Activate"/></interface></node>',{Activate(){}});app.export(bus,path);
const actions=new Gio.SimpleActionGroup();let activated=false;
const action=new Gio.SimpleAction({name:'create'});action.connect('activate',()=>activated=true);actions.add_action(action);
const groupId=bus.export_action_group(path,actions);
const menu=new Gio.Menu();const item=Gio.MenuItem.new('_New Item','app.create');item.set_attribute_value('accel',new GLib.Variant('s','<Primary>n'));menu.append_item(item);
const menuId=bus.export_menu_model(path+'/menus/appmenu',menu);
const [pid]=bus.call_sync('org.freedesktop.DBus','/org/freedesktop/DBus','org.freedesktop.DBus','GetConnectionUnixProcessID',new GLib.Variant('(s)',[bus.get_unique_name()]),null,Gio.DBusCallFlags.NONE,-1,null).deepUnpack();
const owner=await findGtkApplication(pid,null);
if(owner?.busName!==bus.get_unique_name()||owner.appPath!==path)throw Error('owner mismatch');
if(await findGtkApplication(-1,null))throw Error('invalid PID matched');
if(!await hasGtkAppMenu(owner.busName,path+'/menus/appmenu',null))throw Error('missing app menu');
if(await hasGtkAppMenu(owner.busName,path+'/absent',null))throw Error('accepted absent menu');
const loop=new GLib.MainLoop(null,false);let phase=0,failure=null,model;
model=new GtkMenuModel(owner.busName,path+'/menus/appmenu',path,null,()=>{
 try{
  const tree=model.build('only');if(!tree)return;
  if(tree.topLevelMenus.length)throw Error('App menu converted to menu bar');
  const item=tree.appMenuChildren[0];
  if(item.label!=='New Item'||item.shortcut!=='<Primary>n')throw Error('label/accelerator lost');
  if(phase===0&&item.sensitive){phase=1;item.activate();}
  if(phase===2&&!item.sensitive){phase=3;loop.quit();}
 }catch(e){failure=e;loop.quit();}
},'',true);
model.build('only');
GLib.timeout_add(GLib.PRIORITY_DEFAULT,25,()=>{if(phase===1&&activated){phase=2;action.set_enabled(false);}return phase<3?GLib.SOURCE_CONTINUE:GLib.SOURCE_REMOVE;});
GLib.timeout_add(GLib.PRIORITY_DEFAULT,3000,()=>{loop.quit();return GLib.SOURCE_REMOVE;});
loop.run();model.destroy();app.unexport();bus.unexport_action_group(groupId);bus.unexport_menu_model(menuId);
if(failure)throw failure;if(phase!==3)throw Error('activation/state timeout');
print('GTK app-only: PID ownership, native labels/accelerators, activation, state and cleanup PASS');
