import {launcherAppButton} from './launcherDrag.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

export const COLUMNS = 5;
export function suggestedApps(apps, added, frequent, now) {
    const available = new Map(apps.map(app => [app.get_id(), app]));
    const recent = apps.filter(app => added[app.get_id()] > now - 14*86400)
        .sort((a,b) => added[b.get_id()] - added[a.get_id()]);
    const ids = [...recent.slice(0,2).map(a=>a.get_id()), ...frequent.map(a=>a.get_id()), ...recent.map(a=>a.get_id())];
    return [...new Set(ids)].filter(id=>available.has(id)).slice(0,COLUMNS).map(id=>available.get(id));
}

export const APPS_ID = 'org.familiarmac.Apps.desktop';
export function matchesApp(app, query, category) {
    const info = app.get_app_info();
    const text = `${app.get_name()} ${app.get_description() ?? ''} ${info?.get_keywords?.()?.join(' ') ?? ''}`.toLocaleLowerCase();
    return text.includes(query.trim().toLocaleLowerCase()) &&
        (!category || (info?.get_categories?.() ?? '').split(';').includes(category));
}

export function installedApps(system) {
    // get_installed returns Gio.DesktopAppInfo, not Shell.App.
    return system.get_installed().filter(info => info.get_id() !== APPS_ID && info.should_show())
        .map(info => system.lookup_app(info.get_id())).filter(Boolean)
        .sort((a, b) => a.get_name().localeCompare(b.get_name()));
}

