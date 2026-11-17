import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GeniePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings=this.getSettings();
        const desktop=new Gio.Settings({schema_id:'org.gnome.desktop.interface'});
        const page=new Adw.PreferencesPage({title:'Dock & Window Effects',icon_name:'preferences-desktop-display-symbolic'});
        const group=new Adw.PreferencesGroup({title:'Window motion',description:'Minimized windows remain available as previews in the Dock. Up to three window previews.'});
        const animate=new Adw.SwitchRow({title:'Genie animation',subtitle:'Flow windows into their Dock previews when minimizing and restoring.'});
        settings.bind('animate',animate,'active',Gio.SettingsBindFlags.DEFAULT);
        group.add(animate);
        const status=new Adw.ActionRow({title:'System motion preference'});
        const update=()=>{status.subtitle=desktop.get_boolean('enable-animations')?'System animations are enabled.':'Reduce motion is active: window transitions are instant.';};
        update();const signal=desktop.connect('changed::enable-animations',update);
        group.add(status);page.add(group);window.add(page);
        window.connect('close-request',()=>{desktop.disconnect(signal);return false;});
    }
}
