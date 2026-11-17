#!/usr/bin/python3
"""Documented native window frame preferences; preserve JSONC and user edits."""
from pathlib import Path
import json
import os
import re
import sys
HOME=Path.home()
STATE=HOME/'.local/state/familiarmac/editor-decorations'
PROFILES=[('code.desktop',None,'Code'),('code-insiders.desktop',None,'Code - Insiders'),
          ('com.microsoft.VSCode.desktop',None,'Code'),
          ('com.microsoft.VSCodeInsiders.desktop',None,'Code - Insiders'),
          ('com.visualstudio.code.desktop','com.visualstudio.code','Code')]
KEY='window.titleBarStyle'

def tokens(text):
    """Tokenize JSONC without modifying strings, comments or whitespace."""
    pattern=re.compile(r'\s+|//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|[{}\[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null')
    result=[];pos=0
    while pos<len(text):
        m=pattern.match(text,pos)
        if not m:raise ValueError('Unrecognized JSONC token')
        v=m[0]
        if not v.isspace() and not v.startswith(('//','/*')):result.append((v,m.start(),m.end()))
        pos=m.end()
    # Validate stripped document, permitting JSONC trailing commas only.
    significant=''.join(t[0] for t in result)
    # Remove trailing comma tokens rather than regex over string contents.
    significant=''.join(t[0] for i,t in enumerate(result) if not (t[0]==',' and i+1<len(result) and result[i+1][0] in (']','}')))
    if not isinstance(json.loads(significant),dict):raise ValueError('Expected settings object')
    return result

def native_setting(text):
    if not text.strip():text='{}\n'
    ts=tokens(text);depth=0;matches=[]
    for i,(value,start,end) in enumerate(ts):
        if value in ('{','['):depth+=1
        elif value in ('}',']'):depth-=1
        elif depth==1 and value.startswith('"') and json.loads(value)==KEY and i+2<len(ts) and ts[i+1][0]==':':
            val,a,b=ts[i+2]
            if not val.startswith('"'):raise ValueError('Unexpected title bar setting type')
            matches.append((a,b))
    if len(matches)>1:raise ValueError('Duplicate title bar setting')
    if matches:
        a,b=matches[0];return text[:a]+'"native"'+text[b:]
    # Append after the final property, preserving trailing comments and commas.
    closing=ts[-1][1]
    separator='' if len(ts)==2 or ts[-2][0]==',' else ','
    if separator:
        index=ts[-2][2];text=text[:index]+','+text[index:];closing+=1
    return text[:closing]+'\n  "'+KEY+'": "native"\n'+text[closing:]

def installed(desktop, flatpak):
    roots=[HOME/'.local/share/applications',Path('/usr/share/applications'),Path('/usr/local/share/applications')]
    if flatpak: roots += [HOME/'.local/share/flatpak/exports/share/applications',Path('/var/lib/flatpak/exports/share/applications')]
    return any((p/desktop).is_file() for p in roots)

def running(profile, flatpak, desktop):
    if os.path.lexists(profile/'SingletonLock'): return True
    names = ('code-insiders',) if 'insiders' in desktop.lower() else ('code', 'code-oss')
    for proc in Path('/proc').glob('[0-9]*'):
        try:
            if proc.stat().st_uid != os.getuid(): continue
            if (proc/'exe').readlink().name in names: return True
        except OSError: continue
    return False

def apply(only=None):
    report=[]
    for desktop,flatpak,folder in PROFILES:
        if only is not None and desktop != only: continue
        roots=[HOME/'.local/share/applications',Path('/usr/share/applications'),Path('/usr/local/share/applications')]
        if flatpak:roots += [HOME/'.local/share/flatpak/exports/share/applications',Path('/var/lib/flatpak/exports/share/applications')]
        if not any((p/desktop).is_file() for p in roots):continue
        base=HOME/'.var/app'/flatpak/'config' if flatpak else Path(os.environ.get('XDG_CONFIG_HOME',HOME/'.config'))
        path=base/folder/'User/settings.json'
        if running(base/folder, flatpak, desktop):
            report.append({'id':desktop,'status':'running; preferences deferred until exit'});continue
        record=STATE/(desktop+'.json')
        before=path.read_text() if path.exists() else None
        saved=json.loads(record.read_text()) if record.exists() else None
        if saved and before!=saved['installed']:
            report.append({'id':desktop,'status':'later user edits preserved; native frame needs review'});continue
        try:after=native_setting(before or '{}\n')
        except (ValueError,json.JSONDecodeError):
            report.append({'id':desktop,'status':'settings need review; file untouched'});continue
        if before==after:
            report.append({'id':desktop,'status':'native frame already configured'});continue
        if path.is_symlink():
            report.append({'id':desktop,'status':'symlinked settings retained'});continue
        STATE.mkdir(parents=True,exist_ok=True)
        data={'path':str(path),'before':before,'installed':after} if saved is None else {**saved,'installed':after}
        path.parent.mkdir(parents=True,exist_ok=True)
        # Check again before replacement so concurrent editor writes are not lost.
        if running(base/folder, flatpak, desktop) or (path.read_text() if path.exists() else None)!=before:
            report.append({'id':desktop,'status':'concurrent edit; no replacement'});continue
        record.write_text(json.dumps(data,indent=2));record.chmod(0o600)
        tmp=path.with_name(path.name+'.familiarmac-tmp');tmp.write_text(after)
        tmp.chmod(path.stat().st_mode & 0o777 if path.exists() else 0o600);tmp.replace(path)
        report.append({'id':desktop,'status':'native frame configured; full restart and visual verification required'})
    return report

def restore():
    records=list(STATE.glob('*.json'))
    for r in records:
        data=json.loads(r.read_text());p=Path(data['path'])
        if running(p.parent.parent, None, r.name[:-5]): raise RuntimeError('Close editor before restoring settings')
        if not p.exists() or p.read_text()!=data['installed']:raise RuntimeError('Edited settings: '+str(p))
    for r in records:
        data=json.loads(r.read_text());p=Path(data['path'])
        if data['before'] is None:p.unlink()
        else:p.write_text(data['before'])
        r.unlink()

if __name__=='__main__':
    if '--restore' in sys.argv:restore()
    else:print(json.dumps(apply(),indent=2))
