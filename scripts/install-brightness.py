#!/usr/bin/python3
"""Install optional zero-capable brightness keys; preserve exact original bindings."""
from pathlib import Path
import json,sys,shlex
from gi.repository import Gio
root=Path(__file__).resolve().parents[1]
state=Path.home()/'.local/state/macbook-zorin/brightness.json'
script=Path.home()/'.local/bin/familiarmac-brightness.py'
s=Gio.Settings.new('org.gnome.settings-daemon.plugins.media-keys')
keys=['screen-brightness-down','screen-brightness-down-static']
paths=[f'/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/familiarmac-brightness-{d}/' for d in ('down',)]
def binding(path):return Gio.Settings.new_with_path('org.gnome.settings-daemon.plugins.media-keys.custom-keybinding',path)
if '--restore' in sys.argv:
    if not state.exists():raise SystemExit('No managed brightness keys installed.')
    saved=json.loads(state.read_text())
    for k in keys:
        if s.get_strv(k)!=[]:raise SystemExit('Native brightness binding changed; refusing automatic restore.')
    s.set_strv('custom-keybindings',[p for p in s.get_strv('custom-keybindings') if p not in paths])
    for k,v in saved['keys'].items():s.set_strv(k,v)
    for p in paths:
        for k in ['name','command','binding']:binding(p).reset(k)
    script.unlink(missing_ok=True);state.unlink();Gio.Settings.sync()
    print('Original brightness keys restored.');raise SystemExit(0)
if not Path('/sys/class/backlight/gmux_backlight').exists():raise SystemExit('gmux backlight required.')
if not all(s.is_writable(k) for k in keys):raise SystemExit('Brightness bindings are locked by system policy.')
if not state.exists():
    if script.exists() or any(p in s.get_strv('custom-keybindings') for p in paths):raise SystemExit('Unmanaged brightness configuration exists; refusing overwrite.')
    state.parent.mkdir(parents=True,exist_ok=True)
    state.write_text(json.dumps({'keys':{k:s.get_strv(k) for k in keys}},indent=2));state.chmod(0o600)
script.parent.mkdir(parents=True,exist_ok=True);script.write_bytes((root/'scripts/brightness.py').read_bytes())
for k in keys:s.set_strv(k,[])
for d,p in zip(('down',),paths):
    b=binding(p);b.set_string('name',f'FamiliarMac brightness {d}')
    b.set_string('command','/usr/bin/python3 '+shlex.quote(str(script))+' '+d)
    b.set_string('binding','XF86MonBrightness'+('Up' if d=='up' else 'Down'))
s.set_strv('custom-keybindings',list(dict.fromkeys(s.get_strv('custom-keybindings')+paths)))
Gio.Settings.sync()
print('Zero-capable brightness keys installed for the unlocked user session; no background service.')
