#!/usr/bin/env python3
"""Install a per-user GTK adapter without modifying Remmina or its profiles."""
import hashlib,json,pathlib,re,shlex,shutil,subprocess,sys
root=pathlib.Path(__file__).resolve().parent.parent
home=pathlib.Path.home();base=home/'.local/share/familiarmac/remmina'
manifest=base/'installed.json'
state=json.loads(manifest.read_text()) if manifest.exists() else {}
if '--restore' in sys.argv:
 for dest,r in state.items():
  p=pathlib.Path(dest)
  if p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()==r['sha']:
   if r['before'] is None:p.unlink()
   else:p.write_text(r['before'])
 # Retain the small module if a user-modified launcher still references it.
 if manifest.exists():manifest.unlink()
 sys.exit(0)
if not pathlib.Path('/usr/bin/remmina').exists() or not shutil.which('cc'):sys.exit(0)
desktop=home/'.local/share/applications/org.remmina.Remmina.desktop'
source=desktop if desktop.exists() else pathlib.Path('/usr/share/applications/org.remmina.Remmina.desktop')
if not source.exists():sys.exit(0)
wrapper=home/'.local/bin/familiarmac-remmina'
file_wrapper=home/'.local/bin/familiarmac-remmina-file'
for p in (desktop,wrapper,file_wrapper):
 r=state.get(str(p))
 if r and p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()!=r['sha']:
  raise SystemExit(f'Remmina integration: preserving modified launcher {p}')
base.mkdir(parents=True,exist_ok=True)
module=base/'fullscreen.so';tmp=base/'fullscreen.tmp.so'
subprocess.run(['cc','-shared','-fPIC','-O2','-Wall','-Wextra','-Werror',str(root/'native/remmina-fullscreen.c'),'-o',str(tmp)],check=True)
tmp.replace(module)
def write(p,text,executable=False):
 before=state[str(p)]['before'] if str(p) in state else (p.read_text() if p.exists() else None)
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
 if executable:p.chmod(0o755)
 state[str(p)]={'before':before,'sha':hashlib.sha256(text.encode()).hexdigest()}
text=source.read_text()
for dest,binary in [(wrapper,'/usr/bin/remmina'),(file_wrapper,'/usr/bin/remmina-file-wrapper')]:
 write(dest,'#!/bin/sh\nexport GTK_MODULES='+shlex.quote(str(module))+'${GTK_MODULES:+:$GTK_MODULES}\nexec '+shlex.quote(binary)+' "$@"\n',True)
text=re.sub(r'^Exec=(?:/usr/bin/)?remmina-file-wrapper(?=\s|$)',f'Exec={file_wrapper}',text,flags=re.M)
text=re.sub(r'^Exec=(?:/usr/bin/)?remmina(?=\s|$)',f'Exec={wrapper}',text,flags=re.M)
write(desktop,text)
manifest.write_text(json.dumps(state,indent=2)+'\n')
print('Remmina native fullscreen installed for the next Remmina process; profiles unchanged.')
