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
import mmap
from gi.repository import Gio, GLib

HOME = Path.home()
STATE = HOME / '.local/state/familiarmac/toolkits'
REGISTRAR = 'com.canonical.AppMenu.Registrar'
spec = importlib.util.spec_from_file_location('flatpak_appearance', Path(__file__).with_name('flatpak-appearance.py'))
appearance = importlib.util.module_from_spec(spec); spec.loader.exec_module(appearance)
spec = importlib.util.spec_from_file_location('flatpak_gtk3_menu', Path(__file__).with_name('flatpak-gtk3-menu.py'))
gtk_menu = importlib.util.module_from_spec(spec); spec.loader.exec_module(gtk_menu)
spec = importlib.util.spec_from_file_location('native_qt', Path(__file__).with_name('native-qt-decorations.py'))
native_qt = importlib.util.module_from_spec(spec); spec.loader.exec_module(native_qt)
spec = importlib.util.spec_from_file_location('native_electron', Path(__file__).with_name('native-electron-menus.py'))
native_electron = importlib.util.module_from_spec(spec); spec.loader.exec_module(native_electron)
spec = importlib.util.spec_from_file_location('editor_frames', Path(__file__).with_name('editor-decorations.py'))
editor_frames = importlib.util.module_from_spec(spec); spec.loader.exec_module(editor_frames)

spec = importlib.util.spec_from_file_location('snap_frames', Path(__file__).with_name('snap-appearance.py'))
snap_frames = importlib.util.module_from_spec(spec); spec.loader.exec_module(snap_frames)


def output(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL).strip()


def qt_capable(metadata, files):
    # Require a Qt Widgets library and an XCB platform plugin, not an app name.
    runtime = metadata.get('Application', 'runtime', fallback='')
    if runtime.startswith('org.kde.Platform/'):
        return True
    return (any(files.glob('lib/**/libQt*Widgets.so*')) and
            any(files.glob('lib/**/libqxcb.so')))


def electron_menu_capable(files):
    """Require an Electron payload and its native D-Bus menu exporter, not an ID.

    Do not run application code or infer support from Chromium assets alone.
    Libraries must already be supplied by the package; no cross-runtime injection.
    """
    if not any((files/'lib').glob('**/libdbusmenu-glib.so*')):
        return False
    for asset in files.rglob('chrome_100_percent.pak'):
        folder = asset.parent
        if not ((folder/'resources/app.asar').is_file() or
                (folder/'resources/app/package.json').is_file()):
            continue
        for binary in folder.iterdir():
            if not binary.is_file() or not binary.stat().st_mode & 0o111:
                continue
            with binary.open('rb') as stream:
                if stream.read(4) != b'\x7fELF': continue
                with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
                    if all(data.find(token) >= 0 for token in (
                            b'Electron', b'com.canonical.AppMenu.Registrar', b'libdbusmenu-glib.so')):
                        return True
    return False


def electron_launcher_text(text, app):
    """Preserve desktop field codes/actions; set the backend on the app argv."""
    result = []; count = 0
    for line in text.splitlines(keepends=True):
        if line.startswith('Exec='):
            if '--ozone-platform' in line:
                raise ValueError('Explicit Electron launch backend retained')
            tokens = shlex.split(line[5:])
            if not any(Path(t).name == 'flatpak' for t in tokens) or tokens.count(app) != 1:
                raise ValueError('Unsupported Electron desktop Exec')
            line, changed = re.subn(r'(?<= )'+re.escape(app)+r'(?=\s|$)',
                                   app+' --ozone-platform=x11', line, count=1)
            if changed != 1: raise ValueError('Unsupported Electron app argument')
            count += 1
        result.append(line)
    if not count: raise ValueError('Missing Electron desktop Exec')
    return ''.join(result)


def prepare_electron_launcher(app):
    dest = HOME/'.local/share/applications'/(app+'.desktop')
    record = STATE/('electron-launcher-'+app+'.json')
    roots = [HOME/'.local/share/flatpak/exports/share/applications',
             Path('/var/lib/flatpak/exports/share/applications')]
    source = next((root/(app+'.desktop') for root in roots if (root/(app+'.desktop')).is_file()), None)
    if source is None: raise ValueError('Missing exported Electron launcher')
    saved = json.loads(record.read_text()) if record.exists() else None
    current = dest.read_text() if dest.exists() else None
    if dest.is_symlink() or (saved and current != saved['installed']) or (not saved and current is not None):
        raise ValueError('User-owned Electron launcher retained')
    text = electron_launcher_text(source.read_text(), app)
    if current == text: return
    STATE.mkdir(parents=True, exist_ok=True)
    record.write_text(json.dumps({'before': saved['before'] if saved else current,
                                 'installed': text, 'path': str(dest)}))
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix('.desktop.tmp'); tmp.write_text(text); tmp.replace(dest)


