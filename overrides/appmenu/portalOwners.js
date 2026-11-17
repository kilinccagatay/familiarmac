import Gio from 'gi://Gio';

export function portalOwnerId(entries, pid, title, proxy = null) {
    if (!Array.isArray(entries) || !Number.isInteger(pid) || pid <= 0 || typeof title !== 'string') return null;
    // GNOME can lend its Wayland socket to the portal backend. Meta then reports
    // the compositor PID, not the backend PID. Accept that case only for one
    // live chooser and an exact backend executable/app-id match, never by title alone.
    const proxied = proxy && pid === proxy.shellPid && proxy.windowCount === 1 &&
        /^xdg-desktop-portal-[a-z0-9-]+$/.test(proxy.wmClass ?? '');
    const matches = entries.filter(e => e && e.title === title && typeof e.appId === 'string' &&
        (e.pid === pid || (proxied && e.backendClass === proxy.wmClass)));
    return matches.length === 1 ? matches[0].appId : null;
}

export class PortalOwners {
    constructor(changed) {
        this._changed = changed;
        this._entries = [];
        this._generation = 0;
        this._signal = Gio.DBus.session.signal_subscribe('org.familiarmac.PortalOwners',
            'org.familiarmac.PortalOwners','Changed','/org/familiarmac/PortalOwners',null,
            Gio.DBusSignalFlags.NONE,()=>this._load());
        this._owner = Gio.DBus.session.signal_subscribe('org.freedesktop.DBus',
            'org.freedesktop.DBus','NameOwnerChanged','/org/freedesktop/DBus',
            'org.familiarmac.PortalOwners',Gio.DBusSignalFlags.NONE,()=>{this._entries=[];this._load();});
        this._load();
    }
    _load() {
        const generation = ++this._generation;
        Gio.DBus.session.call('org.familiarmac.PortalOwners','/org/familiarmac/PortalOwners',
            'org.familiarmac.PortalOwners','GetState',null,null,Gio.DBusCallFlags.NO_AUTO_START,
            1000,null,(bus,result)=>{
                if (!this._changed || generation !== this._generation) return;
                try { this._entries=JSON.parse(bus.call_finish(result).deepUnpack()[0]); }
                catch (_) { this._entries=[]; }
                this._changed();
            });
    }
    appFor(window, appSystem) {
        const pid = window?.get_pid?.();
        const title = window?.get_title?.();
        const wmClass = window?.get_wm_class?.();
        const shellPid = new Gio.Credentials().get_unix_pid();
        const windowCount = global.get_window_actors().filter(a =>
            a.meta_window.get_pid() === pid && a.meta_window.get_title() === title &&
            a.meta_window.get_wm_class() === wmClass).length;
        const id = portalOwnerId(this._entries, pid, title, {shellPid, wmClass, windowCount});
        return id ? appSystem.lookup_app(`${id}.desktop`) : null;
    }
    destroy() {
        this._changed=null;this._entries=[];
        Gio.DBus.session.signal_unsubscribe(this._signal);
        Gio.DBus.session.signal_unsubscribe(this._owner);
    }
}
