import {NotificationBanner} from './notificationBanner.js';
import {SystemAppearance} from './systemAppearance.js';
import {OsdStyle} from './osdStyle.js';
import {NotificationCenter} from './notificationCenter.js';
import {PanelClock} from './panelClock.js';
import {SessionDialog} from './sessionDialog.js';
import {ControlCenter} from './controlCenter.js';
import {DownloadsStack} from './downloadsStack.js';
import {AppsBrowser} from './appsBrowser.js';
import {DockOrder} from './dockOrder.js';
import {TrashDrop} from './trashDrop.js';
import {DockMenus} from './dockMenus.js';
import {DockLaunch} from './dockLaunch.js';
import {CaptureBindings} from './capture.js';
import Gio from 'gi://Gio';
import {ProcessTracker} from './processTracker.js';
import GLib from 'gi://GLib';
import Gettext from 'gettext';
import St from 'gi://St';
import Shell from 'gi://Shell';
import * as Screenshot from 'resource:///org/gnome/shell/ui/screenshot.js';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class MacBookMenu extends Extension {
    enable() {
        this._appearance = new SystemAppearance();
        // macOS places date/time after all status icons, at the far right.
        this._clock = Main.panel.statusArea.dateMenu.container;
        this._clockParent = this._clock.get_parent();
        this._clockIndex = this._clockParent.get_children().indexOf(this._clock);
        this._clockParent.remove_child(this._clock);
        Main.panel._rightBox.add_child(this._clock);
        this._clock.add_style_class_name('macbook-panel-clock');
        this._notificationCenter = new NotificationCenter();
        this._notificationBanner = new NotificationBanner();
        this._controlCenter = new ControlCenter(this.path);
        this._osdStyle = new OsdStyle();
        this._sessionDialog = new SessionDialog();
        this._panelClock = new PanelClock();
        this._captureBindings = new CaptureBindings();
        this._trashDrop = new TrashDrop();
        this._appsBrowser = new AppsBrowser();
        this._dockOrder = new DockOrder();
        this._downloadsStack = new DownloadsStack();
        // Use the dock's own renderer, color, radius and placement for Finder.
        // Only its displayed window count is kept at one when no window exists.
        this._dockLaunch = new DockLaunch();
        this._dockMenus = new DockMenus();
        this._finderIndicators = new Map();
        this._processTracker = new ProcessTracker();
        const restoreIndicator = (indicator, saved) => {
            const {descriptor, area, signal} = saved;
            area.disconnect(signal);
            if (descriptor) Object.defineProperty(indicator, '_number', descriptor);
            else delete indicator._number;
            area.queue_repaint();
        };
        this._restoreFinderIndicator = restoreIndicator;
        const updateFinder = () => {
            const seen = new Set();
            const visit = actor => {
                this._dockOrder.trackSeparator(actor);
                if (actor.app?.get_id?.()) this._downloadsStack.track(actor);
                if (actor.app?.get_id?.() && actor._indicator) {
                    this._dockLaunch.track(actor);
                    this._dockMenus.track(actor);
                    this._dockOrder.track(actor);
                    const previousRunning = actor._macbookBackgroundRunning;
                    actor._macbookBackgroundRunning = actor.app.get_id() === 'org.gnome.Nautilus.desktop'
                        || this._processTracker.isRunning(actor.app);
                    for (const indicator of actor._indicator?._indicators ?? []) {
                        if (!indicator._area || !indicator._computeStyle) continue;
                        seen.add(indicator);
                        let repaint = previousRunning !== actor._macbookBackgroundRunning;
                        if (!this._finderIndicators.has(indicator)) {
                            repaint = true;
                            let proto = Object.getPrototypeOf(indicator);
                            while (proto && !Object.getOwnPropertyDescriptor(proto, '_number'))
                                proto = Object.getPrototypeOf(proto);
                            const getter = proto && Object.getOwnPropertyDescriptor(proto, '_number')?.get;
                            if (!getter) continue;
                            const descriptor = Object.getOwnPropertyDescriptor(indicator, '_number');
                            const area = indicator._area;
                            const signal = area.connect('destroy', () => {
                                // JS property restoration is safe; the disposed actor is not.
                                if (descriptor) Object.defineProperty(indicator, '_number', descriptor);
                                else delete indicator._number;
                                this._finderIndicators.delete(indicator);
                            });
                            this._finderIndicators.set(indicator, {descriptor, area, signal});
                            Object.defineProperty(indicator, '_number', {
                                configurable: true,
                                get() { return Math.max(actor._macbookBackgroundRunning ? 1 : 0, getter.call(this)); },
                            });
                        }
                        if (repaint) indicator._area.queue_repaint();
                    }
                }
                for (const child of actor.get_children()) visit(child);
            };
            // addChrome docks are direct uiGroup children; never traverse windows,
            // overview, notifications or open application menus to find dock icons.
            for (const child of Main.uiGroup.get_children())
                if (child.name === 'dashtodockContainer') visit(child);
            for (const [indicator, descriptor] of this._finderIndicators) {
                if (seen.has(indicator)) continue;
                restoreIndicator(indicator, descriptor);
                this._finderIndicators.delete(indicator);
            }
            return GLib.SOURCE_CONTINUE;
        };
        this._finderTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, updateFinder);
        updateFinder();
        const tr = GLib.get_language_names()[0].startsWith('tr');
        const label = (en, turkish) => tr ? turkish : en;
        const _ = Gettext.domain('gnome-shell').gettext;
        this._activities = Main.panel.statusArea.activities;
        this._wasVisible = this._activities?.visible;
        this._activities?.hide();
        // Keep the workspace indicator hidden even when the overview changes.
        this._visibilityId = this._activities?.connect('notify::visible', actor => {
            if (actor.visible) actor.hide();
        });
        this._button = new PanelMenu.Button(0.0, label('Apple menu', 'Apple menüsü'));
        this._button.add_style_class_name('macbook-apple-button');
        this._button.add_child(new St.Icon({
            gicon: new Gio.FileIcon({file: Gio.File.new_for_path(`${this.path}/apple.svg`)}),
            icon_size: 16, style_class: 'system-status-icon',
        }));
        const menu = this._button.menu;
        menu.setSourceAlignment(0);
        // BoxPointer aligns to the button's padded content, not the screen edge.
        // Scope the allocation adjustment to this popup only (GNOME 46).
        const pointer = menu._boxPointer;
        const reposition = pointer._reposition.bind(pointer);
        pointer._reposition = allocation => {
            reposition(allocation);
            const source = pointer._sourceActor;
            if (!source) return;
            const monitor = Main.layoutManager.findMonitorForActor(source);
            if (!monitor) return;
            const [ok, x] = pointer.get_parent().transform_stage_point(monitor.x + 4, monitor.y);
            if (ok) allocation.set_origin(Math.floor(x), allocation.y1);
        };
        menu.actor.add_style_class_name('macbook-system-menu');
        const addApp = (text, icon, args) => {
            const item = new PopupMenu.PopupImageMenuItem(text, icon);
            item.connect('activate', () => Util.spawn(args));
            menu.addMenuItem(item);
        };
        const settingsWrapper = GLib.build_filenamev([GLib.get_home_dir(), '.local/bin/familiarmac-settings']);
        addApp(label('About This Mac', 'Bu Mac Hakkında'), 'computer-symbolic', [GLib.file_test(settingsWrapper, GLib.FileTest.IS_EXECUTABLE) ? settingsWrapper : 'gnome-control-center', 'system', 'about']);
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        addApp(label('System Settings…', 'Sistem Ayarları…'), 'preferences-system-symbolic', ['gnome-control-center']);
        addApp(label('App Store', 'Uygulama Mağazası'), 'org.gnome.Software-symbolic', ['gnome-software']);
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const recent = new PopupMenu.PopupSubMenuMenuItem(label('Recent Items', 'Son Kullanılanlar'));
        menu.addMenuItem(recent);
        try {
            const bookmarks = new GLib.BookmarkFile();
            bookmarks.load_from_file(GLib.build_filenamev([GLib.get_user_data_dir(), 'recently-used.xbel']));
            const uris = bookmarks.get_uris();
            for (const uri of uris.slice(-10).reverse()) {
                const title = bookmarks.get_title(uri) || Gio.File.new_for_uri(uri).get_basename();
                recent.menu.addAction(title, () => Gio.AppInfo.launch_default_for_uri(uri, global.create_app_launch_context(0, -1)));
            }
        } catch (_) { /* No recent documents is normal on a fresh profile. */ }
        if (recent.menu.isEmpty()) {
            const empty = new PopupMenu.PopupMenuItem(label('No Recent Items', 'Son Kullanılan Yok'), {reactive: false});
            recent.menu.addMenuItem(empty);
        }
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addAction(label('Force Quit…', 'Çıkmaya Zorla…'), () => Util.spawn(['gnome-system-monitor']));
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const actions = SystemActions.getDefault();
        const entries = [
            [label('Sleep', 'Uyut'), 'canSuspend', 'activateSuspend'],
            [_('Restart…'), 'canRestart', 'activateRestart'],
            [_('Power Off…'), 'canPowerOff', 'activatePowerOff'],
            [_('Lock Screen'), 'canLockScreen', 'activateLockScreen'],
            [label(`Log Out ${GLib.get_real_name()}…`, `Oturumu Kapat: ${GLib.get_real_name()}…`), 'canLogout', 'activateLogout'],
        ].map(([label, capability, method]) => {
            if (method === 'activateLockScreen') menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const item = menu.addAction(label, () => actions[method]());
            item.setSensitive(actions[capability]);
            return {item, capability};
        });
        this._actions = actions;
        this._actionSignal = actions.connect('notify', () => {
            for (const {item, capability} of entries)
                item.setSensitive(actions[capability]);
        });
        menu.connect('open-state-changed', (_menu, open) => {
            if (open) actions.forceUpdate();
        });
        Main.panel.addToStatusArea(this.uuid, this._button, 0, 'left');
    }

    disable() {
        this._appearance?.destroy();
        this._appearance = null;
        this._osdStyle?.destroy();
        this._osdStyle = null;
        this._panelClock?.destroy();
        this._panelClock = null;
        this._sessionDialog?.destroy();
        this._sessionDialog = null;
        this._controlCenter?.destroy();
        this._controlCenter = null;
        this._notificationBanner?.destroy();
        this._notificationBanner = null;
        this._notificationCenter?.destroy();
        this._notificationCenter = null;
        if (this._clock && this._clockParent) {
            this._clock.get_parent()?.remove_child(this._clock);
            this._clockParent.insert_child_at_index(this._clock, this._clockIndex);
            this._clock.remove_style_class_name('macbook-panel-clock');
        }
        this._clock = this._clockParent = null;
        this._downloadsStack?.destroy();
        this._downloadsStack = null;
        this._appsBrowser?.destroy();
        this._appsBrowser = null;
        this._dockOrder?.destroy();
        this._dockOrder = null;
        this._trashDrop?.destroy();
        this._trashDrop = null;
        this._captureBindings?.destroy();
        this._captureBindings = null;
        if (this._finderTimer) GLib.source_remove(this._finderTimer);
        this._finderTimer = null;
        for (const [indicator, descriptor] of this._finderIndicators ?? [])
            this._restoreFinderIndicator(indicator, descriptor);
        this._finderIndicators?.clear();
        this._processTracker = null;
        this._dockMenus?.destroy();
        this._dockMenus = null;
        this._dockLaunch?.destroy();
        this._dockLaunch = null;

        if (this._actionSignal) this._actions.disconnect(this._actionSignal);
        this._actionSignal = null;
        this._actions = null;
        this._button?.destroy();
        this._button = null;
        if (this._visibilityId) this._activities.disconnect(this._visibilityId);
        this._visibilityId = null;
        if (this._wasVisible) this._activities?.show();
        this._activities = null;
    }
}
