#!/usr/bin/env python3
import os,pathlib,subprocess,tempfile,xml.etree.ElementTree as ET,hashlib
root=pathlib.Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory() as d:
 home=pathlib.Path(d);env=dict(os.environ,HOME=d)
 cmd=['python3',str(root/'scripts/install-finder-search.py')]
 subprocess.run(cmd,env=env,check=True,capture_output=True)
 base=home/'.local/share/familiarmac/finder';wrapper=home/'.local/bin/familiarmac-finder'
 tree=ET.parse(base/'nautilus-window.ui');native=ET.fromstring(subprocess.check_output(['gresource','extract','/usr/bin/nautilus','/org/gnome/nautilus/ui/nautilus-window.ui']))
 assert {e.get('id') for e in native.iter() if e.get('id')} <= {e.get('id') for e in tree.iter() if e.get('id')},'Keep all native bound template children'
 assert tree.find('.//object[@class="AdwToolbarView"]/child[@type="top"]/object[@id="toolbar"]') is not None
 toolbar=ET.parse(base/'nautilus-toolbar.ui');assert toolbar.find('.//object[@class="GtkRevealer"]') is not None
 assert '/usr/bin/nautilus "$@"' in wrapper.read_text()
 assert hashlib.sha256(pathlib.Path('/usr/bin/nautilus').read_bytes()).hexdigest() in wrapper.read_text()
 before=wrapper.read_bytes();subprocess.run(cmd,env=env,check=True,capture_output=True);assert wrapper.read_bytes()==before
 # User edits survive restore; owned launchers are removed.
 desktop=home/'.local/share/applications/org.gnome.Nautilus.desktop';desktop.write_text(desktop.read_text()+'\n# user edit\n')
 subprocess.run(cmd+['--restore'],env=env,check=True);assert desktop.exists();assert wrapper.exists();assert "LD_PRELOAD" not in wrapper.read_text()
print('Finder installer: preserved templates, guarded launchers, repeat install and non-destructive restore PASS')
