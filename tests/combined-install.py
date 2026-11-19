#!/usr/bin/env python3
"""Exercise orchestration without executing any system or user mutation."""
import os, shutil, subprocess, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    base=Path(tmp); bin=base/'bin'; bin.mkdir()
    shutil.copy2(root/'install.sh',base/'install.sh')
    trace=base/'trace'
    stub='''#!/bin/sh
printf '%s %s\\n' "${0##*/}" "$*" >> "$TRACE"
if [ -n "$FAIL_ON" ]; then case "$*" in *"$FAIL_ON"*) exit 19;; esac; fi
'''
    for name in ('python3','sudo','sha256sum'):
        p=bin/name;p.write_text(stub);p.chmod(0o755)
    env=dict(os.environ,PATH=str(bin)+':'+os.environ['PATH'],TRACE=str(trace),FAIL_ON='')
    def run(*args,fail=''):
        trace.write_text('')
        result=subprocess.run(['bash','install.sh',*args],cwd=base,env=dict(env,FAIL_ON=fail),capture_output=True,text=True)
        return result,trace.read_text().splitlines()
    result,lines=run('--all');assert result.returncode==0,result.stderr
    expected=['python3 scripts/doctor.py --require prepare','sha256sum --check vendor/SHA256SUMS',
              'sudo bash scripts/bootstrap.sh','sudo bash scripts/install-desktop-themes.sh','sudo bash scripts/install-mouse-shortcuts.sh',
              'python3 scripts/doctor.py --require desktop','python3 scripts/desktop.py',
              'python3 scripts/install-rounded-corners.py','python3 scripts/install-apps.py',
              'python3 scripts/install-about.py','python3 scripts/install-finder-search.py','python3 scripts/install-remmina-fullscreen.py','python3 scripts/install-dock-icons.py',
              'python3 scripts/install-trash-drop.py','sudo bash scripts/install-system-appearance.sh',
              'python3 scripts/release-update.py --register '+str(base)]
    assert lines==expected,lines
    for failed in ('--require prepare','bootstrap.sh','--require desktop','scripts/desktop.py','install-system-appearance.sh'):
        result,lines=run('--all',fail=failed)
        assert result.returncode==19,(failed,result.stderr)
        assert failed in lines[-1],(failed,lines)
    for flag in ('--full','--desktop','--system-appearance','--wifi','--chatgpt','--brightness','--scroll','--input-preset'):
        for args in (('--all',flag),(flag,'--all')):
            result,lines=run(*args)
            assert result.returncode==2 and not lines,(args,lines,result.stderr)
    result,lines=run('--all','--dry-run');assert result.returncode==0 and not lines
    shutil.copy2(root/'restore.sh',base/'restore.sh')
    home=base/'home'; home.mkdir()
    state=home/'.local/state/macbook-zorin';state.mkdir(parents=True)
    (state/'desktop.json').write_text('{}')
    trace.write_text('')
    result=subprocess.run(['bash','restore.sh','--all'],cwd=base,
                          env=dict(env,HOME=str(home),XDG_STATE_HOME=str(home/'.local/state')),
                          capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    assert trace.read_text().splitlines()==[
        'sudo bash scripts/install-system-appearance.sh --restore',
        'python3 scripts/install-remmina-fullscreen.py --restore',
        'python3 scripts/install-finder-search.py --restore',
        'python3 scripts/desktop.py restore'],trace.read_text()
print('Combined installer stage order, failure boundaries and hardware-option rejection PASS')
