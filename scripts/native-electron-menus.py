#!/usr/bin/python3
"""Enable native Electron menu export when the shipped executable supports it.

Inspect bytes only. Do not execute applications, inject libraries, or rewrite
explicit user backends. The host desktop remains Wayland; only these apps use X11.
"""
from pathlib import Path
import configparser
import io
import json
import mmap
import shlex
import shutil
import sys

HOME = Path.home()
STATE = HOME / '.local/state/familiarmac/native-electron'


def parse(text):
    cfg = configparser.ConfigParser(interpolation=None, strict=False)
    cfg.optionxform = str
    cfg.read_string(text)
    return cfg


def capable(command):
    try:
        argv = shlex.split(command)
    except ValueError:
        return False
    if not argv or any(x in command for x in ('--ozone-platform', 'OZONE_PLATFORM', 'GDK_BACKEND')):
        return False
    executable = shutil.which(argv[0])
    if not executable:
        return False
    binary = Path(executable).resolve()
    folder = binary.parent
    if not (folder/'chrome_100_percent.pak').is_file():
        return False
    if not ((folder/'resources/app.asar').is_file() or (folder/'resources/app/package.json').is_file()):
        return False
    try:
        with binary.open('rb') as stream:
            if stream.read(4) != b'\x7fELF':
                return False
            with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
                return all(data.find(token) >= 0 for token in
                           (b'Electron', b'com.canonical.AppMenu.Registrar', b'libdbusmenu-glib.so'))
    except (OSError, ValueError):
        return False


def launcher_text(text):
    cfg = parse(text)
    if cfg.get('Desktop Entry', 'DBusActivatable', fallback='false').lower() == 'true':
        raise ValueError('D-Bus activation bypasses the launcher')
    for section in cfg.sections():
        if 'Exec' not in cfg[section]:
            continue
        command = cfg[section]['Exec']
        if not capable(command):
            raise ValueError('Unverified executable or explicit backend')
        # Preserve the exact executable quoting, field codes and remaining arguments.
        import re
        first = re.match(r'\s*(?:"(?:\\.|[^"\\])*"|[^\s]+)', command)
        cfg[section]['Exec'] = command[:first.end()] + ' --ozone-platform=x11' + command[first.end():]
    stream = io.StringIO()
    cfg.write(stream, space_around_delimiters=False)
    return stream.getvalue()


def apply():
    report = []
    if not list(Path('/usr/lib').glob('*/libdbusmenu-glib.so*')):
        return report
    sources = {}
    for folder in ('/usr/share/applications', '/usr/local/share/applications'):
        sources.update((p.name, p) for p in Path(folder).glob('*.desktop'))
    for name, source in sorted(sources.items()):
        try:
            text = source.read_text()
            cfg = parse(text)
            if cfg.get('Desktop Entry', 'Type', fallback='') != 'Application':
                continue
            if not capable(cfg.get('Desktop Entry', 'Exec', fallback='')):
                continue
            target = HOME/'.local/share/applications'/name
            record = STATE/(name+'.json')
            saved = json.loads(record.read_text()) if record.exists() else None
            current = target.read_text() if target.exists() else None
            if target.is_symlink() or (saved and current != saved['installed']) or (not saved and current is not None):
                report.append({'id': name, 'status': 'user-owned launcher retained'})
                continue
            after = launcher_text(text)
            if current != after:
                STATE.mkdir(parents=True, exist_ok=True)
                record.write_text(json.dumps({'before': None, 'installed': after}))
                target.parent.mkdir(parents=True, exist_ok=True)
                tmp = target.with_suffix('.desktop.tmp')
                tmp.write_text(after)
                tmp.replace(target)
            report.append({'id': name, 'status': 'native Electron menu exporter: X11 launcher prepared; restart required'})
        except (OSError, ValueError, configparser.Error):
            continue
    return report


def restore():
    records = list(STATE.glob('*.json'))
    for record in records:
        target = HOME/'.local/share/applications'/record.name[:-5]
        if not target.exists() or target.read_text() != json.loads(record.read_text())['installed']:
            raise RuntimeError('Edited launcher: '+str(target))
    for record in records:
        (HOME/'.local/share/applications'/record.name[:-5]).unlink()
        record.unlink()


if __name__ == '__main__':
    restore() if '--restore' in sys.argv else print(json.dumps(apply(), indent=2))
