import {ScrollbarVisibility} from './scrollbarVisibility.js';
import {launcherAppButton} from './launcherDrag.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

export function loadAppsView(path) {
    try {
        const value = JSON.parse(new TextDecoder().decode(GLib.file_get_contents(path)[1]));
        return value.view === 'list' ? 'list' : 'grid';
    } catch (_) { return 'grid'; }
}
export function saveAppsView(path, view) {
    GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o700);
    GLib.file_set_contents(path, JSON.stringify({view: view === 'list' ? 'list' : 'grid'}));
}
export const COLUMNS = 7;
export const APPS_LAYOUT = Object.freeze({gridWidth: 804, listWidth: 580, gap: 8, tilePadding: 6,
    panelPadding: 20, screenMargin: 8, minCell: 100, maxHeight: 440});
export function gridGeometry(contentWidth, list = false) {
    const width = Math.max(1, contentWidth);
    const columns = Math.max(1, Math.min(list ? 5 : COLUMNS, Math.floor(width / APPS_LAYOUT.minCell)));
    return {columns, tileWidth: Math.max(1, Math.floor((width - (columns - 1) * APPS_LAYOUT.gap) / columns - 2 * APPS_LAYOUT.tilePadding))};
}
export function saveAppsHistory(path, value) {
    try {
        GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o700);
        GLib.file_set_contents(path, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`Unable to save Apps history: ${error.message}`);
        return false;
    }
}
export function appsGeometry(width, height, scale = 1, list = false) {
    const available = Math.max(1, width / scale - 2 * (APPS_LAYOUT.panelPadding + APPS_LAYOUT.screenMargin));
    const panelWidth = Math.min(list ? APPS_LAYOUT.listWidth : APPS_LAYOUT.gridWidth, available);
    return {width: panelWidth, ...gridGeometry(panelWidth, list),
        height: Math.max(1, Math.min(APPS_LAYOUT.maxHeight, height / scale - 220))};
}
export function suggestedApps(apps, added, frequent, now) {
    const available = new Map(apps.map(app => [app.get_id(), app]));
    const recent = apps.filter(app => added[app.get_id()] > now - 600 && added[app.get_id()] <= now)
        .sort((a,b) => added[b.get_id()] - added[a.get_id()]);
    const ids = [...recent.slice(0,1).map(a=>a.get_id()), ...frequent.map(a=>a.get_id())];
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
    constructor(added, viewMode = 'grid', onViewChanged = () => {}) {
        super({styleClass: 'familiarmac-apps', shellReactive: true});
        const monitor = Main.layoutManager.currentMonitor ?? Main.layoutManager.primaryMonitor;
        const area = Main.layoutManager.getWorkAreaForMonitor(monitor.index);
        this._geometry = appsGeometry(area.width, area.height, St.ThemeContext.get_for_stage(global.stage).scale_factor, viewMode === 'list');
        this._columns = this._geometry.columns;
        this.dialogLayout._dialog.set_style(`width: ${this._geometry.width}px; padding: ${APPS_LAYOUT.panelPadding}px;`);
        this._apps = installedApps(Shell.AppSystem.get_default());
        this._added = added;
        this._category = '';
        this._list = viewMode === 'list';
        this._onViewChanged = onViewChanged;
        this._timer = 0;
        this._draggingApp = false;
        this._renderPending = false;
        this._buttons = [];
        const toolbar = new St.BoxLayout({style_class: 'familiarmac-apps-toolbar'});
        this._entry = new St.Entry({hint_text: 'Applications', style_class: 'familiarmac-apps-search', can_focus: true, x_expand: true});
        toolbar.add_child(new St.Icon({icon_name: 'view-app-grid-symbolic', icon_size: 24, y_align: Clutter.ActorAlign.CENTER}));
        toolbar.add_child(this._entry);
        const view = new St.Button({accessible_name: 'View content as', can_focus: true,
            style_class: 'familiarmac-apps-view', child: new St.Icon({icon_name: 'view-more-symbolic', icon_size: 20})});
        this._viewMenu = new PopupMenu.PopupMenu(view, 1, St.Side.TOP);
        Main.uiGroup.add_child(this._viewMenu.actor);
        this._viewMenu.actor.hide();
        this._viewMenu.actor.add_style_class_name('familiarmac-apps-view-menu');
        this._viewMenuManager = new PopupMenu.PopupMenuManager(this);
        this._viewMenuManager.addMenu(this._viewMenu);
        const heading = new PopupMenu.PopupMenuItem('View content as', {reactive: false});
        this._viewMenu.addMenuItem(heading);
        const choices = [];
        for (const [title, list] of [['Grid', false], ['List', true]]) {
            const item = new PopupMenu.PopupMenuItem(title);
            item.setOrnament(list === this._list ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
            item.connect('activate', () => {
                this._setView(list);
                for (const [choice, value] of choices)
                    choice.setOrnament(value === list ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
            });
            choices.push([item, list]);this._viewMenu.addMenuItem(item);
        }
        view.connect('clicked', () => this._viewMenu.toggle());
        toolbar.add_child(view);
        this.contentLayout.add_child(toolbar);
        this.contentLayout.add_child(new St.Widget({style_class: 'familiarmac-apps-search-divider'}));
        const categories = new St.BoxLayout({style_class: 'familiarmac-apps-categories'});
        this._categoryButtons = [];
        for (const [title, category] of [['All', ''], ['Utilities', 'Utility'], ['Productivity & Finance', 'Office'], ['Social', 'Network'], ['Entertainment', 'AudioVideo'], ['Creativity', 'Graphics'], ['Developer Tools', 'Development']]) {
            const button = new St.Button({label: title, can_focus: true, x_expand: true, x_align: Clutter.ActorAlign.FILL, style_class: 'familiarmac-apps-category'});
            button.connect('clicked', () => { this._category = category; this._render(); });
            // Prevent the label's ellipsized minimum width from compressing the chip row.
            categories.add_child(button);this._categoryButtons.push([button, category]);
            button.connect('key-focus-in', () => this._revealCategory(button));
        }
        const categoryScroll = new St.ScrollView({style_class: 'familiarmac-apps-category-scroll'});
        categoryScroll.set_policy(St.PolicyType.AUTOMATIC, St.PolicyType.NEVER);
        categoryScroll.set_child(categories);
        this._categoryScroll = categoryScroll;
        this._categories = categories;
        categoryScroll.connect('scroll-event', (_actor, event) => {
            const adjustment = categoryScroll.hadjustment;
            if (adjustment.upper <= adjustment.page_size) return Clutter.EVENT_PROPAGATE;
            const direction = event.get_scroll_direction();
            let delta = 0;
            if (direction === Clutter.ScrollDirection.SMOOTH) {
                const [dx, dy] = event.get_scroll_delta();delta = dx || dy;
            } else if ([Clutter.ScrollDirection.DOWN, Clutter.ScrollDirection.RIGHT].includes(direction)) delta = 1;
            else if ([Clutter.ScrollDirection.UP, Clutter.ScrollDirection.LEFT].includes(direction)) delta = -1;
            adjustment.value = Math.max(adjustment.lower, Math.min(adjustment.upper - adjustment.page_size, adjustment.value + delta * 40));
            return Clutter.EVENT_STOP;
        });
        this.contentLayout.add_child(categoryScroll);
        const scrollEdge = new St.Widget({style_class: 'familiarmac-apps-scroll-edge', opacity: 0});
        this.contentLayout.add_child(scrollEdge);
        this._scroll = new St.ScrollView({style_class: 'familiarmac-apps-scroll', overlay_scrollbars: true});
        this._scroll.set_style(`height: ${this._geometry.height}px;`);
        this._scrollbarVisibility = new ScrollbarVisibility(this._scroll);
        // Move only the thumb into the panel gutter; content keeps its full width.
        this._scroll.get_vscroll_bar().translation_x = (APPS_LAYOUT.panelPadding - 4) * St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this._scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this._results = new St.BoxLayout({vertical: true, style_class: 'familiarmac-apps-results'});
        this._scroll.set_child(this._results);
        this._results.connect('notify::allocation', () => this._queueGridLayout());
        const syncScrollEdge = () => {
            scrollEdge.opacity = this._scroll.vadjustment.value > 0.5 ? 255 : 0;
        };
        const scrollEdgeSignal = this._scroll.vadjustment.connect('notify::value', syncScrollEdge);
        syncScrollEdge();
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
            return this._handleKey(event);
        });
        const now = Date.now()/1000;
        const newest = Math.max(0, ...this._apps.map(app => added[app.get_id()] ?? 0).filter(time => time <= now));
        this._recentExpiry = newest > now-600 ? GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            Math.max(1, Math.ceil((newest+600-now)*1000)), () => {
                this._recentExpiry=0; this._render(); return GLib.SOURCE_REMOVE;
            }) : 0;
        this.connect('closed', () => this._viewMenu.close());
        this.connect('destroy', () => {
            if (this._layoutIdle) GLib.source_remove(this._layoutIdle);
            this._layoutIdle = 0;
            this._scroll.vadjustment.disconnect(scrollEdgeSignal);
            this._viewMenu.destroy();
            this._scrollbarVisibility.destroy();
            if (this._timer) GLib.source_remove(this._timer);
            if (this._recentExpiry) GLib.source_remove(this._recentExpiry);
            this._timer=0; this._recentExpiry=0;
        });
        this._render();
    }
    _handleKey(event) {
        if (this._viewMenu?.isOpen) return Clutter.EVENT_PROPAGATE;
        const key = event.get_key_symbol();
        if (key === Clutter.KEY_Escape) { this.close(); return Clutter.EVENT_STOP; }
        const focus = global.stage.get_key_focus();
        const inSearch = focus === this._entry || this._entry.contains(focus);
        const index = this._buttons.findIndex(button => button === focus || button.contains(focus));
        // Categories and the view button keep their own native keyboard handling.
        if (!inSearch && index < 0) return Clutter.EVENT_PROPAGATE;
        if (!this._buttons.length) return Clutter.EVENT_PROPAGATE;
        if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter) {
            this._buttons[inSearch ? 0 : index].activate();return Clutter.EVENT_STOP;
        }
        if (inSearch) {
            if (key !== Clutter.KEY_Down && key !== Clutter.KEY_Up) return Clutter.EVENT_PROPAGATE;
            this._buttons[0].grab_key_focus();return Clutter.EVENT_STOP;
        }
        let target = index;
        if (key === Clutter.KEY_Left || key === Clutter.KEY_Right) target += key === Clutter.KEY_Left ? -1 : 1;
        else if (key === Clutter.KEY_Down || key === Clutter.KEY_Up) {
            const row = this._rows.findIndex(items => items.includes(this._buttons[index]));
            if (row === 0 && key === Clutter.KEY_Up) { this._entry.grab_key_focus();return Clutter.EVENT_STOP; }
            const next = this._rows[Math.max(0, Math.min(this._rows.length - 1, row + (key === Clutter.KEY_Down ? 1 : -1)))];
            target = this._buttons.indexOf(next[Math.min(this._rows[row].indexOf(this._buttons[index]), next.length - 1)]);
        } else return Clutter.EVENT_PROPAGATE;
        this._buttons[Math.max(0, Math.min(this._buttons.length - 1, target))].grab_key_focus();
        return Clutter.EVENT_STOP;
    }
    _revealCategory(button) {
        const adjustment = this._categoryScroll.hadjustment;
        const [x] = button.get_transformed_position();
        const [left] = this._categoryScroll.get_transformed_position();
        const [width] = button.get_transformed_size();
        const [viewport] = this._categoryScroll.get_transformed_size();
        if (x < left) adjustment.value += x - left;
        else if (x + width > left + viewport) adjustment.value += x + width - left - viewport;
    }
    _revealApp(button) {
        const adjustment = this._scroll.vadjustment;
        const [, y] = button.get_transformed_position();
        const [, top] = this._scroll.get_transformed_position();
        const [, height] = button.get_transformed_size();
        const [, viewport] = this._scroll.get_transformed_size();
        if (y < top) adjustment.value += y - top;
        else if (y + height > top + viewport) adjustment.value += y + height - top - viewport;
    }
    _queueGridLayout() {
        if (this._layoutIdle) return;
        this._layoutIdle = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._layoutIdle = 0;this._syncAllocatedGrid();return GLib.SOURCE_REMOVE;
        });
    }
    _gridRowStyle() {
        const width = this._columns * (this._geometry.tileWidth + 2 * APPS_LAYOUT.tilePadding) + (this._columns - 1) * APPS_LAYOUT.gap;
        return `spacing: ${APPS_LAYOUT.gap}px; width: ${width}px;`;
    }
    _syncAllocatedGrid() {
        if (this._draggingApp || !this._results.width) return;
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const node = this._results.get_theme_node();
        const width = (this._results.width - node.get_horizontal_padding()) / scale;
        const geometry = gridGeometry(width, this._list);
        if (geometry.columns !== this._columns) {
            this._columns = geometry.columns;this._geometry.tileWidth = geometry.tileWidth;
            this._render();return;
        }
        if (Math.abs(this._geometry.tileWidth - geometry.tileWidth) < 0.25) return;
        this._geometry.tileWidth = geometry.tileWidth;
        for (const button of this._buttons) {
            if (button.has_style_class_name('familiarmac-apps-tile')) {
                button.set_style(`width: ${geometry.tileWidth}px; padding: ${APPS_LAYOUT.tilePadding}px;`);
                button.get_parent().set_style(this._gridRowStyle());
            }
        }
    }
    beginAppDrag() { this._draggingApp = true; this._renderPending = true; }
    endAppDrag() {
        this._draggingApp = false;
        if (this._renderPending) this._render();
    }
    _setView(list) {
        this._list = list;
        this._onViewChanged(list ? 'list' : 'grid');
        const monitor = Main.layoutManager.currentMonitor ?? Main.layoutManager.primaryMonitor;
        const area = Main.layoutManager.getWorkAreaForMonitor(monitor.index);
        this._geometry = appsGeometry(area.width, area.height,
            St.ThemeContext.get_for_stage(global.stage).scale_factor, list);
        this._columns = this._geometry.columns;
        this.dialogLayout._dialog.set_style(`width: ${this._geometry.width}px; padding: ${APPS_LAYOUT.panelPadding}px;`);
        this._scroll.set_style(`height: ${this._geometry.height}px;`);
        this._render();
    }
    _render() {
        if (this._draggingApp) { this._renderPending = true;return; }
        this._renderPending = false;
        this._results.destroy_all_children();this._buttons=[];this._rows=[];this._index=-1;
        for (const [button, category] of this._categoryButtons) {
            if (category === this._category) button.add_style_pseudo_class('checked');
            else button.remove_style_pseudo_class('checked');
        }
        const apps=this._apps.filter(app=>matchesApp(app,this._entry.get_text(),this._category));
        const suggestions = !this._entry.get_text().trim() && !this._category
            ? suggestedApps(this._apps, this._added, Shell.AppUsage.get_default().get_most_used(), Date.now()/1000) : [];
        if (suggestions.length) {
            this._addApps(suggestions.slice(0, this._columns), false);
            this._results.add_child(new St.Widget({style_class:'familiarmac-apps-divider'}));
        }
        this._addApps(apps);
        if (!apps.length) this._results.add_child(new St.Label({text:'No applications found',style_class:'familiarmac-apps-empty'}));
        this._scroll.vadjustment.value=0;
        this._scrollbarVisibility.reset();
    }
    _addApps(apps, list = this._list) {
        let row, rowButtons;
        for (const [index,app] of apps.entries()) {
            if (list || index%this._columns===0) {row=new St.BoxLayout({style_class:'familiarmac-apps-row', x_expand:list, x_align:list?Clutter.ActorAlign.FILL:Clutter.ActorAlign.CENTER, style:list ? `spacing: ${APPS_LAYOUT.gap}px;` : this._gridRowStyle()});this._results.add_child(row);rowButtons=[];this._rows.push(rowButtons);}
            const button=launcherAppButton(app,this,{can_focus:true,track_hover:true,x_expand:list,style_class:list?'familiarmac-apps-list-item':'familiarmac-apps-tile'});
            if (!list) button.set_style(`width: ${this._geometry.tileWidth}px; padding: ${APPS_LAYOUT.tilePadding}px;`);
            const box=new St.BoxLayout({vertical:!list,x_expand:list,x_align:list?Clutter.ActorAlign.FILL:Clutter.ActorAlign.CENTER,style_class:'familiarmac-apps-item-content'});
            const dragIcon=app.create_icon_texture(list?32:64);
            dragIcon.x_align = list ? Clutter.ActorAlign.START : Clutter.ActorAlign.CENTER;
            dragIcon.x_expand = false;
            box.add_child(dragIcon);button.getDragActorSource=()=>dragIcon;
            const label=new St.Label({text:app.get_name(),x_expand:true,y_align:Clutter.ActorAlign.CENTER,x_align:list?Clutter.ActorAlign.START:Clutter.ActorAlign.CENTER});
            box.add_child(label);button.set_child(box);
            row.add_child(button);this._buttons.push(button);rowButtons.push(button);
            button.connect('key-focus-in',()=>{this._index=this._buttons.indexOf(button);this._revealApp(button);});
        }
    }
    open() {
        if (!super.open(global.get_current_time())) return false;
        Main.extensionManager?.lookup('macbook-menu@local')?.stateObj?._launcherKey?.trackDialog(this);
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        for (const [button] of this._categoryButtons)
            button.set_style(`min-width: ${Math.ceil(button.get_preferred_width(-1)[1] / scale)}px;`);
        this._entry.grab_key_focus();
        return true;
    }
});

export class AppsBrowser {
    constructor() {
        this._system = Shell.AppSystem.get_default();
        this._viewFile = GLib.build_filenamev([GLib.get_user_config_dir(), 'familiarmac', 'apps-view.json']);
        this._view = loadAppsView(this._viewFile);
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
        const dialog = new AppsDialog(this._added, this._view, view => {
            this._view = view;
            try { saveAppsView(this._viewFile, view); }
            catch (error) { console.error(`Unable to save Apps view: ${error.message}`); }
        });
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
            saveAppsHistory(this._historyFile, next);
        }
    }
    destroy() {
        this._system.disconnect(this._installedSignal);
        this.dialog?.destroy();this.bus.unexport();
    }
}
