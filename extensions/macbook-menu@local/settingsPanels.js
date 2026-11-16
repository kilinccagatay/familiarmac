import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Installed panel launchers supply translated names and version-correct subpages.
// Do not use should_show(): GNOME intentionally hides these from the app grid.
export function settingsPanels(apps = Gio.AppInfo.get_all()) {
    const seen = new Set();
    const panels = [];
    for (const info of apps) {
        if (!/^gnome-.+-panel\.desktop$/.test(info.get_id() ?? '')) continue;
        try {
            const [ok, argv] = GLib.shell_parse_argv(info.get_commandline() ?? '');
            if (!ok || GLib.path_get_basename(argv[0]) !== 'gnome-control-center') continue;
            const args = argv.slice(1).filter(arg => !/^%[fFuU]$/.test(arg));
            if (!args.length || args.some(arg => !/^[a-z][a-z0-9-]*$/.test(arg))) continue;
            const key = args.join(' ');
            if (seen.has(key)) continue;
            seen.add(key);
            panels.push({name: info.get_name(), args});
        } catch (_) { /* Ignore malformed third-party desktop entries. */ }
    }
    return panels.sort((a, b) => a.name.localeCompare(b.name));
}