const AppsDialog = GObject.registerClass(class FamiliarMacAppsDialog extends ModalDialog.ModalDialog {
    constructor(added) {
        super({styleClass: 'familiarmac-apps', shellReactive: true});
        this._apps = installedApps(Shell.AppSystem.get_default());
        this._added = added;
        this._category = '';
        this._list = false;
        this._timer = 0;
        this._buttons = [];
        const toolbar = new St.BoxLayout({style_class: 'familiarmac-apps-toolbar'});
        this._entry = new St.Entry({hint_text: 'Search applications', can_focus: true, x_expand: true});
        toolbar.add_child(this._entry);
        const view = new St.Button({label: 'List', can_focus: true, style_class: 'button'});
        view.connect('clicked', () => { this._list = !this._list; view.label = this._list ? 'Grid' : 'List'; this._render(); });
        toolbar.add_child(view);
        this.contentLayout.add_child(toolbar);
        const categories = new St.BoxLayout({style_class: 'familiarmac-apps-categories'});
        this._categoryButtons = [];
        for (const [title, category] of [['All', ''], ['Internet', 'Network'], ['Office', 'Office'], ['Media', 'AudioVideo'], ['Graphics', 'Graphics'], ['Development', 'Development']]) {
            const button = new St.Button({label: title, can_focus: true, style_class: 'familiarmac-apps-category'});
            button.connect('clicked', () => { this._category = category; this._render(); });
            categories.add_child(button);this._categoryButtons.push([button, category]);
        }
        this.contentLayout.add_child(categories);
        this._scroll = new St.ScrollView({style_class: 'familiarmac-apps-scroll', overlay_scrollbars: true});
        this._scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this._results = new St.BoxLayout({vertical: true, style_class: 'familiarmac-apps-results'});
        this._scroll.set_child(this._results);
        this.contentLayout.add_child(this._scroll);
        this.buttonLayout.hide();
        this._entry.clutter_text.connect('text-changed', () => {
            if (this._timer) GLib.source_remove(this._timer);
            this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                this._timer = 0; this._render(); return GLib.SOURCE_REMOVE;
            });
        });
        this.connect('captured-event', (_actor, event) => {
            if (event.type() === Clutter.EventType.BUTTON_PRESS || event.type() === Clutter.EventType.TOUCH_BEGIN) {
                const [x,y] = event.get_coords();
                const [left,top] = this.dialogLayout._dialog.get_transformed_position();
                const [w,h] = this.dialogLayout._dialog.get_transformed_size();
                if (x < left || x >= left+w || y < top || y >= top+h) { this.close(); return Clutter.EVENT_STOP; }
            }
            if (event.type() !== Clutter.EventType.KEY_PRESS) return Clutter.EVENT_PROPAGATE;
            const key = event.get_key_symbol();
            if (key === Clutter.KEY_Escape) {this.close();return Clutter.EVENT_STOP;}
            const steps = new Map([[Clutter.KEY_Right,1],[Clutter.KEY_Left,-1],[Clutter.KEY_Down,this._list ? 1 : COLUMNS],[Clutter.KEY_Up,this._list ? -1 : -COLUMNS]]);
            if ([Clutter.KEY_Down,Clutter.KEY_Up].includes(key) && this._buttons.length) {
                const current = this._buttons[Math.max(0,this._index)];
                const row = this._rows.findIndex(buttons=>buttons.includes(current));
                const column = this._rows[row].indexOf(current);
                const target = this._rows[Math.max(0,Math.min(this._rows.length-1,row+(key===Clutter.KEY_Down?1:-1)))];
                const button = target[Math.min(column,target.length-1)];
                this._index=this._buttons.indexOf(button);button.grab_key_focus();return Clutter.EVENT_STOP;
            }
            if (steps.has(key) && this._buttons.length) {
                this._index = Math.max(0,Math.min(this._buttons.length-1,this._index + steps.get(key)));
                this._buttons[this._index].grab_key_focus();return Clutter.EVENT_STOP;
            }
            if ((key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter) && this._buttons.length) {
                this._buttons[Math.max(0,this._index)].activate();return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this.connect('destroy', () => {if (this._timer) GLib.source_remove(this._timer);this._timer=0;});
        this._render();
    }
    _render() {
        this._results.destroy_all_children();this._buttons=[];this._rows=[];this._index=-1;
        for (const [button, category] of this._categoryButtons) {
            if (category === this._category) button.add_style_pseudo_class('checked');
            else button.remove_style_pseudo_class('checked');
        }
        const apps=this._apps.filter(app=>matchesApp(app,this._entry.get_text(),this._category));
        const suggestions = !this._entry.get_text().trim() && !this._category
            ? suggestedApps(this._apps, this._added, Shell.AppUsage.get_default().get_most_used(), Date.now()/1000) : [];
        if (suggestions.length) {
            this._addApps(suggestions, false);
            this._results.add_child(new St.Widget({style_class:'familiarmac-apps-divider'}));
        }
        this._addApps(apps);
        if (!apps.length) this._results.add_child(new St.Label({text:'No applications found',style_class:'familiarmac-apps-empty'}));
        this._scroll.vadjustment.value=0;
    }
    _addApps(apps, list = this._list) {
        let row, rowButtons;
        for (const [index,app] of apps.entries()) {
            if (list || index%COLUMNS===0) {row=new St.BoxLayout({style_class:'familiarmac-apps-row'});this._results.add_child(row);rowButtons=[];this._rows.push(rowButtons);}
            const button=launcherAppButton(app,this,{can_focus:true,track_hover:true,x_expand:list,style_class:list?'familiarmac-apps-list-item':'familiarmac-apps-tile'});
            const box=new St.BoxLayout({vertical:!list,x_expand:list,x_align:list?Clutter.ActorAlign.FILL:Clutter.ActorAlign.CENTER,style_class:'familiarmac-apps-item-content'});
            const dragIcon=app.create_icon_texture(list?28:48);
            box.add_child(dragIcon);button.getDragActorSource=()=>dragIcon;
            const label=new St.Label({text:app.get_name(),x_expand:true,y_align:Clutter.ActorAlign.CENTER,x_align:list?Clutter.ActorAlign.START:Clutter.ActorAlign.CENTER});
            box.add_child(label);button.set_child(box);
            row.add_child(button);this._buttons.push(button);rowButtons.push(button);
            button.connect('key-focus-in',()=>{this._index=this._buttons.indexOf(button);});
        }
    }
    open() {
        if (!super.open(global.get_current_time())) return false;
        Main.extensionManager?.lookup('macbook-menu@local')?.stateObj?._launcherKey?.trackDialog(this);
        this._entry.grab_key_focus();
        return true;
    }
});

export class AppsBrowser {
    constructor() {
        this._system = Shell.AppSystem.get_default();
        this._historyFile = GLib.build_filenamev([GLib.get_user_state_dir(), 'familiarmac', 'apps-added.json']);
        try { this._added = JSON.parse(new TextDecoder().decode(GLib.file_get_contents(this._historyFile)[1])); }
        catch (_) { this._added = null; }
        this._updateInstalled();
        this._installedSignal = this._system.connect('installed-changed', () => this._updateInstalled());
        this.bus=Gio.DBusExportedObject.wrapJSObject('<node><interface name="org.familiarmac.Apps"><method name="Show"/></interface></node>',this);
        this.bus.export(Gio.DBus.session,'/org/familiarmac/Apps');
    }
    Show() {
        if (this.dialog) {this.dialog.close();return;}
        const dialog = new AppsDialog(this._added);
        this.dialog = dialog;
        dialog.connect('destroy', () => { if (this.dialog === dialog) this.dialog = null; });
        // A failed modal grab must not leave an invisible dialog swallowing
        // all subsequent Show calls through the close/toggle path.
        if (!dialog.open()) dialog.destroy();
    }
    _updateInstalled() {
        const apps = installedApps(this._system);
        const next = {};
        for (const app of apps) next[app.get_id()] = this._added === null ? 0 : (this._added[app.get_id()] ?? Date.now()/1000);
        if (JSON.stringify(next) !== JSON.stringify(this._added)) {
            this._added = next;
            GLib.mkdir_with_parents(GLib.path_get_dirname(this._historyFile), 0o700);
            GLib.file_set_contents(this._historyFile, JSON.stringify(next));
        }
    }
    destroy() {
        this._system.disconnect(this._installedSignal);
        this.dialog?.destroy();this.bus.unexport();
    }
}
