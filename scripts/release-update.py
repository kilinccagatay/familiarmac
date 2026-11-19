#!/usr/bin/python3
"""User-scoped stable release updater. No hardware repair entry points."""
import argparse
import configparser
import io
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request
REPO='kilinccagatay/familiarmac'
STATE=Path(os.environ.get('XDG_STATE_HOME',Path.home()/'.local/state'))/'familiarmac/releases'
DATA=Path.home()/'.local/share/familiarmac/releases'
def read(path, default=None):
    try: return json.loads(path.read_text())
    except (OSError,ValueError): return default or {}
def save(path, data):
    path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    path.parent.chmod(0o700)
    with tempfile.NamedTemporaryFile(mode='w',dir=path.parent,prefix='.'+path.name,delete=False) as stream:
        stream.write(json.dumps(data,indent=2)+'\n');tmp=Path(stream.name)
    tmp.replace(path)
def version(value):
    if not isinstance(value,str) or not re.fullmatch(r'\d+\.\d+\.\d+',value): raise ValueError('Invalid release version')
    return tuple(map(int,value.split('.')))
def fetch(url, limit, progress=None):
    request=urllib.request.Request(url,headers={'User-Agent':'FamiliarMac-Updater/1','Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(request,timeout=25) as response:
        total=int(response.headers.get('Content-Length',0));parts=[];size=0
        while True:
            chunk=response.read(min(262144,limit-size+1))
            if not chunk: break
            parts.append(chunk);size+=len(chunk)
            if size>limit: raise ValueError('Release download exceeds size limit')
            if progress: progress(size,total)
        body=b''.join(parts)
    if len(body)>limit: raise ValueError('Release download exceeds size limit')
    return body

def check(force=False):
    installed=read(STATE/'installed.json').get('version')
    cache=read(STATE/'available.json')
    if not force and cache.get('checked_at',0)>time.time()-21600:
        latest=cache.get('latest')
        if latest: cache['message']=f'Update available: {latest}' if not installed or version(latest)>version(installed) else 'You’re up to date.'
        return cache
    try:
        release=json.loads(fetch(f'https://api.github.com/repos/{REPO}/releases/latest',2_000_000))
        tag=release['tag_name']; latest=tag.removeprefix('v');version(latest)
        if tag!='v'+latest or release.get('draft') or release.get('prerelease'): raise ValueError('Not a stable release')
        required={f'familiarmac-{latest}.tar.gz','SHA256SUMS'}
        if not required.issubset({a['name'] for a in release['assets']}): raise ValueError('Release assets are not ready')
        result={'latest':latest,'checked_at':time.time(),'message':f'Update available: {latest}' if not installed or version(latest)>version(installed) else 'You’re up to date.'}
    except urllib.error.HTTPError as e:
        if e.code!=404: raise
        result={'checked_at':time.time(),'message':'No stable release has been published yet.'}
    save(STATE/'available.json',result)
    return result

def extract(archive, destination, expected):
    prefix=f'familiarmac-{expected}'
    with tarfile.open(archive,'r:gz') as tar:
        members=tar.getmembers()
        if len(members)>10000 or sum(m.size for m in members)>300_000_000: raise ValueError('Archive exceeds limits')
        for m in members:
            p=PurePosixPath(m.name)
            if p.is_absolute() or '..' in p.parts or not p.parts or p.parts[0]!=prefix or not (m.isfile() or m.isdir()):
                raise ValueError('Unsafe release archive member')
        tar.extractall(destination, members=members, filter='data')
    root=destination/prefix
    if (root/'VERSION').read_text().strip()!=expected or read(root/'RELEASE.json').get('portable') is not True:
        raise ValueError('Release metadata mismatch')
    return root

def register(root):
    v=(root/'VERSION').read_text().strip();version(v)
    destination=Path.home()/'.local/share/familiarmac/updater'
    destination.mkdir(parents=True,exist_ok=True)
    for file in ('release-update.py',):
        shutil.copy2(root/'scripts'/file,destination/file)
    save(STATE/'installed.json',{'version':v,'installed_at':time.time()})

def preserve_preferences(before, after):
    """Keep user preferences while retaining installed extension migrations."""
    previous=configparser.RawConfigParser();previous.read_string(before.decode())
    installed=configparser.RawConfigParser();installed.read_string(after.decode())
    section='org/gnome/shell'
    for key in ('enabled-extensions','disabled-extensions'):
        if installed.has_option(section,key):
            if not previous.has_section(section):previous.add_section(section)
            previous.set(section,key,installed.get(section,key))
    result=io.StringIO();previous.write(result,space_around_delimiters=False)
    return result.getvalue().encode()

def run_system_update(command, stream, progress):
    with subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          text=True, bufsize=1) as child:
        for line in child.stdout:
            stream.write(line);stream.flush()
            if line.startswith('FAMILIARMAC_STATUS\t'):
                progress(.75, line.split('\t',1)[1].strip())
        code=child.wait()
    if code: raise subprocess.CalledProcessError(code,command)

def install(expected, progress=lambda fraction,message:None):
    version(expected)
    progress(0,'Checking release…')
    STATE.mkdir(parents=True,exist_ok=True,mode=0o700)
    STATE.chmod(0o700)
    with (STATE/'update.lock').open('w') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: raise RuntimeError('Another update is already running')
        latest=check(True).get('latest')
        if latest!=expected: raise ValueError('Release changed; check for updates again')
        current=read(STATE/'installed.json').get('version')
        if current and version(expected)<=version(current): raise ValueError('This version is already installed')
        name=f'familiarmac-{expected}.tar.gz'
        base=f'https://github.com/{REPO}/releases/download/v{expected}/'
        sums=fetch(base+'SHA256SUMS',10000).decode().splitlines()
        hashes=[line.split()[0] for line in sums if len(line.split())==2 and line.split()[1]==name]
        if len(hashes)!=1 or not re.fullmatch('[0-9a-f]{64}',hashes[0]): raise ValueError('Invalid checksum file')
        DATA.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.download-',dir=DATA) as temp:
            temp=Path(temp);archive=temp/name;archive.write_bytes(fetch(base+name,150_000_000,lambda size,total:progress(.05+.6*min(size/total,1) if total else .05,f'Downloading… {size//1024} KB'+(f' / {total//1024} KB' if total else ''))))
            progress(.68,'Verifying package…')
            if hashlib.sha256(archive.read_bytes()).hexdigest()!=hashes[0]: raise ValueError('Package checksum mismatch')
            root=extract(archive,temp,expected)
            final=DATA/expected
            if final.exists(): shutil.rmtree(final)
            root.rename(final)
        # Preserve user preferences, including Dock ordering, dark mode and motion.
        snapshot=subprocess.check_output(['dconf','dump','/'])
        (STATE/'preferences-before-update.ini').write_bytes(snapshot)
        save(STATE/'transaction.json',{'version':expected,'status':'installing','previous':current})
        log=STATE/'install.log'
        restore=snapshot
        try:
            with log.open('w') as stream:
                progress(.75,'Installing shared themes — administrator authentication may be required…')
                run_system_update(['pkexec','bash',str(final/'scripts/update-portable-system.sh')],stream,progress)
                progress(.85,'Installing desktop update…')
                env=dict(os.environ,FAMILIARMAC_UPDATING='1')
                subprocess.run(['bash','install.sh','--desktop'],cwd=final,env=env,stdout=stream,stderr=subprocess.STDOUT,check=True)
            restore=preserve_preferences(snapshot,subprocess.check_output(['dconf','dump','/']))
        except Exception:
            save(STATE/'transaction.json',{'version':expected,'status':'failed','previous':current,'log':str(log)})
            raise RuntimeError(f'Update incomplete. Previous version retained. See {log}')
        finally:
            subprocess.run(['dconf','load','/'],input=restore,check=True)
        progress(.97,'Finishing installation…')
        register(final)
        save(STATE/'transaction.json',{'version':expected,'status':'complete','logout_required':True})
        progress(1,'Update installed.')
        return 'Update installed. Log out and log back in to apply the changes.'

def emit_progress(fraction,message):
    # Closing Settings must not interrupt an already confirmed installation.
    try: print(f'{fraction:.4f}\t{message}',flush=True)
    except BrokenPipeError:
        sys.stdout=open(os.devnull,'w')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');p.add_argument('--force',action='store_true');p.add_argument('--panel',action='store_true');p.add_argument('--progress',action='store_true');p.add_argument('--install');p.add_argument('--register',type=Path)
    a=p.parse_args()
    try:
        if a.register: register(a.register.resolve())
        elif a.install:
            progress=emit_progress if a.progress else (lambda *args:None)
            print(install(a.install,progress))
        else:
            result=check(a.force)
            if a.panel: print('FamiliarMac '+read(STATE/'installed.json').get('version','Development build'))
            print(result['message'])
            if a.panel:
                current=read(STATE/'installed.json').get('version');latest=result.get('latest')
                print(latest if latest and (not current or version(latest)>version(current)) else '')
    except Exception as e: print(('-1\t' if a.progress else '')+'Update check/install failed: '+str(e),flush=True);raise SystemExit(1)
