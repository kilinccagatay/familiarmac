import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// Apple keyboards emit either a function key, Launchpad, or Search keysym.
// Modified combinations (Alt+F4, Fn's other keys) are never intercepted.
export const launcherKeys = ['F4', 'XF86LaunchB', 'XF86Search'];
export class LauncherKey {
    constructor(showApps) {
        const dir=GLib.build_filenamev([GLib.get_user_data_dir(),'gnome-shell/extensions/familiarmac-genie@local/schemas']);
        const source=Gio.SettingsSchemaSource.new_from_directory(dir,Gio.SettingsSchemaSource.get_default(),false);
        this.settings=new Gio.Settings({settings_schema:source.lookup('org.gnome.shell.extensions.familiarmac-genie',true)});
        this.showApps=showApps;this.disposed=false;this.loading=false;this.ids=[];
        for(const key of launcherKeys){
            const id=global.display.grab_accelerator(key,Meta.KeyBindingFlags.NONE);
            // Respect existing shortcut owners; never replace their binding.
            if(id){this.ids.push(id);Main.wm.allowKeybinding(Meta.external_binding_name_for_action(id),Shell.ActionMode.NORMAL|Shell.ActionMode.OVERVIEW);}
        }
        this.signal=global.display.connect('accelerator-activated',(_display,id)=>{
            if(this.ids.includes(id)&&!Main.sessionMode.isLocked&&Main.sessionMode.hasWindows)this.activate();
        });
    }
    async activate(){
        if(this.disposed||this.loading)return;
        if(this.settings.get_string('launcher-key-action')==='apps'){this.showApps();return;}
        const extension=Extension.lookupByUUID('appmenu@ChathurangaBW.github.io');
        if(!extension)return;
        this.loading=true;
        try{
            const uri=Gio.File.new_for_path(extension.path).get_uri();
            const search=await import(`${uri}/searchDialog.js`);
            if(!this.disposed&&!Main.sessionMode.isLocked&&Main.sessionMode.hasWindows){
                Main.overview.hide();search.toggleSearchDialog();
            }
        }catch(error){console.warn(`FamiliarMac Spotlight key: ${error.message}`);}
        finally{this.loading=false;}
    }
    destroy(){
        this.disposed=true;global.display.disconnect(this.signal);
        for(const id of this.ids){global.display.ungrab_accelerator(id);Main.wm.allowKeybinding(Meta.external_binding_name_for_action(id),Shell.ActionMode.NONE);}
        this.ids=[];
    }
}
