#!/usr/bin/python3
"""Event-driven, capability-specific application integration dispatcher."""
from pathlib import Path
import json, subprocess, sys
HOME=Path.home()
BASE=Path(__file__).resolve().parent
catalog=BASE/'app-integrations.json'
if not catalog.exists():catalog=BASE.parent/'config/app-integrations.json'
roots={'native':[Path('/usr/share/applications')],
       'flatpak':[Path('/var/lib/flatpak/exports/share/applications'),HOME/'.local/share/flatpak/exports/share/applications']}
failed=False
for entry in json.loads(catalog.read_text()):
    if not any((root/(entry['id']+'.desktop')).is_file() for root in roots[entry['kind']]):continue
    adapter=BASE/entry['adapter']
    if adapter.parent!=BASE or not adapter.is_file():raise ValueError('Invalid adapter path')
    result=subprocess.run(['/usr/bin/python3',str(adapter)])
    if result.returncode:
        print(entry['id']+': adapter failed; other applications continue.',file=sys.stderr)
        failed=True
sys.exit(1 if failed else 0)
