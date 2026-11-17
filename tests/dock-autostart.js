// Run with gjs: exercise the actual GLib introspection API, not a stub.
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const [, bytes] = Gio.File.new_for_path('extensions/macbook-menu@local/dockMenus.js').load_contents(null);
const source = new TextDecoder().decode(bytes);
const code = source.match(/export function autostartEnabled\(key\) \{[\s\S]*?\n\}/)[0].replace('export ', '');
const enabled = new Function('key', code + '\nreturn autostartEnabled(key);');
for (const [entries, expected] of [
    ['Name=App\n', true], ['Hidden=true\n', false], ['Hidden=false\n', true],
    ['X-GNOME-Autostart-enabled=false\n', false],
    ['Hidden=true\nX-GNOME-Autostart-enabled=true\n', false],
]) {
    const text = '[Desktop Entry]\n' + entries;
    const key = new GLib.KeyFile();
    key.load_from_data(text, new TextEncoder().encode(text).length, GLib.KeyFileFlags.NONE);
    if (enabled(key) !== expected) throw new Error('Autostart state mismatch');
}
print('Dock autostart: real GLib KeyFile API, absent keys and disabled entries PASS');
