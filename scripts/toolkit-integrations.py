#!/usr/bin/python3
"""Shared toolkit integration: native GTK modules and detected Qt Flatpaks.
Does not fabricate menus or patch application binaries. Runs only on events.
"""
from pathlib import Path
import importlib.util
import configparser
import json
import shutil
import subprocess
import sys
import re
import shlex
from gi.repository import Gio, GLib

HOME = Path.home()
STATE = HOME / '.local/state/familiarmac/toolkits'
REGISTRAR = 'com.canonical.AppMenu.Registrar'
spec = importlib.util.spec_from_file_location('flatpak_appearance', Path(__file__).with_name('flatpak-appearance.py'))
appearance = importlib.util.module_from_spec(spec); spec.loader.exec_module(appearance)
spec = importlib.util.spec_from_file_location('flatpak_gtk3_menu', Path(__file__).with_name('flatpak-gtk3-menu.py'))
gtk_menu = importlib.util.module_from_spec(spec); spec.loader.exec_module(gtk_menu)



def output(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL).strip()


def qt_capable(metadata, files):
    # Require a Qt Widgets library and an XCB platform plugin, not an app name.
    runtime = metadata.get('Application', 'runtime', fallback='')
    if runtime.startswith('org.kde.Platform/'):
        return True
    return (any(files.glob('lib/**/libQt*Widgets.so*')) and
            any(files.glob('lib/**/libqxcb.so')))


def gtk3_capable(metadata, files):
    """Inspect the default executable's app-owned ELF dependencies, never run it."""
    if not shutil.which('readelf'): return False
    command = shlex.split(metadata.get('Application', 'command', fallback=''))
    if not command: return False
    executable = files/'bin'/Path(command[0]).name
    queue = [executable]; seen = set(); gtk3 = False
    while queue and len(seen) < 32:
        binary = queue.pop(0)
        if binary in seen or not binary.is_file(): continue
        seen.add(binary)
        with binary.open('rb') as stream:
            elf = stream.read(4) == b'\x7fELF'
        if not elf:
            # Resolve a literal exec target without executing shell code. Ignore
            # substitutions, conditionals and arbitrary dynamic launchers.
            if binary == executable and binary.stat().st_size < 65536:
                for line in binary.read_text(errors='replace').splitlines():
                    try: tokens = shlex.split(line, comments=True)
                    except ValueError: continue
                    if len(tokens) == 3 and tokens[0] == 'exec' and tokens[2] == '$@':
                        target = tokens[1]
                        if re.fullmatch(r'[A-Za-z0-9_.+-]+', target):
                            queue.append(files/'bin'/target)
                        elif re.fullmatch(r'/app/bin/[A-Za-z0-9_.+-]+', target):
                            queue.append(files/'bin'/Path(target).name)
            continue
        result = subprocess.run(['readelf','-d',str(binary)],text=True,capture_output=True,timeout=5)
        libraries = re.findall(r'\(NEEDED\).*?\[([^]]+)\]', result.stdout)
        if 'libgtk-4.so.1' in libraries: return False
        if 'libgtk-3.so.0' in libraries: gtk3 = True
        for name in libraries:
            if '/' in name: continue
            queue.extend((files/'lib').glob(name))
            queue.extend((files/'lib').glob('*/'+name))
    return gtk3


def restore():
    appearance.restore(HOME)
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
    for record in list(STATE.glob('flatpak-*.json')) + list(STATE.glob('global-flatpak.json')):
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
    config = Path(__file__).with_name('appearance-config')
    if not config.exists(): config = Path(__file__).resolve().parents[1]/'config'
    appearance.apply(HOME, [], config, include_native=True)
    report = []
    if shutil.which('flatpak'):
        target = HOME / '.local/share/flatpak/overrides/global'
        record = STATE / 'global-flatpak.json'
        data = json.loads(record.read_text()) if record.exists() else {'id':'global', 'before':target.read_text() if target.exists() else None}
        # GTK looks in the user's theme directories, not the host /usr/share
        # hidden by Flatpak's runtime. Mirror distro themes without overwriting
        # user-owned themes; expose theme files read-only to all Flatpaks.
        mirrors_record = STATE / 'theme-mirrors.json'
        mirrors = json.loads(mirrors_record.read_text()) if mirrors_record.exists() else []
        for source in Path('/usr/share/themes').iterdir():
            if not (source/'gtk-3.0/gtk.css').is_file(): continue
            destination = HOME / '.themes' / source.name
            if destination.exists() and str(destination) not in mirrors: continue
            import filecmp
            for source_file in source.rglob('*'):
                if not source_file.is_file(): continue
                target_file = destination / source_file.relative_to(source)
                target_file.parent.mkdir(parents=True,exist_ok=True)
                if not target_file.exists() or not filecmp.cmp(source_file,target_file,shallow=False):
                    shutil.copy2(source_file,target_file)
            if str(destination) not in mirrors: mirrors.append(str(destination))
        mirrors_record.write_text(json.dumps(mirrors,indent=2))
        subprocess.run(['flatpak','override','--user','--talk-name='+REGISTRAR,
                        '--filesystem=~/.themes:ro','--filesystem=xdg-data/themes:ro'],check=True)
        data['installed']=target.read_text();record.write_text(json.dumps(data,indent=2))
        apps = output('flatpak', 'list', '--app', '--columns=application').splitlines()
        config = Path(__file__).with_name('appearance-config')
        if not config.exists(): config = Path(__file__).resolve().parents[1]/'config'
        appearance.apply(HOME, apps, config)
        gtk_folder = None
        for app in apps:
            try:
                cfg = configparser.ConfigParser(interpolation=None)
                cfg.read_string(output('flatpak', 'info', '--show-metadata', app))
                files = Path(output('flatpak', 'info', '--show-location', app)) / 'files'
                if app == 'org.mozilla.firefox':
                    status = 'dedicated Firefox adapter'
                elif qt_capable(cfg, files) or gtk3_capable(cfg, files):
                    target = HOME / '.local/share/flatpak/overrides' / app
                    record = STATE / ('flatpak-' + app + '.json')
                    data = json.loads(record.read_text()) if record.exists() else {
                        'id': app, 'before': target.read_text() if target.exists() else None}
                    qt = qt_capable(cfg, files)
                    menu_options = []
                    if not qt:
                        if gtk_folder is None: gtk_folder = gtk_menu.prepare(HOME)
                        menu_options = gtk_menu.options(app, gtk_folder)
                    subprocess.run(['flatpak', 'override', '--user',
                                    '--talk-name=' + REGISTRAR, '--socket=x11',
                                    '--nosocket=wayland',
                                    '--env=QT_QPA_PLATFORM=xcb' if qt else '--env=GDK_BACKEND=x11', *menu_options, app], check=True)
                    data['installed'] = target.read_text()
                    record.write_text(json.dumps(data, indent=2))
                    status = ('Qt Widgets' if qt else 'GTK3') + ': X11/menu permission configured; runtime menu needs verification'
                else:
                    status = 'shared GTK3/GTK4 controls and theme access installed; menu export depends on toolkit'
                report.append({'id': app, 'package': 'flatpak', 'status': status})
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError, ValueError, RuntimeError, configparser.Error) as e:
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
