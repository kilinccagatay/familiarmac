import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('gtk_menu','scripts/flatpak-gtk3-menu.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path('/home/test/.local/share/familiarmac/gtk3-menu')
env={'GTK_MODULES':'canberra-gtk-module:appmenu-gtk-module',
     'LD_LIBRARY_PATH':'/app/lib/audacity:/custom/lib',
     'XDG_DATA_DIRS':'/custom/share:/app/share:/usr/share'}
a=m.environment_options(p,env)
assert '--env=LD_LIBRARY_PATH='+str(p)+':/app/lib/audacity:/custom/lib' in a
assert '--env=GTK_MODULES=canberra-gtk-module:'+str(p)+'/libappmenu-gtk-module.so' in a
assert '--env=XDG_DATA_DIRS='+str(p)+'/share:/custom/share:/app/share:/usr/share' in a
second={arg[6:].split('=',1)[0]:arg.split('=',2)[2] for arg in a if arg.startswith('--env=')}
assert a==m.environment_options(p,second), 'repeat apply duplicates search paths'
assert not any('LD_PRELOAD' in arg for arg in a)
assert '--filesystem='+str(p)+':ro' in a
print('Flatpak GTK3 exporter: narrow read-only access, environment preservation and idempotency PASS')
