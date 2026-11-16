#!/usr/bin/python3
"""Opt-in Mixxx software rendering for the audited Nouveau GT650M; no driver edits."""
import argparse
import json
from pathlib import Path
import subprocess

APP = 'org.mixxx.Mixxx'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--restore', action='store_true')
    args = parser.parse_args()
    home = Path.home()
    target = home/'.local/share/flatpak/overrides'/APP
    record = home/'.local/state/familiarmac/mixxx-software-workaround.json'
    if args.restore:
        if not record.exists(): return
        state = json.loads(record.read_text())
        if not target.exists() or target.read_text() != state['installed']:
            raise SystemExit('Overrides changed since installation; restore refused to protect newer settings.')
        if state['before'] is None: target.unlink()
        else: target.write_text(state['before'])
        record.unlink()
        print('Restored previous Mixxx overrides. Restart Mixxx.')
        return
    supported = False
    for device in Path('/sys/bus/pci/devices').iterdir():
        try:
            supported |= (device.joinpath('vendor').read_text().strip() == '0x10de'
                          and device.joinpath('device').read_text().strip() == '0x0fd5'
                          and device.joinpath('driver').resolve().name == 'nouveau')
        except OSError: pass
    if not supported:
        raise SystemExit('Not the audited Nouveau GT650M; no changes made.')
    subprocess.run(['flatpak','info',APP],check=True,stdout=subprocess.DEVNULL)
    before = target.read_text() if target.exists() else None
    if record.exists():
        state = json.loads(record.read_text())
        if before != state['installed']:
            raise SystemExit('Overrides changed since installation; inspect before reapplying.')
        print('Already installed.');return
    else: state = {'before': before}
    subprocess.run(['flatpak','override','--user','--env=LIBGL_ALWAYS_SOFTWARE=true',
                    '--env=GALLIUM_DRIVER=llvmpipe',APP],check=True)
    state['installed'] = target.read_text()
    record.parent.mkdir(parents=True,exist_ok=True)
    record.write_text(json.dumps(state,indent=2)+'\n')
    print('Mixxx-only workaround installed; restart Mixxx. This is not a Nouveau driver repair.')

if __name__ == '__main__': main()
