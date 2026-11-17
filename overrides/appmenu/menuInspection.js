// Explicit rediscovery of one running application's real menu.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import {RealMenuManager} from './realMenuManager.js';
const XML = `<node><interface name="org.familiarmac.MenuInspection"><method name="Recheck"><arg type="s" direction="in"/><arg type="s" direction="out"/></method><method name="OpenForInspection"><arg type="s" direction="in"/><arg type="s" direction="out"/></method><method name="RecheckOwned"><arg type="s" direction="in"/><arg type="s" direction="in"/><arg type="s" direction="out"/></method></interface></node>`;
export class MenuInspection {
    constructor(settings, refreshed) {
        this.settings = settings;
        this.refreshed = refreshed;
        this.pending = null;
        this.launches = new Map();
        this.object = Gio.DBusExportedObject.wrapJSObject(XML, this);
        this.object.export(Gio.DBus.session, '/org/familiarmac/MenuInspection');
    }
    _forgetLaunch(token) {
        const entry = this.launches.get(token);
        if (entry?.signal) entry.app.disconnect(entry.signal);
        this.launches.delete(token);
    }
    OpenForInspection(id) {
        for (const [token, entry] of this.launches)
            if (Date.now() - entry.created > 600000) this._forgetLaunch(token);
        const app = Shell.AppSystem.get_default().lookup_app(id);
        if (!app) throw new Error('Application is no longer installed.');
        if (app.get_state() !== Shell.AppState.STOPPED || app.get_windows().length) {
            app.activate();
            return ''; // Never close an app that was already running.
        }
        if (this.launches.size >= 32) this._forgetLaunch(this.launches.keys().next().value);
        const token = GLib.uuid_string_random();
        const entry = {id, app, created:Date.now(), signal:0};
        this.launches.set(token, entry);
        try {
            app.activate();
            entry.signal = app.connect('notify::state', () => {
                if (app.get_state() === Shell.AppState.STOPPED) this._forgetLaunch(token);
            });
        } catch (error) { this._forgetLaunch(token); throw error; }
        return token;
    }
    RecheckOwnedAsync([id, token], invocation) {
        this._recheck(id, invocation, token);
    }
    RecheckAsync([id], invocation) {
        this._recheck(id, invocation, null);
    }
    _recheck(id, invocation, token) {
        if (this.pending) {
            invocation.return_dbus_error('org.familiarmac.Busy', 'Another menu check is running.');
            return;
        }
        const app = Shell.AppSystem.get_default().lookup_app(id);
        const window = app?.get_windows().find(w => !w.get_transient_for());
        if (!window) {
            invocation.return_value(new GLib.Variant('(s)', [JSON.stringify({status:'not-running', message:'Open the application, then check again.'})]));
            return;
        }
        const probe = new RealMenuManager(this.settings, () => {});
        const finish = () => {
            let report;
            try {
                const model = probe.buildCurrentMenuModel(app.get_name());
                let commands = 0, shortcuts = 0;
                const walk = rows => { for (const row of rows ?? []) {
                    if (row.children?.length) walk(row.children);
                    else if (row.label && row.type !== 'separator') { commands++; if (row.shortcut || row.accelerator) shortcuts++; }
                }};
                walk(model?.topLevelMenus); walk(model?.appMenuChildren);
                report = {status:commands ? 'adapted' : 'not-exported', backend:probe._backendType,
                    commands, shortcuts, checkedAt:new Date().toISOString(),
                    message:commands ? `Adapted — ${commands} menu items; ${shortcuts} shortcut hints detected.` : 'No exported menu found. App may not support menu export.'};
            } catch (_) { report = {status:'failed', message:'Menu inspection failed; existing menus retained.'}; }
            probe.destroy(); this.pending = null;
            const launch = this.launches.get(token);
            if (report.status === 'adapted' && launch?.id === id && launch.app === app && Date.now() - launch.created <= 600000) {
                this._forgetLaunch(token); // One normal close attempt, never force quit.
                if (app.get_windows().includes(window) && window.can_close()) {
                    try {
                        window.delete(global.get_current_time());
                        report.closeRequested = true;
                        report.message += ' Close requested for the window opened by setup.';
                    } catch (_) { report.message += ' Close the app when you are finished.'; }
                }
            }
            invocation.return_value(new GLib.Variant('(s)', [JSON.stringify(report)]));
            this.refreshed(app);
            return GLib.SOURCE_REMOVE;
        };
        probe.updateForWindow(window, app.get_name(), app, window.get_wm_class());
        const timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3500, finish);
        this.pending = {probe, timer, invocation};
    }
    destroy() {
        for (const token of [...this.launches.keys()]) this._forgetLaunch(token);
        if (this.pending) {
            GLib.source_remove(this.pending.timer); this.pending.probe.destroy();
            this.pending.invocation.return_dbus_error('org.familiarmac.Stopped', 'Menu service stopped.');
            this.pending = null;
        }
        this.object.unexport();
    }
}
