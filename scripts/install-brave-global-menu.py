#!/usr/bin/python3
"""Use Brave's native X11 D-Bus menu export; preserve the user profile."""
from pathlib import Path
import json,re,sys
src=Path('/usr/share/applications/brave-browser.desktop')
dest=Path.home()/'.local/share/applications/brave-browser.desktop'
state=Path.home()/'.local/state/macbook-zorin/brave-launcher.json'
state.parent.mkdir(parents=True,exist_ok=True)
if '--restore' in sys.argv:
    if not state.exists():raise SystemExit('No managed Brave launcher.')
    record=json.loads(state.read_text())
    if 'installed' not in record:raise SystemExit('Legacy backup: inspect and restore brave-launcher.json manually; no file overwritten.')
    if not dest.exists() or dest.read_text()!=record['installed']:raise SystemExit('Brave launcher changed; restore refused.')
    if record['original'] is None:dest.unlink()
    else:dest.write_text(record['original'])
    state.unlink();raise SystemExit(0)
if not src.exists() and not dest.exists():raise SystemExit('Brave is not installed.')
if not state.exists():state.write_text(json.dumps({'original':dest.read_text() if dest.exists() else None}))
text=dest.read_text() if dest.exists() else src.read_text()
text=re.sub(r'^(Exec=\S+)(?![^\n]*--ozone-platform=)(.*)$',r'\1 --ozone-platform=x11\2',text,flags=re.M)
record=json.loads(state.read_text());record['installed']=text;state.write_text(json.dumps(record))
dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(text)
print('Brave launcher uses X11 native menus; running browser unchanged.')
