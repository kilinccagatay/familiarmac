#!/usr/bin/env python3
"""Exercise the public entry point without touching the desktop."""
import subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def plan(*args):
    return subprocess.check_output(['bash',str(root/'install.sh'),*args,'--dry-run'],text=True,cwd=root)
p=plan('--full')
assert 'scripts/system.sh' in p and 'install-login-layout.sh' in p and 'install-rounded-corners.py' in p
assert 'MACBOOK_INPUT_PRESET=0' in p
assert 'scripts/wifi.sh' not in p and 'install-scroll-speed.sh' not in p and 'chatgpt-global-menu.sh' not in p
p=plan('--desktop','--scroll','--brave','--smooth')
assert 'sudo' not in p and 'install-scroll-speed.sh' in p
assert p.index('install-brave-global-menu.py')<p.index('install-smooth-scrolling.py')
r=subprocess.run(['bash',str(root/'install.sh'),'--unknown'],capture_output=True)
assert r.returncode!=0
print('Installer dry-run: complete component order, opt-in input/Wi-Fi/apps, unknown flag rejection PASS')
