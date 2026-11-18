import Gio from 'gi://Gio';
import {anchorMagnifiedMenu} from './dockMenus.js';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export function orderFiles(files, order) {
    const sorted=[...files].sort((a,b)=>{
        if(order==='name')return a.name.localeCompare(b.name);
        if(order==='kind')return (a.kind??'').localeCompare(b.kind??'') || a.name.localeCompare(b.name);
        const key=order==='created'?'created':'time';
        return (b[key]??0)-(a[key]??0) || a.name.localeCompare(b.name);
    });
    sorted.totalCount=files.totalCount??files.length;
    return sorted;
}
export function stackView(view, count) {return view==='auto' ? (count<=7?'fan':'grid') : view;}
export function remainingCount(files, shown) {return Math.max(0,(files.totalCount??files.length)-shown);}

export class DownloadsStack {
    constructor() {
        this.items=new Map();this.view='auto';this.order='date';this.display='folder';this.fanLimit=7;this.stopped=false;
        const path=GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD) ?? GLib.build_filenamev([GLib.get_home_dir(),'Downloads']);
        this.folder=Gio.File.new_for_path(path);
        this.preferences=Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_config_dir(),'familiarmac-stacks.json']));
        this.preferences.load_contents_async(null,(file,result)=>{
            try {const [,bytes]=file.load_contents_finish(result);const p=JSON.parse(new TextDecoder().decode(bytes));
                if (['auto','fan','grid','list'].includes(p.view)) this.view=p.view;
                if (['date','name','created','kind'].includes(p.order)) this.order=p.order;
                if (['folder','stack'].includes(p.display)) this.display=p.display;
                if ([5,7,10,12].includes(p.fanLimit)) this.fanLimit=p.fanLimit;
            } catch (_) { /* Defaults on first installation. */ }
        });
    }
    save() {
        const bytes=new TextEncoder().encode(JSON.stringify({view:this.view,order:this.order,display:this.display,fanLimit:this.fanLimit}));
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
            // A real separator actor survives dock theme borders and orientation classes.
            const row=new St.BoxLayout();
            row.add_child(new St.Widget({style_class:'familiarmac-dock-divider',
                reactive:false, y_align:Clutter.ActorAlign.CENTER,
                style:'width: 1px; height: 32px; margin: 0 8px; background-color: rgba(255,255,255,0.32);'}));
            row.add_child(button);
            const container=new St.Bin({child:row,style_class:'dash-item-container familiarmac-downloads-start'});
            const menu=new PopupMenu.PopupMenu(button,0.5,St.Side.BOTTOM);
            menu.actor.add_style_class_name('familiarmac-stack');Main.uiGroup.add_child(menu.actor);menu.actor.hide();
            const manager=new PopupMenu.PopupMenuManager(button);manager.addMenu(menu);
            const options=new PopupMenu.PopupMenu(button,0.5,St.Side.BOTTOM);
            options.actor.add_style_class_name('familiarmac-stack-options');Main.uiGroup.add_child(options.actor);options.actor.hide();manager.addMenu(options);
            anchorMagnifiedMenu(menu, button, false);
            anchorMagnifiedMenu(options, button);
            button._fmDockMenuOpen = () => menu.isOpen || options.isOpen;
            item={button,image,container,menu,options,manager,trash};
            // Dock parents can destroy our sibling before the Trash icon itself.
            item.containerSignal=container.connect('destroy',()=>{item.container=null;});
            button.connect('clicked',()=>{if(menu.isOpen)menu.close();else this.open(item);});
            button.connect('button-press-event',(_button,event)=>{
                if(event.get_button()!==3)return Clutter.EVENT_PROPAGATE;
                menu.close();this.showOptions(item);return Clutter.EVENT_STOP;
            });
            menu.connect('open-state-changed',(_menu,open)=>{if(!open)item.cancellable?.cancel();});
            item.signal=icon.connect('destroy',()=>{this.dispose(item);this.items.delete(icon);});
            this.items.set(icon,item);
        }
        if (!item.container) return;
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
            'standard::name,standard::display-name,standard::icon,standard::is-hidden,standard::content-type,time::modified,time::created',
            Gio.FileQueryInfoFlags.NONE,GLib.PRIORITY_DEFAULT,cancellable,(file,result)=>{
                try {resolve(file.enumerate_children_finish(result));}catch(error){reject(error);}
            }));
        let files=[];let totalCount=0;
        try {
            while(true) {
                const batch=await new Promise((resolve,reject)=>enumerator.next_files_async(40,GLib.PRIORITY_DEFAULT,cancellable,(e,result)=>{
                    try {resolve(e.next_files_finish(result));}catch(error){reject(error);}
                }));
                if (!batch.length) break;
                for(const info of batch) if(!info.get_is_hidden()) {
                    totalCount++;
                    files.push({name:info.get_display_name(),icon:info.get_icon(),time:info.get_attribute_uint64('time::modified'),
                        created:info.has_attribute('time::created')?info.get_attribute_uint64('time::created'):0,
                        kind:info.get_content_type()??'',file:this.folder.get_child(info.get_name())});
                }
                // Count the whole folder but retain only the best 200 entries.
                files=orderFiles(files,this.order).slice(0,200);
            }
        } finally {
            enumerator.close_async(GLib.PRIORITY_DEFAULT,null,(e,result)=>{try{e.close_finish(result);}catch(_){}});
        }
        files.totalCount=totalCount;
        return orderFiles(files,this.order);
    }
    async open(item) {
        item.options?.close();
        item.menu.removeAll();item.menu.addMenuItem(new PopupMenu.PopupMenuItem('Loading Downloads…',{reactive:false}));item.menu.open();
        item.cancellable?.cancel();const cancellable=new Gio.Cancellable();item.cancellable=cancellable;
        try {
            const files=await this.read(cancellable);
            if(this.stopped||cancellable.is_cancelled()||!item.menu.isOpen)return;
            item.files=files;this.updateIcon(item);this.render(item,files);
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
        const menu=item.menu;menu.removeAll();const mode=stackView(this.view,files.totalCount??files.length);
        menu.actor.remove_style_class_name('fan');if(mode==='fan')menu.actor.add_style_class_name('fan');
        const row=new PopupMenu.PopupBaseMenuItem({reactive:false,can_focus:false});
        const scroll=new St.ScrollView({style_class:mode==='fan'?'familiarmac-stack-fan':'familiarmac-stack-scroll',overlay_scrollbars:true});
        scroll.set_policy(St.PolicyType.NEVER,St.PolicyType.AUTOMATIC);
        const content=new St.BoxLayout({vertical:true,style_class:'familiarmac-stack-content'});scroll.set_child(content);row.add_child(scroll);menu.addMenuItem(row);
        const monitor=Main.layoutManager.findMonitorForActor(item.button)??Main.layoutManager.primaryMonitor;
        const scale=St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const available=Math.max(1,Math.floor((monitor.height/scale-200)/62));
        const visible=files.slice(0,mode==='fan'?Math.min(this.fanLimit,available):200);let gridRow;
        const remaining=remainingCount(files,visible.length);
        if(remaining>0) {
            const more=new St.Button({can_focus:true,track_hover:true,style_class:'familiarmac-stack-more'});
            const body=new St.BoxLayout({style_class:'familiarmac-stack-file-content'});
            body.add_child(new St.Label({text:`${remaining} More in Finder`,style_class:'familiarmac-stack-label',y_align:Clutter.ActorAlign.CENTER}));
            body.add_child(new St.Icon({icon_name:'go-jump-symbolic',icon_size:mode==='fan'?40:24}));
            more.set_child(body);more.connect('clicked',()=>{menu.close();this.launch(this.folder);});content.add_child(more);
        }
        if(mode==='fan')visible.reverse();
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

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const openFolder=menu.addAction('Open in Finder',()=>{menu.close();this.launch(this.folder);});
        openFolder.add_style_class_name('familiarmac-stack-open-folder');
    }
    updateIcon(item) {
        item.preview?.destroy();item.preview=null;
        if(this.display==='folder'||!item.files?.length){item.button.set_child(item.image);return;}
        const size=item.image.icon_size,scale=St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const stack=new St.Widget({width:size*scale,height:size*scale});
        for(const [index,file] of item.files.slice(0,3).reverse().entries()) {
            const image=new St.Icon({gicon:file.icon,icon_size:size-8});
            image.set_position(index*3*scale,index*3*scale);image.rotation_angle_z=(index-1)*5;stack.add_child(image);
        }
        item.button.set_child(stack);item.preview=stack;
    }
    showOptions(item) {
        const menu=item.options;menu.removeAll();
        const heading=text=>menu.addMenuItem(new PopupMenu.PopupMenuItem(text,{reactive:false,can_focus:false,style_class:'familiarmac-stack-heading'}));
        const choice=(label,value,current,action)=>{
            const entry=menu.addAction(label,action);
            entry.setOrnament(value===current?PopupMenu.Ornament.CHECK:PopupMenu.Ornament.NONE);
            return entry;
        };
        heading('Sort by');
        choice('Name','name',this.order,()=>{this.order='name';this.save();});
        const added=menu.addAction('Date Added — unavailable',()=>{});added.setSensitive(false);
        for(const [label,value] of [['Date Modified','date'],['Date Created','created'],['Kind','kind']])
            choice(label,value,this.order,()=>{this.order=value;this.save();});
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());heading('Display as');
        for(const [label,value] of [['Folder','folder'],['Stack','stack']])choice(label,value,this.display,()=>{
            this.display=value;this.save();
            if(value==='stack'&&!item.files){
                item.previewCancellable?.cancel();item.previewCancellable=new Gio.Cancellable();
                this.read(item.previewCancellable).then(files=>{
                    if(this.stopped||item.disposed)return;item.files=files;this.updateIcon(item);
                }).catch(error=>{if(!item.previewCancellable.is_cancelled())console.warn(error.message);});
            }else this.updateIcon(item);
        });
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());heading('View content as');
        for(const [label,value] of [['Fan','fan'],['Grid','grid'],['List','list'],['Automatic','auto']])
            choice(label,value,this.view,()=>{this.view=value;this.save();});
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const options=new PopupMenu.PopupSubMenuMenuItem('Options');
        for(const limit of [5,7,10,12]) {
            const entry=options.menu.addAction(`Fan: up to ${limit} files`,()=>{this.fanLimit=limit;this.save();});
            entry.setOrnament(limit===this.fanLimit?PopupMenu.Ornament.CHECK:PopupMenu.Ornament.NONE);
        }
        menu.addMenuItem(options);
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addAction('Open “Downloads”',()=>this.launch(this.folder));menu.open();
    }
    dispose(item) {
        if(item.disposed)return;item.disposed=true;
        item.previewCancellable?.cancel();item.cancellable?.cancel();
        item.manager.removeMenu(item.menu);item.manager.removeMenu(item.options);
        item.menu.destroy();item.options.destroy();
        if (item.container) {
            const container=item.container;
            item.container=null;
            container.disconnect(item.containerSignal);
            container.destroy();
        }
    }
    destroy() {
        this.stopped=true;
        for(const [icon,item] of this.items){icon.disconnect(item.signal);item.trash.remove_style_class_name('familiarmac-trash-with-downloads');this.dispose(item);}
        this.items.clear();
    }
}
