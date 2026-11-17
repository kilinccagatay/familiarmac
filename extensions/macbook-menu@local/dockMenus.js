import {settingsPanels} from './settingsPanels.js';
import {settingsCommand} from './settingsCommand.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';

export function flyoutPosition(parent, rowY, size, work, scale = 1) {
    const overlap = 6 * scale;
    const right = parent.x + parent.width - overlap;
    const left = parent.x - size.width + overlap;
    const desired = right + size.width <= work.x + work.width ? right : left;
    return {x: Math.max(work.x, Math.min(desired, work.x + work.width - size.width)),
        y: Math.max(work.y, Math.min(rowY - 5 * scale, work.y + work.height - size.height))};
}

// Hit-test transformed coordinates: a nested modal grab can route the event to
// the flyout even when the pointer is physically over a different parent row.
export function pointerInside(actor, x, y) {
    const [ax, ay] = actor.get_transformed_position();
    const [width, height] = actor.get_transformed_size();
    return x >= ax && x < ax + width && y >= ay && y < ay + height;
}

export function pointerReturnsToParent(parent, source, flyout, x, y) {
    const inside = actor => pointerInside(actor, x, y);
    // The flyout has visual priority in the intentional overlap region.
    return inside(parent) && !inside(source) && !inside(flyout);
}

// Modal release may not emit a new enter/hover notification for the parent.
// Restore the actual pointer row, rather than only clearing the old source.
export function selectParentPointerRow(menu, x, y) {
    if (!pointerInside(menu.actor, x, y)) return;
    const items = menu._getMenuItems();
    const target = items.find(item => item.mapped && item.reactive && item.can_focus &&
        pointerInside(item, x, y));
    for (const item of items) {
        if (item !== target && item.active) item.active = false;
    }
    if (target) target.active = true;
}

// Keep native grabs, but treat the parent and its flyout as one dismissal group.
export class DockFlyoutManager extends PopupMenu.PopupMenuManager {
    constructor(icon, parent) { super(icon); this.parentMenu = parent; }
    _onCapturedEvent(actor, event) {
        const type = event.type();
        if (this.activeMenu && (type === Clutter.EventType.MOTION || type === Clutter.EventType.ENTER)) {
            const [x, y] = event.get_coords();
            if (pointerReturnsToParent(this.parentMenu.actor,
                this.activeMenu.sourceActor, this.activeMenu.actor, x, y)) {
                const source = this.activeMenu.sourceActor;
                this.activeMenu.close(BoxPointer.PopupAnimation.NONE);
                // popModal restores focus to the source; discard that stale
                // pointer selection after the nested grab has been released.
                source.active = false;
                this.pointerReturned?.();
                return Clutter.EVENT_PROPAGATE;
            }
        }
        const outside = (type === Clutter.EventType.BUTTON_PRESS || type === Clutter.EventType.TOUCH_BEGIN)
            && !actor.contains(global.stage.get_event_actor(event))
            && !this.parentMenu.actor.contains(global.stage.get_event_actor(event));
        const escape = type === Clutter.EventType.KEY_PRESS && event.get_key_symbol() === Clutter.KEY_Escape;
        if (outside || escape) {
            this.activeMenu?.close(); // Release the nested grab first.
            this.parentMenu.close();
            return Clutter.EVENT_STOP;
        }
        return super._onCapturedEvent(actor, event);
    }
}

export function autostartEnabled(key) {
    const [keys] = key.get_keys('Desktop Entry');
    return !(keys.includes('Hidden') && key.get_boolean('Desktop Entry', 'Hidden')) &&
        (!keys.includes('X-GNOME-Autostart-enabled') || key.get_boolean('Desktop Entry', 'X-GNOME-Autostart-enabled'));
}

export function dockMenuState(app, backgroundRunning) {
    return {running: app.state !== Shell.AppState.STOPPED || backgroundRunning,
        fixed: ['org.gnome.Nautilus.desktop', 'org.familiarmac.Apps.desktop'].includes(app.get_id())};
}

