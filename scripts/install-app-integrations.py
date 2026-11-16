#!/usr/bin/python3
"""Install shared per-user adapters and event-only application watchers."""
from pathlib import Path
import shutil,subprocess,json,sys
root=Path(__file__).resolve().parents[1]
home=Path.home();dest=home/'.local/lib/familiarmac'
state=home/'.local/state/familiarmac'
state.mkdir(parents=True,exist_ok=True)
if '--restore' in sys.argv:
    subprocess.run(['systemctl','--user','disable','--now','familiarmac-app-integrations.path','familiarmac-app-integrations.service'],check=True)
    subprocess.run(['/usr/bin/python3',str(root/'scripts/chromium-integrations.py'),'--restore'],check=True)
    if (state/'toolkits/gtk.json').exists():
        subprocess.run(['/usr/bin/python3',str(root/'scripts/toolkit-integrations.py'),'--restore'],check=True)
    if (state/'firefox-menu/desktop.installed').exists():
        subprocess.run(['/usr/bin/python3',str(root/'scripts/firefox-global-menu.py'),'--restore'],check=True)
    module=state/'module-service.json'
    if module.exists() and not json.loads(module.read_text())['enabled']:
        subprocess.run(['systemctl','--user','disable','--now','appmenu-gtk-module.service'],check=True)
    (state/'integration-fingerprint').unlink(missing_ok=True)
    sys.exit()
module=state/'module-service.json'
if not module.exists():
    enabled=subprocess.run(['systemctl','--user','is-enabled','--quiet','appmenu-gtk-module.service']).returncode==0
    module.write_text(json.dumps({'enabled':enabled}))
dest.mkdir(parents=True,exist_ok=True)
for name in ('toolkit-integrations.py','app-integrations.py','firefox-global-menu.py','install-brave-global-menu.py','chromium-integrations.py','flatpak-appearance.py','flatpak-gtk3-menu.py','application-shortcuts.py'):
    shutil.copy2(root/'scripts'/name,dest/name)
appearance=dest/'appearance-config';appearance.mkdir(exist_ok=True)
for name in ('traffic-lights.css','headerbar-spacing.css','context-menu-spacing.css','fixed-traffic-lights.css'):
    shutil.copy2(root/'config'/name,appearance/name)
shutil.copytree(root/'config/familiarmac-controls',appearance/'familiarmac-controls',dirs_exist_ok=True)
shutil.copy2(root/'config/app-integrations.json',dest/'app-integrations.json')
unit=home/'.config/systemd/user';unit.mkdir(parents=True,exist_ok=True)
(unit/'familiarmac-app-integrations.service').write_text('[Unit]\nDescription=Apply supported FamiliarMac app integrations\n[Service]\nType=oneshot\nExecStart=/usr/bin/python3 "'+str(dest/'app-integrations.py')+'"\n[Install]\nWantedBy=default.target\n')
(unit/'familiarmac-app-integrations.path').write_text('[Unit]\nDescription=Watch application installation and update events\n[Path]\nPathChanged=/var/lib/dpkg/status\nPathChanged=/var/lib/flatpak/.changed\nPathChanged='+str(home/'.local/share/flatpak/.changed')+'\nPathChanged=/usr/share/applications\nPathChanged=/usr/local/share/applications\nPathChanged=/usr/share/themes\nPathChanged='+str(home/'.local/share/applications')+'\nPathChanged=/var/lib/flatpak/exports/share/applications\nPathChanged='+str(home/'.local/share/flatpak/exports/share/applications')+'\n[Install]\nWantedBy=default.target\n')
# Dispatcher ignores managed output launchers in its fingerprint to avoid feedback loops.
subprocess.run(['systemctl','--user','daemon-reload'],check=True)
subprocess.run(['systemctl','--user','enable','--now','familiarmac-app-integrations.path','familiarmac-app-integrations.service'],check=True)

subprocess.run(['systemctl','--user','add-wants','gnome-session.target','appmenu-gtk-module.service'],check=True)
subprocess.run(['systemctl','--user','start','appmenu-gtk-module.service'],check=True)
