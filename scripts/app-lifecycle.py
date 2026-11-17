#!/usr/bin/python3
"""Bounded, metadata-only retry of known adapters after profile creation/app exit.
No applications are started and no full toolkit scan runs from this timer.
"""
from pathlib import Path
import fcntl
import hashlib
import importlib.util
import json
import os
import subprocess

HOME = Path.home()
BASE = Path(__file__).resolve().parent
STATE = HOME/'.local/state/familiarmac'


def module(name):
    spec = importlib.util.spec_from_file_location(name, BASE/(name+'.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def active_processes():
    """Read executable/package identity only; never read command lines or environment."""
    executables, flatpaks = set(), set()
    for proc in Path('/proc').glob('[0-9]*'):
        try:
            if proc.stat().st_uid != os.getuid():
                continue
            executables.add(str((proc/'exe').readlink()))
            info = proc/'root/.flatpak-info'
            if info.is_file():
                import configparser
                cfg = configparser.ConfigParser()
                cfg.read(info)
                flatpaks.add(cfg.get('Application', 'name', fallback=''))
        except (OSError, ValueError):
            continue
    return executables, flatpaks


def signature(paths):
    """Store hashes of file metadata, not application data or account information."""
    values = []
    for path in sorted(set(paths)):
        try:
            s = path.stat()
            values.append((str(path), str(path.resolve()), s.st_mtime_ns, s.st_size))
        except FileNotFoundError:
            values.append((str(path), None))
    return hashlib.sha256(json.dumps(values).encode()).hexdigest()


def reconcile(previous, jobs):
    result = {}
    for key, probe, apply in jobs:
        try:
            sig, busy = probe()
            old = previous.get(key, {})
            if busy:
                result[key] = {'status': 'waiting-for-exit', 'observed': sig}
            elif old.get('applied') == sig:
                result[key] = old
            elif old.get('observed') != sig:
                result[key] = {'status': 'waiting-for-stable-profile', 'observed': sig}
            else:
                report = apply()
                after, busy = probe()
                result[key] = {'status': 'waiting-for-exit' if busy else 'checked',
                               'observed': after, 'report': report}
                deferred = isinstance(report, list) and any(
                    'concurrent' in row.get('status', '') or 'deferred' in row.get('status', '')
                    for row in report)
                if deferred:
                    result[key]['status'] = 'retry-needed'
                elif not busy:
                    result[key]['applied'] = after
        except Exception as error:
            # One malformed profile must not block the other applications.
            result[key] = {'status': 'retry-needed', 'error': type(error).__name__}
    return result


def jobs():
    editors = module('editor-decorations')
    snaps = module('snap-appearance')
    chromium = module('chromium-integrations')
    for desktop, flatpak, folder in editors.PROFILES:
        if not editors.installed(desktop, flatpak):
            continue
        base = HOME/'.var/app'/flatpak/'config' if flatpak else Path(os.environ.get('XDG_CONFIG_HOME', HOME/'.config'))
        profile = base/folder
        def probe(profile=profile, flatpak=flatpak, desktop=desktop):
            return signature([profile/'User/settings.json', BASE/'editor-decorations.py']), editors.running(profile, flatpak, desktop)
        yield desktop, probe, lambda desktop=desktop: editors.apply(only=desktop)
    theme = subprocess.run(['gsettings', 'get', 'org.gnome.desktop.interface', 'gtk-theme'], capture_output=True, text=True).stdout.strip()
    for profile in (HOME/'snap').glob('*/current'):
        if not profile.is_dir():
            continue
        name = profile.parent.name
        def probe(profile=profile, name=name):
            paths = [profile, BASE/'snap-appearance.py', profile/'.local/share/app.bluebubbles.BlueBubbles/shared_preferences.json']
            for gtk in ('gtk-3.0', 'gtk-4.0'):
                paths += [profile/'.config'/gtk/'gtk.css', HOME/'.config'/gtk/'gtk.css']
                paths += list((HOME/'.config'/gtk/'familiarmac-controls').glob('*.svg'))
            return signature(paths)+theme, snaps.running(name)
        yield 'snap:'+name, probe, lambda name=name: snaps.apply(only=name)
    for app, folder in chromium.APPS.items():
        base = HOME/'.var/app'/app/'config'/folder
        if not base.is_dir():
            continue
        def probe(base=base, app=app):
            _, running = active_processes()
            return signature([BASE/'chromium-integrations.py', *base.glob('*/Preferences')]), app in running or os.path.lexists(base/'SingletonLock')
        yield app, probe, lambda app=app: chromium.refresh(app)
    app = 'org.mozilla.firefox'
    config = HOME/'.var/app'/app/'config'
    parents = [config/'mozilla/firefox', HOME/'.var/app'/app/'.mozilla/firefox']
    if any((p/'profiles.ini').exists() for p in parents):
        def probe():
            _, running = active_processes()
            paths = [BASE/'firefox-global-menu.py']
            for p in parents:
                paths += [p/'profiles.ini', *p.glob('*/user.js')]
            return signature(paths), app in running
        def apply():
            subprocess.run(['/usr/bin/python3', str(BASE/'firefox-global-menu.py'), '--refresh'], check=True, timeout=30, stdout=subprocess.DEVNULL)
        yield app, probe, apply


def main():
    STATE.mkdir(parents=True, exist_ok=True)
    with (STATE/'integration.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        path = STATE/'app-lifecycle.json'
        try:
            previous = json.loads(path.read_text()) if path.exists() else {}
        except (ValueError, OSError):
            previous = {}
        result = reconcile(previous, jobs())
        if result != previous:
            tmp = path.with_suffix('.tmp')
            tmp.write_text(json.dumps(result, indent=2)+'\n')
            tmp.chmod(0o600)
            tmp.replace(path)


if __name__ == '__main__':
    main()
