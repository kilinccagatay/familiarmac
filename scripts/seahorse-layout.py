#!/usr/bin/python3
"""Guarded Seahorse 43 split-header workaround; no keys/accounts are touched."""
from pathlib import Path
import configparser
import hashlib
import io
import json
import shlex
import subprocess
import sys
import xml.etree.ElementTree as ET

RESOURCE='/org/gnome/Seahorse/seahorse-key-manager.ui'


def patch_layout(source):
    root=ET.fromstring(source)
    template=root.find("template[@class='SeahorseKeyManager']")
    if template is None or template.get('parent') != 'SeahorseCatalog':
        raise ValueError('Unsupported Seahorse template')
    for name,kind in [('header','HdyLeaflet'),('content_box','HdyLeaflet'),('left_header','GtkHeaderBar'),('right_header','GtkHeaderBar')]:
        if root.find(f".//object[@id='{name}'][@class='{kind}']") is None:
            raise ValueError('Seahorse layout changed: '+name)
    width=template.find("property[@name='default-width']")
    if width is None or width.text != '600' or template.find("property[@name='width-request']") is not None:
        raise ValueError('Seahorse sizing changed; refusing stale workaround')
    width.text='810'
    ET.SubElement(template,'property',{'name':'width-request'}).text='740'
    return ET.tostring(root,encoding='unicode')


def main():
    home=Path.home();base=home/'.local/lib/familiarmac/seahorse-layout'
    state=home/'.local/state/familiarmac/seahorse-layout.json'
    target=home/'.local/share/applications/org.gnome.seahorse.Application.desktop'
    if '--restore' in sys.argv:
        if not state.exists():return
        data=json.loads(state.read_text())
        if not target.exists() or target.read_text()!=data['installed']:
            raise RuntimeError('Seahorse launcher changed externally; restore refused')
        if data['before'] is None:target.unlink()
        else:target.write_text(data['before'])
        state.unlink()
        return
    binary=Path('/usr/bin/seahorse');source=Path('/usr/share/applications/org.gnome.seahorse.Application.desktop')
    if not binary.exists() or not source.exists():return
    data=json.loads(state.read_text()) if state.exists() else {'before':None}
    if target.exists() and (not state.exists() or target.read_text()!=data['installed']):
        raise RuntimeError('Preserving externally owned Seahorse launcher')
    version=subprocess.check_output([str(binary),'--version'],text=True).strip()
    if version.splitlines()[0] != 'seahorse 43.0':
        if state.exists():
            # Disable the old launcher; the hash guard also protects the update gap.
            target.unlink();state.unlink()
        print('Seahorse version not audited; layout unchanged:',version)
        return
    patched=patch_layout(subprocess.check_output(['gresource','extract',str(binary),RESOURCE]))
    base.mkdir(parents=True,exist_ok=True)
    (base/'seahorse-key-manager.ui').write_text(patched)
    digest=hashlib.sha256(binary.read_bytes()).hexdigest()
    wrapper=base/'launch'
    wrapper.write_text('#!/bin/sh\n'+
        'if [ "$(sha256sum /usr/bin/seahorse | cut -d " " -f1)" = '+shlex.quote(digest)+' ]; then\n'+
        ' export G_RESOURCE_OVERLAYS='+shlex.quote('/org/gnome/Seahorse='+str(base))+'"${G_RESOURCE_OVERLAYS:+:$G_RESOURCE_OVERLAYS}"\nfi\nexec /usr/bin/seahorse "$@"\n')
    wrapper.chmod(0o755)
    cfg=configparser.ConfigParser(interpolation=None,strict=False);cfg.optionxform=str;cfg.read(source)
    for section in cfg.sections():
        command=cfg[section].get('Exec')
        if command:
            words=command.split(' ',1)
            if words[0] not in ('seahorse','/usr/bin/seahorse'):raise ValueError('Unexpected Seahorse launcher')
            cfg[section]['Exec']='"'+str(wrapper)+'"'+(' '+words[1] if len(words)>1 else '')
    cfg['Desktop Entry']['DBusActivatable']='false'
    out=io.StringIO();cfg.write(out,space_around_delimiters=False)
    data['installed']=out.getvalue();data['binary_sha256']=digest
    target.parent.mkdir(parents=True,exist_ok=True);target.write_text(data['installed'])
    state.parent.mkdir(parents=True,exist_ok=True);state.write_text(json.dumps(data,indent=2))


if __name__=='__main__':main()
