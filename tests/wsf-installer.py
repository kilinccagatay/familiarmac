#!/usr/bin/env python3
"""Real build in an isolated HOME; fake service commands, memory GSettings."""
from pathlib import Path
import os,subprocess,tempfile
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='fm-wsf-test-') as td:
 home=Path(td);bin=home/'bin';bin.mkdir()
 (bin/'gnome-shell').write_text('#!/bin/sh\necho "GNOME Shell 46.0"\n')
 (bin/'systemctl').write_text('#!/bin/sh\ncase "$*" in\n *ExecStart*) echo "{ path=/usr/bin/gnome-shell ; argv[]=/usr/bin/gnome-shell ; }";;\nesac\n')
 for p in bin.iterdir():p.chmod(0o755)
 env=dict(os.environ,HOME=str(home),XDG_CONFIG_HOME=str(home/'.config'),XDG_DATA_HOME=str(home/'.local/share'),XDG_STATE_HOME=str(home/'.local/state'),XDG_SESSION_TYPE='wayland',GSETTINGS_BACKEND='memory',PATH=str(bin)+':'+os.environ['PATH'])
 env.pop('LD_PRELOAD',None)
 cmd=['python3',str(root/'scripts/install-wsf.py')]
 subprocess.run(cmd,env=env,check=True,stdout=subprocess.DEVNULL)
 lib=home/'.local/lib/wayland-scroll-factor/libwsf_preload.so'
 drop=home/'.config/systemd/user/org.gnome.Shell@wayland.service.d/95-wsf.conf'
 assert lib.exists() and str(lib) in drop.read_text()
 subprocess.run(cmd,env=env,check=True,stdout=subprocess.DEVNULL)
 original=drop.read_text();drop.write_text(original+'# user edit\n')
 result=subprocess.run(cmd+['--restore'],env=env,capture_output=True)
 assert result.returncode!=0 and lib.exists()
 drop.write_text(original)
 subprocess.run(cmd+['--restore'],env=env,check=True,stdout=subprocess.DEVNULL)
 assert not drop.exists() and not lib.exists()
 assert not (home/'.config/systemd/user/org.gnome.Shell@wayland.service.d/90-macbook-scroll.conf').exists()
print('WSF isolated install, repeat install, edited-file protection and restore PASS')
