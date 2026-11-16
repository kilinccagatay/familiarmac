#!/usr/bin/python3
"""Opt-in, sequential visual audit. Never kills applications or changes settings."""
import argparse
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


def available_memory_mb():
    for line in Path('/proc/meminfo').read_text().splitlines():
        if line.startswith('MemAvailable:'):
            return int(line.split()[1]) // 1024
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', action='store_true', help='Interactively launch one app at a time')
    parser.add_argument('--app', action='append', default=[], help='Desktop ID; repeat to select apps')
    parser.add_argument('--output', type=Path, help='Private report directory')
    parser.add_argument('--min-memory-mb', type=int, default=1800)
    args = parser.parse_args()
    from gi.repository import Gio
    apps = {a.get_id(): a for a in Gio.AppInfo.get_all() if a.should_show()}
    ids = args.app or sorted(apps, key=lambda i: (apps[i].get_name().casefold(), i))
    missing = set(ids) - apps.keys()
    if missing:
        parser.error('Unknown visible desktop IDs: ' + ', '.join(sorted(missing)))
    if not args.run:
        print(json.dumps([{'id': i, 'name': apps[i].get_name()} for i in ids], indent=2))
        return 0
    if not sys.stdin.isatty() or os.geteuid() == 0:
        parser.error('--run requires an interactive terminal as your desktop user')
    if not os.environ.get('DBUS_SESSION_BUS_ADDRESS'):
        parser.error('Run inside your desktop session')
    if args.min_memory_mb < 512:
        parser.error('Memory reserve must be at least 512 MiB')
    if not shutil.which('gtk-launch'):
        parser.error('gtk-launch is required (libgtk-3-bin)')
    output = args.output or Path.home()/'.local/state/familiarmac/audits'/datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    os.umask(0o077)
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    records = []
    print('Skip apps already open with unsaved work. Do not run updates, installers or disk operations.\n'
          'Close each test window normally before continuing. No process will be killed.\n'
          'Reports/screenshots are private; inspect them before sharing.')
    for index, app_id in enumerate(ids):
        app = apps[app_id]
        answer = input(f'\n{index+1}/{len(ids)} {app.get_name()} ({app_id}) — [Enter] launch, s skip, q stop: ').strip().lower()
        if answer == 'q': break
        if answer not in ('', 's'): break
        record = {'id': app_id, 'name': app.get_name(), 'status': 'skipped'}
        if answer != 's':
            if available_memory_mb() < args.min_memory_mb:
                print('Memory reserve reached; stopping before launching another app.')
                break
            with (output/f'{index:03d}.log').open('w') as log:
                launched = subprocess.run(['gtk-launch', app_id], stdout=log, stderr=log, timeout=30)
            record['launch_exit_code'] = launched.returncode
            if launched.returncode:
                record['status'] = 'launch-failed'
                print('Launcher failed; see the log. This is not a visual pass.')
            else:
                input('Wait for the window. Inspect buttons, spacing, light/dark appearance and exported menu. Enter when ready: ')
                if shutil.which('gnome-screenshot') and input('Save a full-screen PRIVATE screenshot? [y/N] ').lower() == 'y':
                    shot = output/f'{index:03d}.png'
                    result = subprocess.run(['gnome-screenshot', '-f', str(shot)], timeout=20)
                    if result.returncode == 0: record['screenshot'] = shot.name
                verdict = input('Visual result: p pass, f issue, u unverified: ').strip().lower()
                record['status'] = {'p': 'visual-pass', 'f': 'issue'}.get(verdict, 'unverified')
                record['notes'] = input('Notes (no personal data): ')
            records.append(record)
            (output/'results.json').write_text(json.dumps(records, indent=2))
            if input('Close the test app normally. Type closed to continue; anything else stops: ').strip() != 'closed':
                break
            continue
        records.append(record)
        (output/'results.json').write_text(json.dumps(records, indent=2))
    print(f'Report: {output}. A successful launch alone does not verify appearance or menus.')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (KeyboardInterrupt, EOFError):
        print('\nStopped. No application was force-closed.')
