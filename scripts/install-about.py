#!/usr/bin/env python3
"""User-scoped, binary-version-guarded About illustration; no package file edits."""
import hashlib, pathlib, shlex, shutil, subprocess, sys, xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parent.parent
home=pathlib.Path.home()
base=home/'.local/share/familiarmac/about'
if '--restore' in sys.argv:
 desktop=home/'.local/share/applications/org.gnome.Settings.desktop'
 if (base/'installed').exists():
  if (base/'desktop.before').exists(): shutil.copy2(base/'desktop.before',desktop)
  else: desktop.unlink(missing_ok=True)
  service=home/'.local/share/dbus-1/services/org.gnome.Settings.service'
  if (base/'service.before').exists(): shutil.copy2(base/'service.before',service)
  elif (base/'service-installed').exists(): service.unlink(missing_ok=True)
  (home/'.local/bin/familiarmac-settings').unlink(missing_ok=True)
  shutil.rmtree(base)
 raise SystemExit(0)
binary=pathlib.Path('/usr/bin/gnome-control-center')
resource='/org/gnome/control-center/system/about/cc-about-page.ui'
if not binary.exists(): raise SystemExit(0)
model=pathlib.Path('/sys/class/dmi/id/product_name').read_text().strip()
if model not in ('MacBookPro10,1','MacBookPro11,2','MacBookPro11,3'):
 print('A1398 illustration skipped on other hardware'); raise SystemExit(0)
xml=subprocess.check_output(['gresource','extract',str(binary),resource])
tree=ET.fromstring(xml)
logo=tree.find('.//object[@id="os_logo"]')
if logo is None or logo.get('class')!='GtkPicture': raise SystemExit('Unsupported About template; unchanged')
base.mkdir(parents=True,exist_ok=True)
shutil.copy2(ROOT/'assets/hardware/macbook-pro-a1398.svg',base/'device.svg')
# Keep the native bound object alive for setup_os_logo and dark-mode callbacks.
ET.SubElement(logo,'property',name='visible').text='False'
parent=next(e for e in tree.iter() if logo in list(e))
box=ET.Element('object',{'class':'GtkBox'})
parent.remove(logo);parent.append(box)
ET.SubElement(box,'child').append(logo)
picture=ET.SubElement(ET.SubElement(box,'child'),'object',{'class':'GtkPicture'})
for name,value in [('file',(base/'device.svg').as_uri()),('alternative-text','MacBook Pro A1398'),('can-shrink','True'),('content-fit','contain'),('hexpand','True')]:
 ET.SubElement(picture,'property',name=name).text=value
ET.ElementTree(tree).write(base/'cc-about-page.ui',encoding='utf-8',xml_declaration=True)
sha=hashlib.sha256(binary.read_bytes()).hexdigest()
wrapper=home/'.local/bin/familiarmac-settings'
wrapper.parent.mkdir(parents=True,exist_ok=True)
wrapper.write_text('#!/bin/sh\n'+f'if [ "$(sha256sum /usr/bin/gnome-control-center | cut -d " " -f1)" = {shlex.quote(sha)} ]; then\n'+f' export G_RESOURCE_OVERLAYS="/org/gnome/control-center/system/about={base}${{G_RESOURCE_OVERLAYS:+:$G_RESOURCE_OVERLAYS}}"\nfi\nexec /usr/bin/gnome-control-center "$@"\n')
wrapper.chmod(0o755)
desktop=home/'.local/share/applications/org.gnome.Settings.desktop'
desktop.parent.mkdir(parents=True,exist_ok=True)
backup=base/'desktop.before'
if not (base/'installed').exists():
 if desktop.exists(): shutil.copy2(desktop,backup)
 (base/'installed').touch()
s=(pathlib.Path('/usr/share/applications/org.gnome.Settings.desktop')).read_text()
s='\n'.join('Exec='+str(wrapper)+line[len('Exec=gnome-control-center'):] if line.startswith('Exec=gnome-control-center') else 'DBusActivatable=false' if line.startswith('DBusActivatable=') else line for line in s.splitlines())+'\n'
desktop.write_text(s)
service=home/'.local/share/dbus-1/services/org.gnome.Settings.service'
service.parent.mkdir(parents=True,exist_ok=True)
if not (base/'service-installed').exists():
 if service.exists(): shutil.copy2(service,base/'service.before')
 (base/'service-installed').touch()
service.write_text('[D-BUS Service]\nName=org.gnome.Settings\nExec='+str(wrapper)+'\n')
print('About illustration installed for the next Settings process; package files unchanged.')
