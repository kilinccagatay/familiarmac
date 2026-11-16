#!/usr/bin/python3
"""Version-checked, byte-size-preserving ASAR patch with updated integrity hashes.

prepare OUTPUT: no system changes. install OUTPUT: root, backup then atomic install.
restore: restores only if the current file still matches our installed hash.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import sys
import tempfile

APP=Path('/usr/lib/chatgpt/resources/app.asar')
STATE=Path('/var/lib/macbook-zorin/chatgpt-global-menu')
TARGET='.vite/build/early-bootstrap-226-2f6bd181558008cf.js'
PATCHES=[
    ('("win32"===process.platform||"linux"===process.platform)&&O.removeMenu()', 'require("/usr/local/lib/macbook-zorin/appmenu-bridge.cjs")(eZ,O)', 1),
]

def digest(path):
    with open(path,'rb') as f: return hashlib.file_digest(f,'sha256').hexdigest()
def read_entry(path):
    with open(path,'rb') as f:
        fields=struct.unpack('<4I',f.read(16))
        header=json.loads(f.read(fields[3]))
        entry=header
        for part in TARGET.split('/'): entry=entry['files'][part]
        base=8+fields[1]
        f.seek(base+int(entry['offset']))
        content=f.read(entry['size'])
    return fields,header,entry,base,content

mode=sys.argv[1]
if mode=='prepare':
    if os.geteuid()==0 and (STATE/'state.json').exists():
        installed=json.loads((STATE/'state.json').read_text())
        if digest(APP)==installed['patched']:
            print('Native menu patch already installed.');sys.exit(0)
    output=Path(sys.argv[2]); fields,header,entry,base,content=read_entry(APP)
    source=content.decode()
    for old,new,count in PATCHES:
        if source.count(old)!=count: raise SystemExit('App version/signature differs; refusing to patch.')
        assert len(new)<=len(old)
        source=source.replace(old,new.ljust(len(old)))
    patched=source.encode(); assert len(patched)==len(content)
    integrity=entry['integrity']; block=integrity['blockSize']
    assert integrity['hash']==hashlib.sha256(content).hexdigest()
    integrity['hash']=hashlib.sha256(patched).hexdigest()
    integrity['blocks']=[hashlib.sha256(patched[i:i+block]).hexdigest() for i in range(0,len(patched),block)]
    encoded=json.dumps(header,ensure_ascii=False,separators=(',',':')).encode()
    if len(encoded)!=fields[3]: raise SystemExit('Unexpected header size; refusing to patch.')
    shutil.copyfile(APP,output)
    with open(output,'r+b') as f:
        f.seek(16);f.write(encoded)
        f.seek(base+int(entry['offset']));f.write(patched)
    output.with_suffix('.js').write_bytes(patched)
    output.with_suffix('.json').write_text(json.dumps({'original':digest(APP),'patched':digest(output)},indent=2))
    assert read_entry(output)[4]==patched
    print('Prepared and integrity-checked native menu patch.')
elif mode=='install':
    assert os.geteuid()==0
    output=Path(sys.argv[2]); meta=json.loads(output.with_suffix('.json').read_text())
    if digest(APP)!=meta['original'] or digest(output)!=meta['patched']: raise SystemExit('Files changed; refusing install.')
    STATE.mkdir(parents=True,exist_ok=True)
    backup=STATE/'original.asar'
    if backup.exists() and digest(backup)!=meta['original']: raise SystemExit('Different backup exists; refusing overwrite.')
    if not backup.exists(): shutil.copy2(APP,backup)
    target=APP.with_suffix('.asar.macbook-new')
    shutil.copy2(output,target); target.chmod(0o644);os.chown(target,0,0)
    os.replace(target,APP)
    (STATE/'state.json').write_text(json.dumps(meta))
    print('Installed. Current application was not restarted.')
elif mode=='restore':
    assert os.geteuid()==0
    meta=json.loads((STATE/'state.json').read_text())
    if digest(APP)!=meta['patched']: raise SystemExit('App changed since patch; restore refused to protect a newer version.')
    target=APP.with_suffix('.asar.macbook-restore')
    shutil.copy2(STATE/'original.asar',target);os.replace(target,APP)
    (STATE/'state.json').rename(STATE/'restored-state.json')
    print('Original application restored. Restart the application.')
else:
    raise SystemExit('Use prepare OUTPUT, install OUTPUT, or restore')
