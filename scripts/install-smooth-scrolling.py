#!/usr/bin/python3
"""Enable Chromium scroll animation in launchers, without changing input settings."""
from pathlib import Path
import json,re,subprocess,sys
root=Path.home(); apps=root/'.local/share/applications'
state=root/'.local/state/macbook-zorin/smooth-scrolling.json'
flag='--enable-smooth-scrolling'
names=['brave-browser.desktop','chatgpt.desktop']
if '--restore' in sys.argv:
    records=json.loads(state.read_text())
    for name,record in records.items():
        p=apps/name
        if p.read_text()!=record['installed']:raise SystemExit(f'{name} changed; restore refused.')
    for name,record in records.items():
        p=apps/name
        if record['previous'] is None:p.unlink()
        else:p.write_text(record['previous'])
    state.unlink()
else:
    records=json.loads(state.read_text()) if state.exists() else {}
    apps.mkdir(parents=True,exist_ok=True)
    for name in names:
        p=apps/name
        if not p.exists() and not (Path('/usr/share/applications')/name).exists():continue
        previous=p.read_text() if p.exists() else None
        source=previous if previous is not None else (Path('/usr/share/applications')/name).read_text()
        def update(m):
            line=m[0]
            if flag in line:return line
            if '--disable-smooth-scrolling' in line:raise SystemExit('Explicit disable present; inspect before overriding.')
            return re.sub(r'^(Exec=(?:"[^"]+"|\S+))',r'\1 '+flag,line)
        result=re.sub(r'^Exec=.*$',update,source,flags=re.M)
        if name not in records:records[name]={'previous':previous,'installed':result}
        elif source not in [records[name]['installed'],result]:raise SystemExit(f'{name} changed; inspect before reinstall.')
        p.write_text(result)
    state.parent.mkdir(parents=True,exist_ok=True);state.write_text(json.dumps(records,indent=2))
subprocess.run(['update-desktop-database',str(apps)],check=True)
print('Scroll animation launch options updated. Running applications were not restarted.')
