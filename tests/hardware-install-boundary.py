#!/usr/bin/env python3
import subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
for mode in ('--desktop','--prepare-desktop'):
    out=subprocess.check_output(['bash','install.sh',mode,'--dry-run'],cwd=root,text=True)
    for forbidden in ('system.sh','visual-system.sh','install-login','initramfs','grub','firmware','wifi.sh','early-kms','modprobe','mixxx'):
        assert forbidden not in out,(mode,forbidden)
prepare=(root/'scripts/install-desktop-themes.sh').read_text()
assert '\nupdate-initramfs' not in prepare and '\nsystemctl' not in prepare
assert 'gdm-theme.gresource' not in prepare
full=(root/'scripts/system.sh').read_text()
assert 'MacBookPro10,1' in full
installer=(root/'install.sh').read_text()
for script in ('install-early-kms','install-nve7-video-firmware','install-grub-static-logo','select-installed-kernel','mixxx-software-workaround'):
    assert script not in installer
print('Portable installer dry runs exclude hardware, boot and login mutations PASS')
# Visual opt-in has its own root entry point and cannot fall through to full setup.
out=subprocess.check_output(['bash','install.sh','--system-appearance','--dry-run'],cwd=root,text=True)
assert 'sudo bash scripts/install-system-appearance.sh' in out
assert 'scripts/desktop.py' not in out and 'scripts/system.sh' not in out
appearance=(root/'scripts/install-system-appearance.sh').read_text()
for forbidden in ('scripts/system.sh', 'scripts/visual-system.sh', 'scripts/bootstrap.sh', '/etc/default/grub', '/etc/modprobe.d', '/etc/NetworkManager', 'scripts/wifi.sh', 'keyd'):
    assert forbidden not in appearance,forbidden
assert 'update-initramfs -u -k all' in appearance
assert 'build-login-layout.py' in appearance and 'node --input-type=module --check' in appearance
restore=(root/'restore.sh').read_text()
branch=restore.split('state="${XDG_STATE_HOME')[0]
assert '--system-appearance' in branch and 'install-system-appearance.sh --restore' in branch and 'exit 0' in branch
# Keep encrypted volume interaction callbacks despite the custom splash graphics.
plymouth=(root/'config/macbook.script').read_text()
for callback in ('SetDisplayPasswordFunction', 'SetDisplayQuestionFunction', 'SetDisplayMessageFunction'):
    assert callback in plymouth
print('Explicit boot/login layer, isolated rollback and Plymouth prompt callbacks PASS')
