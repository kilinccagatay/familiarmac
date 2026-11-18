#!/usr/bin/python3
from pathlib import Path
import json
import shutil
root=Path(__file__).resolve().parents[1]
base=Path.home()/'.local/share/familiarmac/update-migration'
base.mkdir(parents=True,exist_ok=True)
for name in ('update-session-migration.py','desktop_layout.py'):
    shutil.copy2(root/'scripts'/name,base/name)
(base/'pending.json').write_text(json.dumps({'version':(root/'VERSION').read_text().strip()}))
auto=Path.home()/'.config/autostart/familiarmac-update-migration.desktop'
auto.parent.mkdir(parents=True,exist_ok=True)
auto.write_text('[Desktop Entry]\nType=Application\nName=FamiliarMac update migration\nExec=/usr/bin/python3 "'+str(base/'update-session-migration.py')+'"\nNoDisplay=true\nX-GNOME-Autostart-enabled=true\n')
