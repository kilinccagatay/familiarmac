#!/usr/bin/python3
"""Shared toolkit integration: native GTK modules and detected Qt Flatpaks.
Does not fabricate menus or patch application binaries. Runs only on events.
"""
from pathlib import Path
import configparser
import json
import shutil
import subprocess
import sys
from gi.repository import Gio, GLib

HOME = Path.home()
STATE = HOME / '.local/state/familiarmac/toolkits'
REGISTRAR = 'com.canonical.AppMenu.Registrar'


def output(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL).strip()


def qt_capable(metadata, files):
    # Require a Qt Widgets library and an XCB platform plugin, not an app name.
    runtime = metadata.get('Application', 'runtime', fallback='')
    if runtime.startswith('org.kde.Platform/'):
        return True
    return (any(files.glob('lib/**/libQt*Widgets.so*')) and
            any(files.glob('lib/**/libqxcb.so')))


def restore():
    record = STATE / 'gtk.json'
    if record.exists():
        s = Gio.Settings.new('org.gnome.settings-daemon.plugins.xsettings')
        old = json.loads(record.read_text())
        for key, pair in old.items():
            if s.get_value(key).print_(True) != pair['installed']:
                raise SystemExit('GTK settings changed externally; restore refused: ' + key)
        for key, pair in old.items():
            s.set_value(key, GLib.Variant.parse(None, pair['before'], None, None))
        Gio.Settings.sync()
        record.unlink()
    for record in STATE.glob('flatpak-*.json'):
        data = json.loads(record.read_text())
        target = HOME / '.local/share/flatpak/overrides' / data['id']
        if not target.exists() or target.read_text() != data['installed']:
            raise SystemExit('Flatpak override changed externally: ' + data['id'])
        if data['before'] is None:
            target.unlink()
        else:
            target.write_text(data['before'])
        record.unlink()


def apply():
    STATE.mkdir(parents=True, exist_ok=True)
    # The module itself waits for a registrar; absent export support keeps local menus.
    module = list(Path('/usr/lib').glob('*/gtk-3.0/modules/libappmenu-gtk-module.so'))
    if not module:
        raise SystemExit('Missing appmenu-gtk3-module; run scripts/bootstrap.sh first.')
    s = Gio.Settings.new('org.gnome.settings-daemon.plugins.xsettings')
    record = STATE / 'gtk.json'
    saved = json.loads(record.read_text()) if record.exists() else {}
    key = 'enabled-gtk-modules'
    before = s.get_value(key).print_(True)
    values = s.get_strv(key)
    if 'appmenu-gtk-module' not in values:
        s.set_strv(key, values + ['appmenu-gtk-module'])
    saved.setdefault(key, {'before': before})['installed'] = s.get_value(key).print_(True)
    # Preserve decoration layout and unrelated XSettings overrides.
    key = 'overrides'
    before = s.get_value(key).print_(True)
    original = s.get_value(key)
    values = {k: original.lookup_value(k, None) for k in original.unpack()}
    values['Gtk/ShellShowsMenubar'] = GLib.Variant('i', 1)
    s.set_value(key, GLib.Variant('a{sv}', values))
    saved.setdefault(key, {'before': before})['installed'] = s.get_value(key).print_(True)
    record.write_text(json.dumps(saved, indent=2))
    Gio.Settings.sync()
    report = []
    if shutil.which('flatpak'):
        for app in output('flatpak', 'list', '--app', '--columns=application').splitlines():
            try:
                cfg = configparser.ConfigParser(interpolation=None)
                cfg.read_string(output('flatpak', 'info', '--show-metadata', app))
                files = Path(output('flatpak', 'info', '--show-location', app)) / 'files'
                if app == 'org.mozilla.firefox':
                    status = 'dedicated Firefox adapter'
                elif qt_capable(cfg, files):
                    target = HOME / '.local/share/flatpak/overrides' / app
                    record = STATE / ('flatpak-' + app + '.json')
                    data = json.loads(record.read_text()) if record.exists() else {
                        'id': app, 'before': target.read_text() if target.exists() else None}
                    subprocess.run(['flatpak', 'override', '--user',
                                    '--talk-name=' + REGISTRAR, '--socket=x11',
                                    '--nosocket=wayland', '--env=QT_QPA_PLATFORM=xcb', app], check=True)
                    data['installed'] = target.read_text()
                    record.write_text(json.dumps(data, indent=2))
                    status = 'Qt Widgets: X11/menu permission configured; runtime menu needs verification'
                else:
                    status = 'no verified generic adapter; native controls/menu preserved'
                report.append({'id': app, 'package': 'flatpak', 'status': status})
            except (subprocess.CalledProcessError, OSError, configparser.Error) as e:
                report.append({'id': app, 'package': 'flatpak', 'status': 'error: ' + str(e)})
    # Include every visible installed launcher, without launching user applications.
    for app in Gio.AppInfo.get_all():
        if not app.should_show() or not app.get_id():
            continue
        if any(r['id'] + '.desktop' == app.get_id() for r in report):
            continue
        report.append({'id': app.get_id(), 'package': 'desktop',
                       'status': 'shared GTK module / native exporter available; custom UI not guaranteed'})
    (STATE / 'applications.json').write_text(json.dumps(report, indent=2))
    print('Toolkit integration prepared; inventory:', len(report), 'applications.')


if __name__ == '__main__':
    restore() if '--restore' in sys.argv else apply()
