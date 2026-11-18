#!/usr/bin/env python3
"""Release validation and update failure boundaries, with no host mutations."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
from unittest.mock import patch
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('updater',root/'scripts/release-update.py');u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
def bundle(v='1.1.0',extra=None):
    stream=io.BytesIO()
    with tarfile.open(fileobj=stream,mode='w:gz') as tar:
        for name,body in [('VERSION',v.encode()),('RELEASE.json',b'{"portable":true}'),('install.sh',b'#!/bin/sh\nexit 0'),('scripts/release-update.py',b'#stub'),('scripts/release-update-ui.py',b'#stub')]:
            info=tarfile.TarInfo('familiarmac-'+v+'/'+name);info.size=len(body);tar.addfile(info,io.BytesIO(body))
        if extra: tar.addfile(extra,io.BytesIO(b''))
    return stream.getvalue()
with tempfile.TemporaryDirectory() as temp:
    temp=Path(temp);u.STATE=temp/'state';u.DATA=temp/'data'
    u.save(u.STATE/'installed.json',{'version':'1.0.0'})
    payload=bundle();digest=hashlib.sha256(payload).hexdigest()
    release={'tag_name':'v1.1.0','assets':[{'name':'familiarmac-1.1.0.tar.gz'},{'name':'SHA256SUMS'}]}
    def fetch(url,limit,progress=None):
        if url.endswith('/latest'): return json.dumps(release).encode()
        if url.endswith('SHA256SUMS'):return f'{digest}  familiarmac-1.1.0.tar.gz\n'.encode()
        return payload
    with patch.object(u,'fetch',side_effect=fetch):
        assert u.check(True)['message']=='Update available: 1.1.0'
        u.save(u.STATE/'installed.json',{'version':'1.1.0'});assert 'up to date' in u.check(True)['message']
        u.save(u.STATE/'installed.json',{'version':'1.0.0'})
        calls=[]
        def run(args,**kwargs):
            calls.append(args)
            if args[:2]==['bash','install.sh']:raise subprocess.CalledProcessError(1,args)
            return subprocess.CompletedProcess(args,0)
        with patch.object(u.subprocess,'check_output',return_value=b'[test]\nx=true\n'),patch.object(u.subprocess,'run',side_effect=run):
            try:u.install('1.1.0');raise AssertionError('Failure accepted')
            except RuntimeError:pass
        assert u.read(u.STATE/'installed.json')['version']=='1.0.0'
        assert u.read(u.STATE/'transaction.json')['status']=='failed'
        assert calls[-1]==['dconf','load','/']
        assert calls[0][0]=='pkexec' and calls[1]==['bash','install.sh','--desktop']
        with patch.object(u.subprocess,'check_output',return_value=b''),patch.object(u.subprocess,'run',return_value=subprocess.CompletedProcess([],0)),patch.object(u,'register') as register:
            u.install('1.1.0');register.assert_called_once_with(u.DATA/'1.1.0')
            assert u.read(u.STATE/'transaction.json')['logout_required'] is True
        bad=b'broken'
        def badfetch(url,limit,progress=None):return bad if url.endswith('.tar.gz') else fetch(url,limit)
        with patch.object(u,'fetch',side_effect=badfetch),patch.object(u.subprocess,'run') as run:
            try:u.install('1.1.0');raise AssertionError('Corrupt package accepted')
            except ValueError as e:assert 'checksum' in str(e)
            run.assert_not_called()
    for name,kind in [('familiarmac-1.1.0/../../escape',tarfile.REGTYPE),('/absolute',tarfile.REGTYPE),('familiarmac-1.1.0/link',tarfile.SYMTYPE)]:
        info=tarfile.TarInfo(name);info.type=kind;info.linkname='/tmp/elsewhere'
        path=temp/'bad.tar.gz';path.write_bytes(bundle(extra=info))
        try:u.extract(path,temp/'extract','1.1.0');raise AssertionError('Unsafe archive accepted')
        except ValueError:pass
    release['prerelease']=True
    with patch.object(u,'fetch',side_effect=fetch):
        try:u.check(True);raise AssertionError('Prerelease accepted')
        except ValueError:pass
    for value in ('1.0','../1.0.0','1.0.0;sh','1.0.0-beta'):
        try:u.version(value);raise AssertionError(value)
        except ValueError:pass
# Orchestration is deliberately independent from machine repairs.
system=(root/'scripts/update-portable-system.sh').read_text()
for forbidden in ('scripts/system.sh','wifi.sh','keyd','nvidia','modprobe','grub'):
    assert forbidden not in system,forbidden
assert '/var/lib/familiarmac/system-appearance/installed' in system
assert "['bash','install.sh','--desktop']" in (root/'scripts/release-update.py').read_text()
# Overlapping native/background and explicit checks must use distinct temp files.
with tempfile.TemporaryDirectory() as tmp:
    from concurrent.futures import ThreadPoolExecutor
    target=Path(tmp)/'available.json'
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda n:u.save(target,{'n':n}),range(150)))
    assert isinstance(u.read(target)['n'],int)
print('Release checks, checksum rejection, archive safety, install failure/version boundaries and portable update scope PASS')
# A successful upgrade preserves personal preferences but not retired extensions.
before=b"[org/gnome/shell]\nenabled-extensions=['legacy']\ndisabled-extensions=['new']\nfavorite-apps=['personal.desktop']\n\n[org/gnome/desktop/interface]\nenable-animations=false\n"
after=b"[org/gnome/shell]\nenabled-extensions=['new']\ndisabled-extensions=['legacy']\nfavorite-apps=['default.desktop']\n\n[org/gnome/desktop/interface]\nenable-animations=true\n"
merged=u.preserve_preferences(before,after).decode()
assert "enabled-extensions=['new']" in merged
assert "disabled-extensions=['legacy']" in merged
assert "favorite-apps=['personal.desktop']" in merged
assert 'enable-animations=false' in merged
print('Update retains extension migrations without resetting favorites or motion PASS')
