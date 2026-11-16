# Broadcom wrapper return-site repair

Observed on MacBookPro10,1, BCM4360 (14e4:43a0), Zorin package
6.30.223.271-29ubuntu1+zorin2 and kernel 7.0.0-43-generic.

The warning calls through proprietary getvar into open wrapper osl_strlen.
The wrapper jumps to __x86_return_thunk at text offset 0x181e41, but the old
module has no .return_sites. The vendor Makefile disables final objtool because
the opaque object cannot pass validation. With delayed objtool this also omits
metadata for compiled wrappers. Enable objtool on wl-objs before linking the
opaque object: the real build produces 220 return-site relocations including
0x181e41, plus retpoline metadata. No security mitigation is disabled.
CONFIG_X86_KERNEL_IBT is already unset; ibt=off is not a fix for this machine.

## Installation

Run sudo bash scripts/install-broadcom-return-sites.sh --install, followed by
sudo bash scripts/install-broadcom-dkms-guard.sh for update persistence.

The guard in /etc/dkms/broadcom-sta.conf survives package source replacement.
It wraps the vendor MAKE command and patches only the disposable DKMS copy of
the exact verified Makefile. Already-patched files are idempotent. Unknown or
upstream-updated source builds unchanged, but a resulting module with return
thunks and no metadata is rejected. Future kernel/API changes may therefore
require maintenance; this is not a universal update compatibility guarantee.
Unrelated administrator overrides are never replaced.

## Restore

Remove only the managed /etc/dkms/broadcom-sta.conf and
/usr/local/lib/familiarmac/broadcom-dkms-build, then run
sudo bash scripts/install-broadcom-return-sites.sh --restore.
Original source, signed module, DKMS kernel cache and initramfs are backed up
under /var/lib/macbook-zorin/broadcom-return-sites/<kernel>.
Restore is limited to the original tested kernel; review after upgrades.

## Validation

Separate build and installed signed module metadata verified. No wl unloading,
network switch, GRUB or graphics setting change. Existing early Nouveau hooks
remain in place. After manual reboot check journalctl -b -k and actual Wi-Fi.
Static verification does not establish runtime success or fix every limitation
of the proprietary blob.

Background sources:
- https://bugs.debian.org/cgi-bin/bugreport.cgi?bug=1099014
- https://sources.debian.org/patches/broadcom-sta/6.30.223.271-26/33-wl-Add-explanation-for-IBT-warnings-in-newer-kernels.patch/
- https://wireless.docs.kernel.org/en/latest/en/users/drivers/brcm80211.html

The generic upstream blob warning is distinct from the missing wrapper
metadata specifically verified in this installed build.
