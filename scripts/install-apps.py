#!/usr/bin/python3
"""Movable Apps launcher; use the existing desktop rollback journal."""
from pathlib import Path
import base64,json
from gi.repository import Gio
repo=Path(__file__).resolve().parents[1]
state_path=Path.home()/'.local/state/macbook-zorin/desktop.json'
state=json.loads(state_path.read_text()) if state_path.exists() else {'settings':{},'files':{}}
def save():
 state_path.parent.mkdir(parents=True,exist_ok=True);state_path.write_text(json.dumps(state,indent=2));state_path.chmod(0o600)
def write(path,text):
 key=str(path)
 if key not in state['files']:
  state['files'][key]={'base64':base64.b64encode(path.read_bytes()).decode()} if path.exists() else None;save()
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)
def set_value(schema,key,value):
 s=Gio.Settings.new(schema);identity=schema+'|'+key
 if identity not in state['settings']:
  old=s.get_user_value(key);state['settings'][identity]=old.print_(True) if old is not None else None;save()
 if isinstance(value,list):s.set_strv(key,value)
 else:s.set_boolean(key,value)
launcher=Path.home()/'.local/bin/familiarmac-apps'
write(launcher,(repo/'scripts/apps-launcher.sh').read_text());launcher.chmod(0o755)
write(Path.home()/'.local/share/applications/org.familiarmac.Apps.desktop',(repo/'config/applications/org.familiarmac.Apps.desktop').read_text().replace('FAMILIARMAC_LAUNCHER','"'+str(launcher)+'"'))
favorites=Gio.Settings.new('org.gnome.shell').get_strv('favorite-apps')
favorites=['org.gnome.Nautilus.desktop']+[x for x in favorites if x!='org.gnome.Nautilus.desktop']
if 'org.familiarmac.Apps.desktop' not in favorites:favorites.insert(1,'org.familiarmac.Apps.desktop')
set_value('org.gnome.shell','favorite-apps',favorites)
set_value('org.gnome.shell.extensions.zorin-dash','show-show-apps-button',False)
set_value('org.gnome.shell.extensions.zorin-dash','show-trash',True)
Gio.Settings.sync()
print('Finder first; Apps inserted only if absent, subsequent user ordering preserved.')
