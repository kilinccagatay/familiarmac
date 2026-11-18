import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {MagicMouseActions} from './magicMouseActions.js';

export function mouseShortcutButton(choice) {return [0,2,8,9][choice]??0;}
const bindings={mission:'XF86Launch9','previous-space':'XF86Launch5','next-space':'XF86Launch6',zoom:'XF86Launch7'};
export class MissionControlInput {
    constructor() {
        const dir=GLib.build_filenamev([GLib.get_user_data_dir(),'gnome-shell/extensions/familiarmac-genie@local/schemas']);
        const source=Gio.SettingsSchemaSource.new_from_directory(dir,Gio.SettingsSchemaSource.get_default(),false);
        this.settings=new Gio.Settings({settings_schema:source.lookup('org.gnome.shell.extensions.familiarmac-genie',true)});
        this.mouseSettings=new Gio.Settings({schema_id:'org.gnome.desktop.peripherals.mouse'});
        this.socket=Gio.Socket.new(Gio.SocketFamily.UNIX,Gio.SocketType.DATAGRAM,Gio.SocketProtocol.DEFAULT);
        this.socket.set_blocking(false);
        this.address=Gio.UnixSocketAddress.new('/run/familiarmac-mouse/control.sock');
        this.actions=new Map();this.timer=0;this.gestures=new MagicMouseActions();
        // An unguessable abstract return address avoids filesystem sockets and
        // lets the authenticated seat-local service stream gesture progress.
        this.socket.bind(Gio.UnixSocketAddress.new_with_type('familiarmac-swipe-'+GLib.uuid_string_random(),Gio.UnixSocketAddressType.ABSTRACT),false);
        this.input=new GioUnix.InputStream({fd:this.socket.get_fd(),close_fd:false});
        this.inputSource=this.socket.create_source(GLib.IOCondition.IN,null);
        this.inputSource.set_callback(()=>{
            for(let i=0;i<128&&(this.socket.condition_check(GLib.IOCondition.IN)&GLib.IOCondition.IN);i++){
                try{
                    const packet=JSON.parse(new TextDecoder().decode(this.input.read_bytes(1024,null).get_data()));
                    if(this.settings.get_boolean('magic-mouse-spaces'))this.gestures.swipe(packet);
                }catch(_error){/* Ignore malformed packets and nonblocking races. */}
            }
            return GLib.SOURCE_CONTINUE;
        });
        this.inputSource.attach(null);
        this.changed=this.settings.connect('changed',(_s,key)=>{
            if(key.startsWith('mission-control-')||key.startsWith('magic-mouse-'))this.sync();
        });
        this.mouseChanged=this.mouseSettings.connect('changed::natural-scroll',()=>this.send());
        this.session=Main.sessionMode.connect('updated',()=>this.send());
        this.activated=global.display.connect('accelerator-activated',(_display,id)=>{
            if(Main.sessionMode.isLocked||!Main.sessionMode.hasWindows)return;
            const action=[...this.actions].find(([_key,value])=>value===id)?.[0];
            if(action==='mission')Main.overview.toggle();
            else if(action==='zoom')this.gestures.zoom();
            else if(action)this.gestures.workspace(action);
        });
        this.sync();
    }
    send(forceOff=false) {
        const off=forceOff||Main.sessionMode.isLocked||!Main.sessionMode.hasWindows;
        if(off||!this.settings.get_boolean('magic-mouse-spaces'))this.gestures.cancelSwipe();
        const choice={
            mouse:!off&&this.actions.has('mission')?this.settings.get_uint('mission-control-mouse'):0,
            magic:!off&&this.actions.has('mission')&&this.settings.get_boolean('mission-control-magic-mouse'),
            pages:!off&&this.settings.get_boolean('magic-mouse-pages'),
            spaces:!off&&this.actions.has('previous-space')&&this.actions.has('next-space')&&this.settings.get_boolean('magic-mouse-spaces'),
            zoom:!off&&this.actions.has('zoom')&&this.settings.get_boolean('magic-mouse-smart-zoom'),
            natural:this.mouseSettings.get_boolean('natural-scroll'),
        };
        try{this.socket.connect(this.address,null);this.socket.send_to(this.address,new TextEncoder().encode(JSON.stringify(choice)),null);}catch(_error){/* No service: no interception. */}
    }
    sync(){
        const needs={
            mission:this.settings.get_uint('mission-control-mouse')>0||this.settings.get_boolean('mission-control-magic-mouse'),
            'previous-space':this.settings.get_boolean('magic-mouse-spaces'),
            'next-space':this.settings.get_boolean('magic-mouse-spaces'),
            zoom:this.settings.get_boolean('magic-mouse-smart-zoom'),
        };
        for(const [name,wanted] of Object.entries(needs)){
            const old=this.actions.get(name);
            if(wanted&&!old){
                const id=global.display.grab_accelerator(bindings[name],Meta.KeyBindingFlags.NONE);
                if(id){this.actions.set(name,id);Main.wm.allowKeybinding(Meta.external_binding_name_for_action(id),Shell.ActionMode.NORMAL|Shell.ActionMode.OVERVIEW);}
            }else if(!wanted&&old){
                global.display.ungrab_accelerator(old);Main.wm.allowKeybinding(Meta.external_binding_name_for_action(old),Shell.ActionMode.NONE);this.actions.delete(name);
            }
        }
        this.action=this.actions.get('mission')??0;
        if(this.timer){GLib.source_remove(this.timer);this.timer=0;}
        this.send();
        if(this.actions.size||this.settings.get_boolean('magic-mouse-pages'))
            this.timer=GLib.timeout_add(GLib.PRIORITY_DEFAULT,1000,()=>{this.send();return GLib.SOURCE_CONTINUE;});
    }
    destroy(){
        this.send(true);if(this.timer)GLib.source_remove(this.timer);
        this.settings.disconnect(this.changed);this.mouseSettings.disconnect(this.mouseChanged);
        Main.sessionMode.disconnect(this.session);global.display.disconnect(this.activated);
        for(const id of this.actions.values()){
            global.display.ungrab_accelerator(id);Main.wm.allowKeybinding(Meta.external_binding_name_for_action(id),Shell.ActionMode.NONE);
        }
        this.actions.clear();this.gestures.destroy();this.inputSource.destroy();this.input.close(null);this.socket.close();
    }
}