def explicit_electron_backend(target, managed):
    if managed or not target.exists(): return False
    cfg = configparser.ConfigParser(interpolation=None)
    cfg.read(target)
    sockets = cfg.get('Context', 'sockets', fallback='').split(';')
    return ('wayland' in sockets or '!x11' in sockets or
            any(cfg.has_option('Environment', key) for key in
                ('ELECTRON_OZONE_PLATFORM_HINT', 'OZONE_PLATFORM', 'OZONE_PLATFORM_HINT')))


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
    for record in STATE.glob('electron-launcher-*.json'):
        saved = json.loads(record.read_text()); dest = Path(saved['path'])
        if not dest.exists() or dest.read_text() != saved['installed']:
            raise RuntimeError('Edited Electron launcher; restore refused')
        if saved['before'] is None: dest.unlink()
        else: dest.write_text(saved['before'])
        record.unlink()
    snap_frames.restore()
    native_qt.restore()
    native_electron.restore()
    editor_frames.restore()
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
    report = native_qt.apply() + native_electron.apply() + editor_frames.apply() + snap_frames.apply()
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
                electron = electron_menu_capable(files)
                if app == 'org.mozilla.firefox':
                    status = 'dedicated Firefox adapter'
                elif electron or qt_capable(cfg, files) or gtk3_capable(cfg, files):
                    target = HOME / '.local/share/flatpak/overrides' / app
                    record = STATE / ('flatpak-' + app + '.json')
                    if electron and explicit_electron_backend(target, record.exists()):
                        report.append({'id': app, 'package': 'flatpak', 'status': 'explicit Electron backend retained; review required'})
                        continue
                    data = json.loads(record.read_text()) if record.exists() else {
                        'id': app, 'before': target.read_text() if target.exists() else None}
                    if electron: prepare_electron_launcher(app)
                    qt = not electron and qt_capable(cfg, files)
                    menu_options = []
                    if not qt and not electron:
                        if gtk_folder is None: gtk_folder = gtk_menu.prepare(HOME)
                        menu_options = gtk_menu.options(app, gtk_folder)
                    backend_options = [] if electron else ['--env=QT_QPA_PLATFORM=xcb' if qt else '--env=GDK_BACKEND=x11']
                    subprocess.run(['flatpak', 'override', '--user',
                                    '--talk-name=' + REGISTRAR, '--socket=x11',
                                    '--nosocket=wayland',
                                    *backend_options, *menu_options, app], check=True)
                    data['installed'] = target.read_text()
                    record.write_text(json.dumps(data, indent=2))
                    status = ('Electron native D-Bus menu' if electron else 'Qt Widgets' if qt else 'GTK3') + ': X11/menu permission configured; runtime menu needs verification'
                else:
                    status = 'GTK appearance files supplied; toolkit/native-frame option not detected; review required'
                report.append({'id': app, 'package': 'flatpak', 'status': status})
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError, ValueError, RuntimeError, configparser.Error) as e:
                report.append({'id': app, 'package': 'flatpak', 'status': 'error: ' + str(e)})
    # Include every visible installed launcher, without launching user applications.
    for app in Gio.AppInfo.get_all():
        if not app.should_show() or not app.get_id():
            continue
        if any(r['id'].removesuffix('.desktop') == app.get_id().removesuffix('.desktop') for r in report):
            continue
        filename = app.get_filename() if hasattr(app, 'get_filename') else ''
        package = 'snap' if '/snapd/desktop/' in (filename or '') else 'desktop'
        report.append({'id': app.get_id(), 'package': package,
                       'status': 'no application-specific capability check; shared system configuration is not proof of support'})
    for row in report:
        # A configuration scan cannot certify running UI, exported menus or shortcuts.
        row['evidence'] = 'configuration-scan-only'
        row['visual_verification'] = 'not-performed-by-this-scanner'
        row['menu_and_shortcut_verification'] = 'not-performed-by-this-scanner'
        status = row['status']
        row['needs_review'] = any(term in status for term in (
            'review', 'not detected', 'no application-specific', 'deferred',
            'running;', 'retained', 'error:', 'needs app support'))
    (STATE / 'applications.json').write_text(json.dumps(report, indent=2))
    print('Toolkit integration prepared; inventory:', len(report), 'applications.')


if __name__ == '__main__':
    restore() if '--restore' in sys.argv else apply()
