#!/usr/bin/env python3
"""Install verified video-only firmware; never install a driver or edit boot files."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parent.parent
EXPECTED = json.loads((ROOT / 'config/nve7-video-firmware.json').read_text())

def digest(data):
    return hashlib.sha256(data).hexdigest()

def verified_payload(source):
    result = {}
    for name, expected in EXPECTED.items():
        data = (source / name).read_bytes()  # extractor's relative symlinks are intentional
        if digest(data) != expected:
            raise ValueError(f'Unexpected firmware content: {name}')
        result[name] = data
    return result

def check_targets(destination, payload):
    for name, data in payload.items():
        target = destination / name
        if target.is_symlink() or (target.exists() and target.read_bytes() != data):
            raise ValueError(f'Refusing to replace existing firmware: {target}')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    payload = verified_payload(args.source)
    destination = Path('/lib/firmware/nouveau')
    check_targets(destination, payload)
    devices = list(Path('/sys/bus/pci/devices').glob('*'))
    compatible = any((p/'vendor').read_text().strip() == '0x10de' and
                     (p/'device').read_text().strip() == '0x0fd5' and
                     (p/'driver').resolve().name == 'nouveau' for p in devices)
    if not compatible:
        raise SystemExit('This targeted repair requires GK107M 10de:0fd5 with Nouveau.')
    if args.check:
        print('Verified 10 video firmware files; hardware matches; existing files preserved.')
        return
    if os.geteuid() != 0:
        raise SystemExit('System firmware installation requires administrator authorization.')
    state = Path('/var/lib/familiarmac/nve7-video-firmware.json')
    state.parent.mkdir(parents=True, exist_ok=True)
    destination.mkdir(parents=True, exist_ok=True)
    installed = json.loads(state.read_text()) if state.exists() else {}
    for name, data in payload.items():
        target = destination/name
        if target.exists():
            continue
        with tempfile.NamedTemporaryFile(dir=destination, delete=False) as tmp:
            tmp.write(data)
            tmp.flush()
            os.fchmod(tmp.fileno(), 0o644)
            os.fsync(tmp.fileno())
        os.replace(tmp.name, target)
        installed[name] = digest(data)
        state.write_text(json.dumps(installed, indent=2)+'\n')
    print('Video firmware installed. No modules reloaded; no boot or Wi-Fi settings changed.')

if __name__ == '__main__':
    main()
