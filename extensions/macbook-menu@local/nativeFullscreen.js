import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
export function ownsFullscreen(window) {
    const name=window?.get_wm_class?.()?.toLowerCase();
    return name==='org.remmina.remmina'||name==='remmina';
}
const pending=new WeakSet();
export function requestNativeFullscreen(window, fullscreen) {
    if(!ownsFullscreen(window)||pending.has(window))return;
    pending.add(window);
    Gio.DBus.session.call(`org.familiarmac.Remmina.p${window.get_pid()}`,
        '/org/familiarmac/Remmina','org.familiarmac.Remmina','SetFullscreen',
        new GLib.Variant('(sb)',[window.get_title()??'',fullscreen]),null,
        Gio.DBusCallFlags.NO_AUTO_START,2000,null,(connection,result)=>{
            pending.delete(window);
            try {
                if(!connection.call_finish(result).deep_unpack()[0])throw new Error('No unique connection window');
            } catch(error) {
                console.warn(`FamiliarMac native fullscreen: ${error.message}`);
                Main.notify('Remmina','Reopen Remmina to enable the green fullscreen button.');
            }
        });
}
