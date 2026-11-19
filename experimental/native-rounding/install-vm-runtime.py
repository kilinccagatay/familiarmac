#!/usr/bin/env python3
"""Install staged runtime in the disposable familiarmac-vm only, as root."""
from pathlib import Path
import os
import shutil
import socket
import subprocess

if socket.gethostname() != 'familiarmac-vm' or os.geteuid() != 0:
    raise SystemExit('Refusing: this experiment is restricted to root in familiarmac-vm')
base=Path('/home/tester/native-rounding')
stage=base/'stage'
backup=base/'system-backup'
for src in stage.rglob('*'):
    if src.is_symlink() or not src.is_file():continue
    if not ('.so' in src.name or src.suffix=='.typelib'):continue
    relative=src.relative_to(stage)
    # Standalone Mutter test plugin is not used by GNOME Shell.
    if 'plugins' in relative.parts:continue
    dst=Path('/')/relative
    if not dst.is_file():raise SystemExit(f'Missing original runtime: {dst}')
    old=backup/relative
    old.parent.mkdir(parents=True,exist_ok=True)
    if not old.exists():shutil.copy2(dst,old)
    temp=dst.with_name(dst.name+'.fm-new')
    shutil.copy2(src,temp)
    temp.replace(dst) # Never overwrite a library currently mmap-ed by GNOME.
subprocess.run(['ldconfig'],check=True)
print('VM runtime replaced; restart the VM session to load it.')
