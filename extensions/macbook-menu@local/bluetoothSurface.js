import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import Atk from 'gi://Atk';
import GnomeBluetooth from 'gi://GnomeBluetooth?version=3.0';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import {settingsCommand} from './settingsCommand.js';

export function displayDeviceName(name) {
    return String(name??'').replace(/[\u0000-\u001f\u007f-\u009f]/g,'');
}

export function isMagicMouseModalias(value) {
    const match = /^(?:usb|bluetooth):v([0-9a-f]{4})p([0-9a-f]{4})(?:d[0-9a-f]+)?$/i.exec(String(value??''));
    return Boolean(match && ['05ac','004c'].includes(match[1].toLowerCase()) && ['030d','0269','0323'].includes(match[2].toLowerCase()));
}

// Borrow only GNOME's device rows; its client owns pairing and connection state.
export class BluetoothSurface {
    constructor(owner,tr) {
        this.owner=owner;this.tr=tr;this.native=owner.panel._bluetooth?.quickSettingsItems?.find(i=>i._deviceSection);
        this.actor=new St.BoxLayout({vertical:true,style_class:'fm-wifi fm-bluetooth',visible:false});
        const row=new St.BoxLayout({style_class:'fm-wifi-toggle-row',reactive:false});
        row.add_child(new St.Label({text:'Bluetooth',x_expand:true,y_align:Clutter.ActorAlign.CENTER}));
        this.toggle=new PopupMenu.Switch(false);
        this.button=new St.Button({style_class:'fm-wifi-switch-button',child:this.toggle,reactive:true,can_focus:true,accessible_name:'Bluetooth',accessible_role:Atk.Role.CHECK_BOX});
        row.add_child(this.button);this.actor.add_child(row);
        this.button.connect('clicked',()=>{if(this.native?._client?.available)this.native._client.toggleActive();});
        this.actor.add_child(new St.BoxLayout({style_class:'fm-battery-separator'}));
        this.list=new St.BoxLayout({vertical:true,style_class:'fm-bluetooth-devices'});
        this.actor.add_child(new St.ScrollView({child:this.list,overlay_scrollbars:true,hscrollbar_policy:St.PolicyType.NEVER,vscrollbar_policy:St.PolicyType.AUTOMATIC,style_class:'fm-wifi-scroll'}));
        this.placeholder=new St.Label({style_class:'fm-network-heading',text:''});this.placeholder.clutter_text.line_wrap=true;this.actor.add_child(this.placeholder);
        this.actor.add_child(new St.BoxLayout({style_class:'fm-battery-separator'}));
        const settings=new PopupMenu.PopupMenuItem(tr?'Bluetooth Ayarları…':'Bluetooth Settings…');
        settings.connect('activate',()=>{owner.panel.menu.close();Util.spawn([settingsCommand(),'bluetooth']);});this.actor.add_child(settings);
        this.signals=[];
        for(const [actor,events] of [[this.native,['notify::checked','notify::visible']],[this.native?._deviceSection.actor,['notify::visible']]])
            if(actor)for(const event of events)this.signals.push([actor,actor.connect(event,()=>this.sync())]);
        if(this.native?._client)this.signals.push([this.native._client,this.native._client.connect('devices-changed',()=>this.sync())]);
        this.sync();
    }
    sync(){
        const available=Boolean(this.native?._client?.available),active=Boolean(this.native?.checked);
        this.toggle.state=active;this.button.reactive=available;this.button.can_focus=available;
        const items=[...(this.native?._deviceItems?.values()??[])].filter(item=>item.visible);
        this.placeholder.visible=items.length===0;
        this.decorate(items);
        this.placeholder.text=!available?(this.tr?'Bluetooth kullanılamıyor':'Bluetooth unavailable'):active?(this.tr?'Bağlanılabilir cihaz yok':'No available or connected devices'):(this.tr?'Cihazlara bağlanmak için Bluetooth’u açın':'Turn on Bluetooth to connect to devices');
    }
    decorate(items){
        this.rowStyles??=new Map();
        for(const item of items){
            if(this.rowStyles.has(item)||!item._icon)continue;
            const icon=item._icon,original=icon.get_style();
            const labelAlign=item._label.y_align,iconAlign=icon.y_align,originalGicon=icon.gicon;
            item._label.y_align=Clutter.ActorAlign.CENTER;icon.y_align=Clutter.ActorAlign.CENTER;
            const magicIcon=Gio.FileIcon.new(Gio.File.new_for_uri(import.meta.url).get_parent().get_child('icons').get_child('magic-mouse-symbolic.svg'));
            const subtitle=item._subtitle,index=subtitle?item.get_children().indexOf(subtitle):-1;
            if(index>=0)item.remove_child(subtitle);
            const battery=new St.BoxLayout({style:'spacing: 4px; color: #aaaab0;',y_align:Clutter.ActorAlign.CENTER});
            const percentage=new St.Label({y_align:Clutter.ActorAlign.CENTER});
            const glyph=new St.Icon({icon_name:'battery-full-symbolic',icon_size:16});
            battery.add_child(percentage);battery.add_child(glyph);item.add_child(battery);
            const sync=()=>{
                item._label.text=displayDeviceName(item._device.alias);
                const modalias=item._device.proxy?.get_cached_property('Modalias')?.deep_unpack();
                if(isMagicMouseModalias(modalias))icon.gicon=magicIcon;
                else icon.icon_name=item._device.icon;
                icon.set_style('icon-size: 16px; padding: 7px; border-radius: 999px; color: white; background-color: '+(item._device.connected?'#0a84ff':'rgba(128,128,134,0.35)')+';');
                const value=item._device.battery_percentage;
                battery.visible=item._device.connected&&item._device.battery_type===GnomeBluetooth.BatteryType.PERCENTAGE&&Number.isFinite(value)&&value>=0&&value<=100;
                percentage.text=Math.round(value)+'%';
                glyph.icon_name=value<=10?'battery-caution-symbolic':value<=30?'battery-low-symbolic':value<=60?'battery-good-symbolic':'battery-full-symbolic';
            };
            const ids=['connected','battery-percentage','battery-type','alias'].map(key=>item._device.connect('notify::'+key,sync));
            const proxy=item._device.proxy;
            const proxyId=proxy?.connect('g-properties-changed',sync);
            const cleanup=()=>{if(proxyId)proxy.disconnect(proxyId);for(const id of ids)item._device.disconnect(id);this.rowStyles.delete(item);};
            const destroyed=item.connect('destroy',()=>{cleanup();if(index>=0)subtitle.destroy();});
            this.rowStyles.set(item,{icon,original,originalGicon,labelAlign,iconAlign,subtitle,index,battery,destroyed,cleanup});sync();
        }
    }
    show(){
        if(this.borrowed||!this.native)return;
        this.native.menu.close();this.native._reorderDeviceItems?.();
        const actor=this.native._deviceSection.actor,parent=actor.get_parent();
        if(!parent)return;
        this.borrowed={actor,parent,index:parent.get_children().indexOf(actor)};
        parent.remove_child(actor);this.list.add_child(actor);this.sync();
    }
    hide(){
        if(!this.borrowed)return;
        const {actor,parent,index}=this.borrowed;
        actor.get_parent()?.remove_child(actor);parent.insert_child_at_index(actor,index);this.borrowed=null;
    }
    destroy(){
        this.hide();
        for(const [item,{icon,original,originalGicon,labelAlign,iconAlign,subtitle,index,battery,destroyed,cleanup}] of this.rowStyles??[]){
            item.disconnect(destroyed);cleanup();icon.set_style(original);icon.gicon=originalGicon;icon.y_align=iconAlign;item._label.y_align=labelAlign;battery.destroy();
            if(index>=0)item.insert_child_at_index(subtitle,index);
        }
        for(const [actor,id] of this.signals)actor.disconnect(id);
        this.actor.destroy();
    }
}
