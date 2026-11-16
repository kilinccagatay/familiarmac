#!/usr/bin/python3
"""Event-driven application integration; a fingerprint suppresses self-write loops."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
HOME = Path.home()
BASE = Path(__file__).resolve().parent
catalog = BASE / 'app-integrations.json'
if not catalog.exists():
    catalog = BASE.parent / 'config/app-integrations.json'
roots = {'native': [Path('/usr/share/applications'), Path('/usr/local/share/applications'), HOME/'.local/share/applications'],
         'flatpak': [Path('/var/lib/flatpak/exports/share/applications'), HOME/'.local/share/flatpak/exports/share/applications']}


def fingerprint(entries):
    digest = hashlib.sha256(catalog.read_bytes())
    managed = {e['id'] + '.desktop' for e in entries}
    for name in ('app-integrations.py', 'toolkit-integrations.py', 'firefox-global-menu.py', 'install-brave-global-menu.py'):
        digest.update((BASE/name).read_bytes())
    for paths in roots.values():
        for root in paths:
            for p in sorted(root.glob('*.desktop')):
                if root == HOME/'.local/share/applications' and p.name in managed:
                    continue  # Our generated launchers must never trigger another write pass.
                try:
                    digest.update(str(p).encode())
                    digest.update(str(p.resolve()).encode())  # Flatpak deployment changed.
                    digest.update(str(p.stat().st_mtime_ns).encode())
                    digest.update(p.read_bytes())
                except FileNotFoundError:
                    continue  # Package manager is replacing a launcher; next event retries.
    return digest.hexdigest()


def main():
    entries = json.loads(catalog.read_text())
    cache = HOME/'.local/state/familiarmac/integration-fingerprint'
    signature = fingerprint(entries)
    if '--force' not in sys.argv and cache.exists() and cache.read_text() == signature:
        print('Application inventory unchanged; no repeated writes.')
        return 0
    failed = subprocess.run(['/usr/bin/python3', str(BASE/'toolkit-integrations.py')]).returncode != 0
    for entry in entries:
        if not any((root/(entry['id']+'.desktop')).is_file() for root in roots[entry['kind']]):
            continue
        adapter = BASE / entry['adapter']
        if adapter.parent != BASE or not adapter.is_file():
            raise ValueError('Invalid adapter path')
        if subprocess.run(['/usr/bin/python3', str(adapter)]).returncode:
            print(entry['id'] + ': adapter failed; other applications continue.', file=sys.stderr)
            failed = True
    if not failed:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(signature)
    return int(failed)


if __name__ == '__main__':
    sys.exit(main())
