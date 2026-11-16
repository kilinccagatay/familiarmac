#!/usr/bin/env python3
"""Opt-in UI typography; imports no fonts. Restore only the settings we changed."""
import argparse,json,subprocess
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--restore',action='store_true')
args=parser.parse_args()
state=Path.home()/'.local/state/familiarmac/typography-before.json'
keys=[('org.gnome.desktop.interface','font-name','SF Pro Text 10'),
      ('org.gnome.desktop.interface','document-font-name','SF Pro Text 11'),
      ('org.gnome.desktop.wm.preferences','titlebar-font','SF Pro Text Bold 10')]
if args.restore:
    for pair,value in json.loads(state.read_text()).items():
        schema,key=pair.split(':');subprocess.run(['gsettings','set',schema,key,value],check=True)
else:
    family=subprocess.check_output(['fc-match','SF Pro Text','--format=%{family}'],text=True)
    if 'SF Pro Text' not in family: raise SystemExit('Install your local SF Pro Text font first; no substitute applied.')
    state.parent.mkdir(parents=True,exist_ok=True)
    if not state.exists():
        state.write_text(json.dumps({s+':'+k:subprocess.check_output(['gsettings','get',s,k],text=True).strip() for s,k,v in keys},indent=2))
    for s,k,v in keys:subprocess.run(['gsettings','set',s,k,v],check=True)