// Per-icon hooks, installed before the dock calls popup(). No global prototype
// edits, process polling or changes to the app's own desktop actions.
export class DockMenus {
    constructor() { this.icons = new Map(); }
    track(icon) {
        if (this.icons.has(icon) || typeof icon.popupMenu !== 'function') return;
        const info = icon.app.get_app_info();
        const trash = icon.app.isTrash === true || ['trash://', 'trash:///'].includes((icon.app.appInfo ?? info)?.location?.get_uri?.());
        if (!trash && !info?.get_filename?.()) return;
        const record = {icon};
        record.open = icon.connect('menu-state-changed', (_icon, open) => {
            if (!open || !icon._menu || record.menu) return;
            const menu = icon._menu;
            record.menu = menu;
            record.menuDestroy = menu.connect('destroy', () => { this.clearFlyout(record); record.menu = null; record.closeSignal = 0; });
            record.rebuild = menu._rebuildMenu;
            record.update = menu.update;
            menu._rebuildMenu = () => this.build(record);
            // Rebuild only while visible; native window updates must not access
            // the old dock menu's removed preview/quit items.
            menu.update = () => { if (menu.isOpen) this.build(record); };
            if (trash) this.build(record);
        });
        record.destroy = icon.connect('destroy', () => {
            this.dispose(record, false); this.icons.delete(icon);
        });
        this.icons.set(icon, record);
    }
    autostart(info) {
        const filename = GLib.path_get_basename(info.get_filename());
        const path = GLib.build_filenamev([GLib.get_user_config_dir(), 'autostart', filename]);
        const files = [path, ...GLib.get_system_config_dirs().map(dir => GLib.build_filenamev([dir, 'autostart', filename]))];
        let enabled = false;
        for (const candidate of files) {
            if (!GLib.file_test(candidate, GLib.FileTest.EXISTS)) continue;
            try {
                const key = new GLib.KeyFile();
                key.load_from_file(candidate, GLib.KeyFileFlags.NONE);
                enabled = autostartEnabled(key);
            } catch (error) {
                // A malformed optional autostart file must not abort menu.popup()
                // before the dock has anchored and positioned the parent menu.
                logError(error, 'Cannot read Dock autostart state');
            }
            break;
        }
        return {path, enabled};
    }
    setAutostart(info, enabled) {
        const {path} = this.autostart(info);
        const key = new GLib.KeyFile();
        key.load_from_file(GLib.file_test(path, GLib.FileTest.EXISTS) ? path : info.get_filename(), GLib.KeyFileFlags.KEEP_COMMENTS);
        key.set_boolean('Desktop Entry', 'Hidden', !enabled);
        key.set_boolean('Desktop Entry', 'X-GNOME-Autostart-enabled', enabled);
        GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o700);
        key.save_to_file(path);
    }
    clearFlyout(record) {
        if (record.manager) record.manager.pointerReturned = null;
        if (record.hoverCheck) {
            GLib.source_remove(record.hoverCheck); record.hoverCheck = 0;
        }
        if (record.parentPointer) {
            record.menu.actor.disconnect(record.parentPointer); record.parentPointer = 0;
        }
        if (!record.flyout) return;
        record.flyout.close();
        record.manager.removeMenu(record.flyout);
        record.flyout.destroy(); record.flyout = null;
    }
    build(record) {
        const {icon, menu} = record;
        this.clearFlyout(record);
        menu.removeAll();
        menu.actor.add_style_class_name('fm-dock-menu');
        const app = icon.app, info = app.get_app_info();
        if (app.isTrash === true || ['trash://', 'trash:///'].includes((app.appInfo ?? info)?.location?.get_uri?.())) {
            menu.addAction('Open', () => app.activate());
            const empty = menu.addAction('Empty Trash', () => app.launch_action('empty-trash', global.get_current_time(), -1));
            empty.setSensitive(info.list_actions().includes('empty-trash'));
            return;
        }
        const {running, fixed} = dockMenuState(app, icon._macbookBackgroundRunning);
        const windows = app.get_windows().filter(w => !w.is_override_redirect() && !w.skip_taskbar);
        const separator = () => menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const isSettings = app.get_id() === 'org.gnome.Settings.desktop';
        if (isSettings) {
            const panels = settingsPanels();
            const effects = Gio.DesktopAppInfo.new('familiarmac-genie-preferences.desktop');
            const entries = panels.map(panel => ({name: panel.name,
                activate: () => Util.spawn([settingsCommand(), ...panel.args])}));
            if (effects) {
                // Match panel identity, not its translated display name.
                const appearance = panels.findIndex(panel => ['background', 'appearance'].includes(panel.args[0]));
                const alphabetical = entries.findIndex(entry => entry.name.localeCompare('Dock & Window') > 0);
                const index = appearance >= 0 ? appearance + 1 : alphabetical >= 0 ? alphabetical : entries.length;
                entries.splice(index, 0, {name: 'Dock & Window…', activate: () => effects.launch([], null)});
            }
            for (const entry of entries) menu.addAction(entry.name, entry.activate);
            if (panels.length || effects) separator();
        }
        if (running && !isSettings) {
            for (const window of windows) {
                const item = menu.addAction(window.get_title() || app.get_name(), () => Main.activateWindow(window));
                item.setOrnament(window.has_focus() ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
            }
            if (windows.length) separator();
            const actions = info.list_actions();
            for (const action of actions)
                menu.addAction(info.get_action_name(action), () => app.launch_action(action, global.get_current_time(), -1));
            if (app.can_open_new_window() && !actions.includes('new-window'))
                menu.addAction('New Window', () => app.open_new_window(-1));
        }
        const options = new PopupMenu.PopupMenuItem('Options');
        options.add_child(new St.Icon({icon_name: 'pan-end-symbolic', style_class: 'popup-menu-arrow', x_expand: true, x_align: Clutter.ActorAlign.END}));
        menu.addMenuItem(options);
        const flyout = new PopupMenu.PopupMenu(options, 0, St.Side.LEFT);
        record.flyout = flyout;
        flyout.connect('open-state-changed', (_flyout, open) => {
            if (open) options.add_style_class_name('fm-submenu-open');
            else options.remove_style_class_name('fm-submenu-open');
        });
        flyout.actor.add_style_class_name('fm-dock-menu');
        flyout.actor.add_style_class_name('fm-dock-flyout');
        const pointer = flyout._boxPointer;
        const reposition = pointer._reposition;
        pointer._reposition = function (box) {
            reposition.call(this, box);
            const [px, py] = menu.box.get_transformed_position();
            const [pw] = menu.box.get_transformed_size();
            const [, rowY] = options.get_transformed_position();
            const [, , width, height] = this.get_preferred_size();
            const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
            const pos = flyoutPosition({x: px, y: py, width: pw}, rowY,
                {width, height}, this._workArea, scale);
            const [ok, x, y] = this.get_parent().transform_stage_point(pos.x, pos.y);
            if (ok) box.set_origin(Math.floor(x), Math.floor(y));
        };
        Main.uiGroup.add_child(flyout.actor); flyout.actor.hide();
        record.manager ??= new DockFlyoutManager(icon, menu);
        record.manager.parentMenu = menu;
        record.manager.addMenu(flyout);
        const favorites = AppFavorites.getAppFavorites(), pinned = favorites.isFavorite(app.get_id());
        const pin = flyout.addAction(running ? 'Keep in Dock' : (pinned ? 'Remove from Dock' : 'Keep in Dock'), () => {
            if (pinned) favorites.removeFavorite(app.get_id()); else favorites.addFavorite(app.get_id());
            menu.close();
        });
        if (running && pinned) pin.setOrnament(PopupMenu.Ornament.CHECK);
        pin.setSensitive(!fixed && global.settings.is_writable('favorite-apps'));
        const {enabled} = this.autostart(info);
        const startup = flyout.addAction('Open at Login', () => {
            try { this.setAutostart(info, !enabled); } catch (error) { Main.notifyError('Open at Login', error.message); }
            menu.close();
        });
        if (enabled) startup.setOrnament(PopupMenu.Ornament.CHECK);
        flyout.addAction('Show in Finder', () => {
            const file = Gio.File.new_for_path(info.get_filename());
            Gio.DBus.session.call('org.freedesktop.FileManager1', '/org/freedesktop/FileManager1',
                'org.freedesktop.FileManager1', 'ShowItems', new GLib.Variant('(ass)', [[file.get_uri()], '']),
                null, Gio.DBusCallFlags.NONE, -1, null, (connection, result) => {
                    try { connection.call_finish(result); } catch (error) { Main.notifyError('Show in Finder', error.message); }
                });
            menu.close();
        });
        options.activate = () => flyout.open();
        const checkPointer = () => {
            if (!menu.isOpen || !options.mapped) return;
            const [x, y] = global.get_pointer();
            if (!pointerInside(options, x, y)) options.active = false;
            if (flyout.isOpen) return;
            selectParentPointerRow(menu, x, y);
            if (pointerInside(menu.actor, x, y) && pointerInside(options, x, y))
                flyout.open();
        };
        const queuePointerCheck = () => {
            if (record.hoverCheck) return;
            record.hoverCheck = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                record.hoverCheck = 0;
                checkPointer();
                return GLib.SOURCE_REMOVE;
            });
        };
        record.manager.pointerReturned = queuePointerCheck;
        options.connect('notify::hover', () => { if (options.hover) queuePointerCheck(); });
        // Hover notifications alone can remain stale after releasing a modal grab.
        // Every pointer check runs after event dispatch; modal-release leave/focus
        // events must finish before selecting the new row. Allocation also checks so
        // a row moved beneath a stationary pointer can open without a click.
        record.parentPointer = menu.actor.connect('captured-event', (_actor, event) => {
            if ([Clutter.EventType.MOTION, Clutter.EventType.ENTER,
                Clutter.EventType.SCROLL].includes(event.type()))
                queuePointerCheck();
            return Clutter.EVENT_PROPAGATE;
        });
        options.connect('notify::allocation', queuePointerCheck);
        // The options flyout has its own nested native modal grab, released by
        // its manager; parent closure always releases it too.
        if (!record.closeSignal) record.closeSignal = menu.connect('open-state-changed', (_menu, open) => { if (!open) record.flyout?.close(); });
        if (running) {
            separator();
            if (windows.length) {
                menu.addAction('Show All Windows', () => { menu.close(); icon._windowPreviews(); });
                menu.addAction('Hide', () => windows.forEach(w => w.minimize()));
            }
            if (!fixed) menu.addAction('Quit', () => app.request_quit());
        } else menu.addAction('Open', () => app.activate());
    }
    dispose(record, restore) {
        this.clearFlyout(record);
        if (restore && record.menu) {
            if (record.closeSignal) record.menu.disconnect(record.closeSignal);
            record.menu.disconnect(record.menuDestroy);
            record.menu.close();
            record.menu._rebuildMenu = record.rebuild; record.menu.update = record.update;
            record.menu.actor.remove_style_class_name('fm-dock-menu');
        }
    }
    destroy() {
        for (const record of this.icons.values()) {
            record.icon.disconnect(record.open); record.icon.disconnect(record.destroy);
            this.dispose(record, true);
        }
        this.icons.clear();
    }
}
