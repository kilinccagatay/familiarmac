#!/usr/bin/env python3
"""Build the portable release from tracked files, never from a user's home."""
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile
import sys
ROOT = Path(__file__).resolve().parents[1]
# Machine recovery scripts stay in the repository, never in distributable releases.
MANUAL = {'nve7-video-firmware.json','system.sh','visual-system.sh','wifi.sh','install-nve7-video-firmware.py',
 'install-early-kms.sh','install-framebuffer-handoff.sh','install-console-init.sh',
 'install-lean-initramfs.sh','install-firmware-timeout.sh','install-early-logo.sh',
 'install-grub-static-logo.sh','select-installed-kernel.sh','install-boot-trace.sh',
 'install-broadcom-return-sites.sh','install-broadcom-dkms-guard.sh',
 'install-boot.sh','install-brightness.py','mixxx-software-workaround.sh','install-login-layout.sh'}
def build(output):
    version=(ROOT/'VERSION').read_text().strip()
    if not re.fullmatch(r'\d+\.\d+\.\d+',version): raise ValueError('Invalid VERSION')
    output.mkdir(parents=True,exist_ok=True)
    name=f'familiarmac-{version}'
    archive=output/(name+'.tar.gz')
    files=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0')
    with tarfile.open(archive,'w:gz') as tar:
        for file in sorted(filter(None,files)):
            path=Path(file)
            if path.parts[0] in ('.github','tests') or path.name in MANUAL: continue
            if path.parts[0]=='docs' and path.suffix!='.md': continue
            if path.is_absolute() or '..' in path.parts: raise ValueError(file)
            source=ROOT/path
            if not source.is_file() or source.is_symlink(): raise ValueError(file)
            info=tar.gettarinfo(str(source),arcname=name+'/'+file)
            info.uid=info.gid=0;info.uname=info.gname='';info.mtime=0
            with source.open('rb') as stream: tar.addfile(info,stream)
        marker=json.dumps({'version':version,'portable':True,'logout_required':True}).encode()
        info=tarfile.TarInfo(name+'/RELEASE.json');info.size=len(marker);info.mode=0o644
        tar.addfile(info,io.BytesIO(marker))
    digest=hashlib.sha256(archive.read_bytes()).hexdigest()
    (output/'SHA256SUMS').write_text(f'{digest}  {archive.name}\n')
    print(archive)
if __name__=='__main__': build(Path(sys.argv[1] if len(sys.argv)>1 else 'dist'))
