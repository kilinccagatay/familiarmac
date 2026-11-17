import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
Gio._promisify(Gio.DBusConnection.prototype, 'call', 'call_finish');
const cache = new Map();
const DBUS = 'org.freedesktop.DBus';
async function call(bus, path, iface, method, parameters, cancellable) {
    return (await Gio.DBus.session.call(bus, path, iface, method, parameters, null,
        Gio.DBusCallFlags.NO_AUTO_START, 1000, cancellable)).deepUnpack();
}
async function pidFor(bus, cancellable) {
    return (await call(DBUS, '/org/freedesktop/DBus', DBUS, 'GetConnectionUnixProcessID',
        new GLib.Variant('(s)', [bus]), cancellable))[0];
}
// Fallback for GTK windows mapped before GtkApplication attaches their metadata.
// Match ownership, never display names; pin the unique bus to avoid stale routing.
export async function findGtkApplication(pid, cancellable) {
    if (!Number.isInteger(pid) || pid <= 0) return null;
    const cached = cache.get(pid);
    if (cached) {
        try { if (await pidFor(cached.busName, cancellable) === pid) return cached; } catch (_) {}
        cache.delete(pid);
    }
    try {
        const [names] = await call(DBUS, '/org/freedesktop/DBus', DBUS, 'ListNames', null, cancellable);
        const candidates = names.filter(n => !n.startsWith(':') && n !== DBUS).slice(0, 256);
        for (let offset = 0; offset < candidates.length; offset += 16) {
            if (cancellable?.is_cancelled()) return null;
            const matches = await Promise.all(candidates.slice(offset, offset + 16).map(async name => {
                try {
                    const [owner] = await call(DBUS, '/org/freedesktop/DBus', DBUS, 'GetNameOwner', new GLib.Variant('(s)', [name]), cancellable);
                    if (await pidFor(owner, cancellable) !== pid) return null;
                    const appPath = `/${name.replace(/\./g, '/').replace(/-/g, '_')}`;
                    if (!GLib.Variant.is_object_path(appPath)) return null;
                    const [xml] = await call(owner, appPath, 'org.freedesktop.DBus.Introspectable', 'Introspect', null, cancellable);
                    if (!xml.includes('org.gtk.Application') || !xml.includes('org.gtk.Actions')) return null;
                    return {busName:owner, appPath};
                } catch (_) { return null; }
            }));
            const match = matches.find(Boolean);
            if (match) {
                if (cache.size >= 32) cache.delete(cache.keys().next().value);
                cache.set(pid, match); return match;
            }
        }
    } catch (_) {}
    return null;
}

export async function hasGtkAppMenu(bus, path, cancellable) {
    try {
        const [xml] = await call(bus, path, 'org.freedesktop.DBus.Introspectable', 'Introspect', null, cancellable);
        return xml.includes('org.gtk.Menus');
    } catch (_) { return false; }
}
