import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export function orderFiles(files, order) {
    return [...files].sort((a,b)=>order==='name' ? a.name.localeCompare(b.name) : b.time-a.time || a.name.localeCompare(b.name));
}
export function stackView(view, count) {return view==='auto' ? (count<=7?'fan':'grid') : view;}

export class DownloadsStack {
    constructor() {
        this.items=new Map();this.view='auto';this.order='date';this.stopped=false;
        const path=GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD) ?? GLib.build_filenamev([GLib.get_home_dir(),'Downloads']);
        this.folder=Gio.File.new_for_path(path);
        this.preferences=Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_config_dir(),'familiarmac-stacks.json']));
        this.preferences.load_contents_async(null,(file,result)=>{
            try {const [,bytes]=file.load_contents_finish(result);const p=JSON.parse(new TextDecoder().decode(bytes));
                if (['auto','fan','grid','list'].includes(p.view)) this.view=p.view;
                if (['date','name'].includes(p.order)) this.order=p.order;
            } catch (_) { /* Defaults on first installation. */ }
        });
    }
    save() {
        const bytes=new TextEncoder().encode(JSON.stringify({view:this.view,order:this.order}));
        this.preferences.replace_contents_bytes_async(new GLib.Bytes(bytes),null,false,Gio.FileCreateFlags.PRIVATE,null,
            (file,result)=>{try {file.replace_contents_finish(result);} catch(error){console.warn(error.message);}});
    }
    track(icon) {
        const uri=(icon.app?.appInfo ?? icon.app?.get_app_info?.())?.location?.get_uri?.();
        if (!['trash://','trash:///'].includes(uri)) return;
        const trash=icon.get_parent(),box=trash?.get_parent();
        if (!box) return;
        let item=this.items.get(icon);
        if (!item) {
            const button=new St.Button({style_class:'app-well-app familiarmac-downloads-button',can_focus:true,track_hover:true,accessible_name:'Downloads'});
            const image=new St.Icon({icon_name:'folder-download',icon_size:icon.icon?.iconSize ?? 48});
            button.set_child(image);
            const container=new St.Bin({child:button,style_class:'dash-item-container familiarmac-downloads-start'});
            const menu=new PopupMenu.PopupMenu(button,0.5,St.Side.BOTTOM);
            menu.actor.add_style_class_name('familiarmac-stack');Main.uiGroup.add_child(menu.actor);menu.actor.hide();
            const manager=new PopupMenu.PopupMenuManager(button);manager.addMenu(menu);
            item={button,image,container,menu,manager,trash};
            button.connect('clicked',()=>{if(menu.isOpen)menu.close();else this.open(item);});
            button.connect('button-press-event',(_button,event)=>{
                if(event.get_button()!==3)return Clutter.EVENT_PROPAGATE;
                if(!menu.isOpen)this.open(item);return Clutter.EVENT_STOP;
            });
            menu.connect('open-state-changed',(_menu,open)=>{if(!open)item.cancellable?.cancel();});
            item.signal=icon.connect('destroy',()=>{this.dispose(item);this.items.delete(icon);});
            this.items.set(icon,item);
        }
        if (item.container.get_parent()!==box) {
            item.container.get_parent()?.remove_child(item.container);box.insert_child_below(item.container,trash);
        } else {
            const children=box.get_children(),pos=children.indexOf(trash);
            if (children[pos-1]!==item.container) box.set_child_below_sibling(item.container,trash);
        }
        item.image.icon_size=icon.icon?.iconSize ?? 48;
        trash.add_style_class_name('familiarmac-trash-with-downloads');
    }
    async read(cancellable) {
        const enumerator=await new Promise((resolve,reject)=>this.folder.enumerate_children_async(
            'standard::name,standard::display-name,standard::icon,standard::is-hidden,time::modified',
            Gio.FileQueryInfoFlags.NONE,GLib.PRIORITY_DEFAULT,cancellable,(file,result)=>{
                try {resolve(file.enumerate_children_finish(result));}catch(error){reject(error);}
            }));
        const files=[];
        try {
            while(files.length<200) {
                const batch=await new Promise((resolve,reject)=>enumerator.next_files_async(40,GLib.PRIORITY_DEFAULT,cancellable,(e,result)=>{
                    try {resolve(e.next_files_finish(result));}catch(error){reject(error);}
                }));
                if (!batch.length) break;
                for(const info of batch) if(!info.get_is_hidden())files.push({name:info.get_display_name(),icon:info.get_icon(),time:info.get_attribute_uint64('time::modified'),file:this.folder.get_child(info.get_name())});
            }
        } finally {
            enumerator.close_async(GLib.PRIORITY_DEFAULT,null,(e,result)=>{try{e.close_finish(result);}catch(_){}});
        }
        return orderFiles(files.slice(0,200),this.order);
    }
    async open(item) {
        item.menu.removeAll();item.menu.addMenuItem(new PopupMenu.PopupMenuItem('Loading Downloads…',{reactive:false}));item.menu.open();
        item.cancellable?.cancel();const cancellable=new Gio.Cancellable();item.cancellable=cancellable;
        try {
            const files=await this.read(cancellable);
            if(this.stopped||cancellable.is_cancelled()||!item.menu.isOpen)return;
            this.render(item,files);
        } catch(error) {
            if(this.stopped||cancellable.is_cancelled())return;
            item.menu.removeAll();item.menu.addMenuItem(new PopupMenu.PopupMenuItem('Downloads could not be read',{reactive:false}));
            item.menu.addAction('Open in Files',()=>this.launch(this.folder));
        }
    }
    launch(file) {
        Gio.AppInfo.launch_default_for_uri_async(file.get_uri(),global.create_app_launch_context(0,-1),null,(_source,result)=>{
            try {Gio.AppInfo.launch_default_for_uri_finish(result);}catch(error){Main.notifyError('Could not open file',error.message);}
        });
    }
    render(item,files) {
        const menu=item.menu;menu.removeAll();const mode=stackView(this.view,files.length);
        menu.actor.remove_style_class_name('fan');if(mode==='fan')menu.actor.add_style_class_name('fan');
        const row=new PopupMenu.PopupBaseMenuItem({reactive:false,can_focus:false});
        const scroll=new St.ScrollView({style_class:mode==='fan'?'familiarmac-stack-fan':'familiarmac-stack-scroll',overlay_scrollbars:true});
        scroll.set_policy(St.PolicyType.NEVER,St.PolicyType.AUTOMATIC);
        const content=new St.BoxLayout({vertical:true,style_class:'familiarmac-stack-content'});scroll.set_child(content);row.add_child(scroll);menu.addMenuItem(row);
        const visible=files.slice(0,mode==='fan'?7:200);let gridRow;
        for(const [index,entry] of visible.entries()) {
            if(mode!=='grid'||index%4===0){gridRow=new St.BoxLayout({style_class:'familiarmac-stack-row'});content.add_child(gridRow);}
            const button=new St.Button({can_focus:true,track_hover:true,style_class:mode==='grid'?'familiarmac-stack-tile':'familiarmac-stack-file'});
            const body=new St.BoxLayout({vertical:mode==='grid',style_class:'familiarmac-stack-file-content'});
            const image=new St.Icon({gicon:entry.icon,icon_size:mode==='list'?24:48});
            const label=new St.Label({text:entry.name,style_class:'familiarmac-stack-label',y_align:Clutter.ActorAlign.CENTER});
            if(mode==='fan'){body.add_child(label);body.add_child(image);button.margin_left=Math.round((visible.length-1-index)**2*2);}
            else{body.add_child(image);body.add_child(label);}
            button.set_child(body);button.connect('clicked',()=>{menu.close();this.launch(entry.file);});gridRow.add_child(button);
            if(mode==='fan'){button.opacity=0;button.translation_y=12;button.ease({opacity:255,translation_y:0,duration:140,delay:index*18});}
        }
        if(!visible.length)content.add_child(new St.Label({text:'Downloads is empty'}));
        if(files.length>visible.length||files.length===200)menu.addMenuItem(new PopupMenu.PopupMenuItem('More files are available in the folder',{reactive:false}));
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addAction('Open in Files',()=>{menu.close();this.launch(this.folder);});
        const views=new PopupMenu.PopupSubMenuMenuItem('View: '+this.view);
        for(const value of ['auto','fan','grid','list'])views.menu.addAction(value,()=>{this.view=value;this.save();this.render(item,files);});
        menu.addMenuItem(views);
        const sort=new PopupMenu.PopupSubMenuMenuItem('Sort: '+this.order);
        for(const value of ['date','name'])sort.menu.addAction(value,()=>{this.order=value;this.save();this.render(item,orderFiles(files,this.order));});
        menu.addMenuItem(sort);
    }
    dispose(item) {
        if(item.disposed)return;item.disposed=true;
        item.cancellable?.cancel();item.menu.destroy();item.manager.removeMenu(item.menu);item.container.destroy();
    }
    destroy() {
        this.stopped=true;
        for(const [icon,item] of this.items){icon.disconnect(item.signal);item.trash.remove_style_class_name('familiarmac-trash-with-downloads');this.dispose(item);}
        this.items.clear();
    }
}
