#!/usr/bin/env python3
"""Read-only preflight; prints no usernames, network identities or secrets."""
import argparse, os, platform, shutil, subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--require',choices=['desktop','full']);args=p.parse_args()
osinfo={}
for line in Path('/etc/os-release').read_text().splitlines():
    if '=' in line:
        k,v=line.split('=',1);osinfo[k]=v.strip('"')
model=Path('/sys/class/dmi/id/product_name')
model=model.read_text().strip() if model.exists() else 'unknown'
try: version=subprocess.check_output(['gnome-shell','--version'],text=True).strip()
except (FileNotFoundError,subprocess.CalledProcessError):version='missing'
print('OS:',osinfo.get('PRETTY_NAME'));print('Desktop:',version)
print('Session:',os.environ.get('XDG_SESSION_TYPE','unknown'));print('Hardware:',model)
required=['python3','gnome-extensions','glib-compile-schemas','gresource','gcc','make','node','update-desktop-database']
missing=[x for x in required if not shutil.which(x)]
print('Missing tools:',', '.join(missing) or 'none')
errors=[]
if osinfo.get('ID')!='zorin' or osinfo.get('VERSION_ID','').split('.')[0]!='18':errors.append('Supported baseline: Zorin OS 18.x')
if not version.startswith('GNOME Shell 46.'):errors.append('Supported Shell: GNOME 46.x')
if os.environ.get('XDG_SESSION_TYPE')!='wayland':errors.append('Supported session: Wayland')
if args.require=='full' and model!='MacBookPro10,1':errors.append('Full hardware profile only supports MacBookPro10,1')
if args.require=='desktop':
    if missing:errors.append('Install missing dependencies: sudo bash scripts/bootstrap.sh')
    if not Path('/usr/share/themes/MacBook-WhiteSur-Dark').is_dir():errors.append('Desktop-only needs WhiteSur installed by a previous full install; see docs/INSTALL.md')
for e in errors:print('CHECK:',e)
if args.require and errors:raise SystemExit(1)
