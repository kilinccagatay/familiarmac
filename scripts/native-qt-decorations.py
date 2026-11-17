#!/usr/bin/python3
"""Native Qt Widgets/Quick launchers use compositor frames, like the Qt Flatpak adapter.
Detect ELF dependencies, never launch apps while scanning. Preserve explicit choices.
"""
from pathlib import Path
import configparser
import io
import json
import re
import shlex
import shutil
import subprocess
import sys
HOME=Path.home()
STATE=HOME/'.local/state/familiarmac/native-qt'

def parse(text):
    c=configparser.ConfigParser(interpolation=None,strict=False);c.optionxform=str;c.read_string(text);return c

def qt_major(command):
    try: args=shlex.split(command)
    except ValueError:return None
    if not args or any(x in command for x in ['QT_QPA_PLATFORM','-platform']):return None
    if Path(args[0]).name == 'env':
        args=args[1:]
        while args and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*=.*',args[0]):args=args[1:]
        if not args or args[0].startswith('-'):return None
    exe=shutil.which(args[0])
    if not exe:return None
    try:
        with open(exe,'rb') as f:
            if f.read(4)!=b'\x7fELF':return None
        data=subprocess.check_output(['readelf','-d',exe],text=True,stderr=subprocess.DEVNULL,timeout=3)
    except (OSError,subprocess.SubprocessError):return None
    match=re.search(r'NEEDED.*\[libQt([56])(?:Widgets|Quick)\.so',data)
    if not match:return None
    major=match[1]
    if not list(Path('/usr/lib').glob(f'*/qt{major}/plugins/platforms/libqxcb.so')):return None
    return major

def launcher_text(text):
    c=parse(text)
    for section in c.sections():
        if 'Exec' in c[section]:
            command=c[section]['Exec']
            if 'QT_QPA_PLATFORM' in command or '-platform' in command:
                raise ValueError('Explicit platform choice; leave unchanged')
            c[section]['Exec']='env QT_QPA_PLATFORM=xcb '+command
    stream=io.StringIO();c.write(stream,space_around_delimiters=False);return stream.getvalue()

def apply(dry=False):
    sources={}
    for folder in ['/usr/share/applications','/usr/local/share/applications']:
        for p in Path(folder).glob('*.desktop'):sources[p.name]=p
    report=[]
    for name,p in sorted(sources.items()):
        try:text=p.read_text();c=parse(text)
        except (OSError,UnicodeError,configparser.Error):continue
        if 'Desktop Entry' not in c:continue
        entry=c['Desktop Entry']
        if entry.get('Type')!='Application' or entry.get('Hidden','false').lower()=='true':continue
        # D-Bus activation bypasses Exec; do not override its behavior blindly.
        if entry.get('DBusActivatable','false').lower()=='true':continue
        target=HOME/'.local/share/applications'/name
        record=STATE/(name+'.json')
        saved=json.loads(record.read_text()) if record.exists() else None
        if saved and (not target.exists() or target.read_text()!=saved['installed']):
            report.append({'id':name,'status':'user-edited launcher retained'});continue
        if not saved and target.exists():continue
        if not qt_major(entry.get('Exec','')):continue
        try:after=launcher_text(text)
        except ValueError:continue
        report.append({'id':name,'status':'native Qt Widgets/Quick: XCB/system frame; custom frameless UI still needs app support'})
        if dry:continue
        data={'before':None,'installed':after}
        STATE.mkdir(parents=True,exist_ok=True)
        record.write_text(json.dumps(data,indent=2))
        target.parent.mkdir(parents=True,exist_ok=True)
        if not target.exists() or target.read_text()!=after:target.write_text(after)
    return report

def restore():
    records=list(STATE.glob('*.json'))
    for r in records:
        p=HOME/'.local/share/applications'/r.name[:-5];data=json.loads(r.read_text())
        if not p.exists() or p.read_text()!=data['installed']:raise RuntimeError('Edited launcher: '+str(p))
    for r in records:
        (HOME/'.local/share/applications'/r.name[:-5]).unlink();r.unlink()

if __name__=='__main__':
    if '--restore' in sys.argv:restore()
    else:print(json.dumps(apply('--dry-run' in sys.argv),indent=2))
