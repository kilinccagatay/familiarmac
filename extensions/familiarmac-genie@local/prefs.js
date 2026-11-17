import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GeniePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings=this.getSettings();
        const desktop=new Gio.Settings({schema_id:'org.gnome.desktop.interface'});
        const page=new Adw.PreferencesPage({title:'Dock & Window',icon_name:'familiarmac-dock-window-symbolic'});
        const group=new Adw.PreferencesGroup({title:'Window motion',description:'Minimized windows remain available as previews in the Dock. Up to three window previews.'});
        const animate=new Adw.SwitchRow({title:'Genie animation',subtitle:'Flow windows into their Dock previews when minimizing and restoring.'});

        group.add(animate);
        const status=new Adw.ActionRow({title:'System motion preference'});
        let syncing=false;
        const update=()=>{
            syncing=true;
            animate.active=desktop.get_boolean('enable-animations')&&settings.get_boolean('animate');
            syncing=false;
            status.subtitle=desktop.get_boolean('enable-animations')?'System animations are enabled.':'System animations are disabled. Enabling Genie will ask for confirmation.';
        };
        animate.connect('notify::active',()=>{
            if(syncing)return;
            if(animate.active&&!desktop.get_boolean('enable-animations')){
                update();
                const dialog=new Adw.MessageDialog({transient_for:window,modal:true,heading:'Enable system animations?',body:'Genie needs system animations. Continuing will also enable animations elsewhere in the desktop.'});
                dialog.add_response('cancel','Cancel');dialog.add_response('enable','Enable');
                dialog.default_response='enable';dialog.close_response='cancel';
                dialog.set_response_appearance('enable',Adw.ResponseAppearance.SUGGESTED);
                dialog.connect('response',(_d,response)=>{
                    if(response==='enable'){desktop.set_boolean('enable-animations',true);settings.set_boolean('animate',true);}
                    update();dialog.destroy();
                });dialog.present();
            }else settings.set_boolean('animate',animate.active);
        });
        const genieSignal=settings.connect('changed::animate',update);
        update();const signal=desktop.connect('changed::enable-animations',update);
        group.add(status);page.add(group);window.add(page);
        window.connect('close-request',()=>{desktop.disconnect(signal);settings.disconnect(genieSignal);return false;});
    }
}
