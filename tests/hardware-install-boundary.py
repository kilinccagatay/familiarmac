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
