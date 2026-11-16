#!/usr/bin/python3
"""Install shared per-user adapters and event-only application watchers."""
from pathlib import Path
import shutil,subprocess
root=Path(__file__).resolve().parents[1]
home=Path.home();dest=home/'.local/lib/familiarmac'
dest.mkdir(parents=True,exist_ok=True)
for name in ('app-integrations.py','firefox-global-menu.py','install-brave-global-menu.py'):
    shutil.copy2(root/'scripts'/name,dest/name)
shutil.copy2(root/'config/app-integrations.json',dest/'app-integrations.json')
unit=home/'.config/systemd/user';unit.mkdir(parents=True,exist_ok=True)
(unit/'familiarmac-app-integrations.service').write_text('[Unit]\nDescription=Apply supported FamiliarMac app integrations\n[Service]\nType=oneshot\nExecStart=/usr/bin/python3 "'+str(dest/'app-integrations.py')+'"\n[Install]\nWantedBy=default.target\n')
(unit/'familiarmac-app-integrations.path').write_text('[Unit]\nDescription=Watch application installation and update events\n[Path]\nPathChanged=/usr/share/applications\nPathChanged=/var/lib/flatpak/exports/share/applications\nPathChanged='+str(home/'.local/share/flatpak/exports/share/applications')+'\n[Install]\nWantedBy=default.target\n')
# Never watch our own ~/.local/share/applications writes: avoids feedback loops.
subprocess.run(['systemctl','--user','daemon-reload'],check=True)
subprocess.run(['systemctl','--user','enable','--now','familiarmac-app-integrations.path','familiarmac-app-integrations.service'],check=True)
