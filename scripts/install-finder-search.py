#!/usr/bin/env python3
"""Version-guarded Finder search/toolbar, without modifying Nautilus packages."""
import hashlib,json,pathlib,shlex,shutil,subprocess,sys,xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parent.parent
home=pathlib.Path.home();base=home/'.local/share/familiarmac/finder'
manifest=base/'installed.json'
if '--restore' in sys.argv:
 if manifest.exists():
  records=json.loads(manifest.read_text());wrapper=home/'.local/bin/familiarmac-finder';keep_shim=any(pathlib.Path(dest).exists() and hashlib.sha256(pathlib.Path(dest).read_bytes()).hexdigest()!=r['sha'] and str(wrapper) in pathlib.Path(dest).read_text() for dest,r in records.items() if pathlib.Path(dest)!=wrapper)
  for dest,record in json.loads(manifest.read_text()).items():
   p=pathlib.Path(dest)
   if p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()==record['sha']:
    if record['before'] is None:p.unlink()
    else:p.write_text(record['before'])
  if keep_shim:
   wrapper.write_text('#!/bin/sh\nexec /usr/bin/nautilus "$@"\n');wrapper.chmod(0o755)
  shutil.rmtree(base)
 sys.exit(0)
binary=pathlib.Path('/usr/bin/nautilus')
if not binary.exists():sys.exit(0)
version=subprocess.check_output([str(binary),'--version'],text=True)
if 'nautilus 46.' not in version:print('Finder integration: unsupported version; native Finder retained.');sys.exit(0)
if not shutil.which('cc'):print('Finder integration: compiler unavailable; native Finder retained.');sys.exit(0)
xml=subprocess.check_output(['gresource','extract',str(binary),'/org/gnome/nautilus/ui/nautilus-window.ui'])
tree=ET.fromstring(xml);split=tree.find('.//object[@id="split_view"]');toolbar=tree.find('.//object[@id="toolbar"]');app=tree.find('.//object[@id="app_button"]')
if split is None or toolbar is None or app is None:raise SystemExit('Unknown Finder template; unchanged')
# Keep all bound template objects. Move the existing toolbar above the split view.
parent=next(e for e in tree.iter() if split in list(e));parent.remove(split)
outer=ET.SubElement(parent,'object',{'class':'AdwToolbarView'})
old_child=next(e for e in split.iter() if toolbar in list(e));old_parent=next(e for e in split.iter() if old_child in list(e));old_parent.remove(old_child)
ET.SubElement(outer,'child',{'type':'top'}).append(toolbar)
ET.SubElement(outer,'property',{'name':'content'}).append(split)
sidebar=split.find('./property[@name="sidebar"]/object/child[@type="top"]/object')
ET.SubElement(sidebar,'property',name='visible').text='False'
base.mkdir(parents=True,exist_ok=True)
target=base/'finder-search.so';temp=base/'finder-search.tmp.so'
subprocess.run(['cc','-shared','-fPIC','-O2','-Wall','-Wextra','-Werror',str(ROOT/'native/finder-search.c'),'-o',str(temp),'-ldl','-Wl,-l:libgtk-4.so.1','-Wl,-l:libadwaita-1.so.0','-Wl,-l:libgio-2.0.so.0','-Wl,-l:libgobject-2.0.so.0','-Wl,-l:libglib-2.0.so.0'],check=True)
temp.replace(target)
ET.ElementTree(tree).write(base/'nautilus-window.ui',encoding='utf-8',xml_declaration=True)
# The remaining search entry is neutral about scope.
toolbar_tree=ET.fromstring(subprocess.check_output(['gresource','extract',str(binary),'/org/gnome/nautilus/ui/nautilus-toolbar.ui']))
button=toolbar_tree.find('.//object[@id="search_button"]')
button.find('./property[@name="tooltip_text"]').text='Search'
button.find('./property[@name="icon_name"]').text='edit-find-symbolic'
search=toolbar_tree.find('.//object[@id="search_container"]')
owner=next(e for e in toolbar_tree.iter() if search in list(e));owner.remove(search)
ET.SubElement(owner,'object',{'class':'GtkBox'})
stack=toolbar_tree.find('.//object[@id="toolbar_switcher"]');ET.SubElement(stack,'property',name='name').text='fm-finder-path-stack'
header=toolbar_tree.find('.//object[@class="AdwHeaderBar"]')
revealer=ET.SubElement(ET.SubElement(header,'child',{'type':'end'}),'object',{'class':'GtkRevealer'})
for key,value in [('transition-type','slide-left'),('transition-duration','180')]:ET.SubElement(revealer,'property',name=key).text=value
binding=ET.SubElement(revealer,'binding',name='reveal-child');lookup=ET.SubElement(binding,'lookup',name='search-visible');ET.SubElement(lookup,'lookup',name='window-slot').text='NautilusToolbar'
ET.SubElement(revealer,'property',name='child').append(search)
ET.SubElement(search,'property',name='width-request').text='220'
# Keep the path and search control independent; search expands beside its icon.
search_stack=toolbar_tree.find('.//object[@id="search_button_stack"]')
ET.SubElement(search_stack,'property',name='name').text='fm-finder-search-button'
old=next(e for e in toolbar_tree.iter() if search_stack in list(e));old.remove(search_stack)
old_parent=next(e for e in toolbar_tree.iter() if old in list(e));old_parent.remove(old)
ET.SubElement(header,'child',{'type':'end'}).append(search_stack)
ET.ElementTree(toolbar_tree).write(base/'nautilus-toolbar.ui',encoding='utf-8',xml_declaration=True)
schema=base/'schemas';schema.mkdir(exist_ok=True);shutil.copy2(ROOT/'config/org.familiarmac.finder.gschema.xml',schema)
shutil.copy2(ROOT/'config/org.familiarmac.fullscreen.gschema.xml',schema)
subprocess.run(['glib-compile-schemas',str(schema)],check=True)
sha=hashlib.sha256(binary.read_bytes()).hexdigest();wrapper=home/'.local/bin/familiarmac-finder'
q=shlex.quote
body=f'''#!/bin/sh
if [ "$(sha256sum /usr/bin/nautilus | cut -d ' ' -f1)" = {q(sha)} ]; then
 export FAMILIARMAC_FINDER_SCHEMAS={q(str(schema))}
 export FAMILIARMAC_FULLSCREEN_SCHEMAS={q(str(schema))}
 export LD_PRELOAD={q(str(target))}${{LD_PRELOAD:+:$LD_PRELOAD}}
 export G_RESOURCE_OVERLAYS="/org/gnome/nautilus/ui={base}${{G_RESOURCE_OVERLAYS:+:$G_RESOURCE_OVERLAYS}}"
fi
exec /usr/bin/nautilus "$@"
'''
state=json.loads(manifest.read_text()) if manifest.exists() else {}
def write(path,text,executable=False):
 path.parent.mkdir(parents=True,exist_ok=True)
 old=state.get(str(path));before=old['before'] if old else (path.read_text() if path.exists() else None)
 path.write_text(text)
 if executable:path.chmod(0o755)
 state[str(path)]={'before':before,'sha':hashlib.sha256(text.encode()).hexdigest()}
write(wrapper,body,True)
# D-Bus covers opening directories from other apps as well as the Dock.
write(home/'.local/share/dbus-1/services/org.gnome.Nautilus.service',f'[D-BUS Service]\nName=org.gnome.Nautilus\nExec={wrapper} --gapplication-service\n')
desktop=home/'.local/share/applications/org.gnome.Nautilus.desktop'
src=desktop.read_text() if desktop.exists() else pathlib.Path('/usr/share/applications/org.gnome.Nautilus.desktop').read_text()
import re
src=re.sub(r'^Exec=(?:/usr/bin/)?nautilus\b',f'Exec={wrapper}',src,flags=re.M)
write(desktop,src)
manifest.write_text(json.dumps(state,indent=2)+'\n')
print('Finder search and unified toolbar installed for the next Finder process.')
