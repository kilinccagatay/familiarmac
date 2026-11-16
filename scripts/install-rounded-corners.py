#!/usr/bin/python3
"""Install pinned window rounding only; never apply input/desktop profiles."""
from pathlib import Path
import json, subprocess, zipfile, sys
from gi.repository import Gio, GLib
root=Path(__file__).resolve().parents[1]
uuid='rounded-window-corners@fxgn'
dest=Path.home()/'.local/share/gnome-shell/extensions'/uuid
state=Path.home()/'.local/state/macbook-zorin/rounded-corners.json'
if '--restore' in sys.argv:
    if not state.exists(): raise SystemExit('No managed rounding installation to restore.')
    source=Gio.SettingsSchemaSource.new_from_directory(str(dest/'schemas'),Gio.SettingsSchemaSource.get_default(),False)
    settings=Gio.Settings.new_full(source.lookup('org.gnome.shell.extensions.rounded-window-corners-reborn',False),None,None)
    for key,value in json.loads(state.read_text()).items():
        settings.set_value(key,GLib.Variant.parse(settings.get_value(key).get_type(),value,None,None))
    shell=Gio.Settings.new('org.gnome.shell')
    shell.set_strv('enabled-extensions',[x for x in shell.get_strv('enabled-extensions') if x!=uuid])
    Gio.Settings.sync()
    state.rename(state.with_suffix('.restored.json'))
    print('Rounding preferences restored; managed extension disabled, files retained.')
    raise SystemExit(0)
if not state.exists() and dest.exists():
    raise SystemExit('Existing independent installation found; refusing to overwrite.')
dest.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(root/'vendor/rounded-window-corners-v13.zip') as archive:
    archive.extractall(dest)
for override in (root/'overrides/rounded-window-corners').rglob('*.js'):
    target=dest/override.relative_to(root/'overrides/rounded-window-corners')
    target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(override.read_bytes())
subprocess.run(['glib-compile-schemas',str(dest/'schemas')],check=True)
source=Gio.SettingsSchemaSource.new_from_directory(str(dest/'schemas'),Gio.SettingsSchemaSource.get_default(),False)
s=Gio.Settings.new_full(source.lookup('org.gnome.shell.extensions.rounded-window-corners-reborn',False),None,None)
keys=['global-rounded-corner-settings','skip-libadwaita-app','skip-libhandy-app']
if not state.exists():
    state.parent.mkdir(parents=True,exist_ok=True)
    state.write_text(json.dumps({k:s.get_value(k).print_(True) for k in keys}))
# v13 resets settings on first enable unless its migration version is current.
s.set_uint('settings-version',7)
original=s.get_value(keys[0]);cfg={k:original.lookup_value(k,None) for k in original.unpack()};cfg['borderRadius']=GLib.Variant('u',12);cfg['smoothing']=GLib.Variant('d',0.2)
cfg['padding']=GLib.Variant('a{sv}',{edge:GLib.Variant('u',0) for edge in ['left','right','top','bottom']})
cfg['keepRoundedCorners']=GLib.Variant('a{sv}',{'maximized':GLib.Variant('b',True),'fullscreen':GLib.Variant('b',False)})
s.set_value(keys[0],GLib.Variant('a{sv}',cfg))
s.set_boolean('skip-libadwaita-app',False);s.set_boolean('skip-libhandy-app',False)
shell=Gio.Settings.new('org.gnome.shell');enabled=shell.get_strv('enabled-extensions')
if uuid not in enabled:shell.set_strv('enabled-extensions',enabled+[uuid])
Gio.Settings.sync()
print('12px rounded corners installed; maximized windows rounded; fullscreen remains square.')
