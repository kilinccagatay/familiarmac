#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
[[ $EUID == 0 && $(cat /sys/class/dmi/id/product_name) == MacBookPro10,1 ]] || exit 2
kernel=$(uname -r)
[[ $kernel == 6.17.0-20-generic ]] || { echo 'Requires the selected comparison kernel'; exit 2; }
state=/var/lib/macbook-zorin/console-init
hook=/etc/initramfs-tools/scripts/init-premount/00-familiarmac-console
# Upgrade the earlier erase-only experiment without touching GRUB or drivers.
if [[ ${1:-} == --repair || ${1:-} == --restore-repair ]]; then
 repair="$state/printable-trigger"
 if [[ ${1:-} == --restore-repair ]]; then
  [[ -f "$repair/hook.before" && -f "$repair/initrd.before" ]] || exit 2
  cp -p "$repair/hook.before" "$hook"
  cp -p "$repair/initrd.before" "/boot/initrd.img-$kernel"
  exit 0
 fi
 [[ -f "$hook" && ! -e "$repair" ]] || { echo 'Repair requires original hook and no prior repair backup'; exit 2; }
 install -d -m700 "$repair"
 cp -p "$hook" "$repair/hook.before"
 cp -p "/boot/initrd.img-$kernel" "$repair/initrd.before"
 repair_rollback() {
  cp -p "$repair/hook.before" "$hook"
  cp -p "$repair/initrd.before" "/boot/initrd.img-$kernel"
 }
 trap repair_rollback ERR
 install -m755 config/initramfs/00-familiarmac-console "$hook"
 update-initramfs -u -k "$kernel"
 trap - ERR
 echo 'Console trigger repaired; no live VT switch or restart.'
 exit 0
fi
if [[ ${1:-} == --restore ]]; then
 [[ -f "$state/initrd.before" ]] || exit 2
 rm -f "$hook" /etc/grub.d/09_familiarmac_quiet_kernel
 cp -p "$state/initrd.before" "/boot/initrd.img-$kernel"
 cp -p "$state/preference.before" /etc/default/grub.d/95-familiarmac-kernel.cfg
 update-grub
 exit 0
fi
[[ ! -e "$hook" && ! -e /etc/grub.d/09_familiarmac_quiet_kernel ]] || { echo 'Already installed; restore before repeating'; exit 2; }
install -d -m700 "$state"
cp -p "/boot/initrd.img-$kernel" "$state/initrd.before"
cp -p /boot/grub/grub.cfg "$state/grub.cfg.before"
cp -p /etc/default/grub.d/95-familiarmac-kernel.cfg "$state/preference.before"
rollback() {
 rm -f "$hook" /etc/grub.d/09_familiarmac_quiet_kernel
 cp -p "$state/initrd.before" "/boot/initrd.img-$kernel"
 cp -p "$state/grub.cfg.before" /boot/grub/grub.cfg
 cp -p "$state/preference.before" /etc/default/grub.d/95-familiarmac-kernel.cfg
}
trap rollback ERR
install -Dm755 config/initramfs/00-familiarmac-console "$hook"
install -Dm755 scripts/quiet-kernel-entry.py /usr/local/libexec/familiarmac-quiet-kernel
printf '#!/bin/sh\nexec /usr/local/libexec/familiarmac-quiet-kernel %s\n' "$kernel" > /etc/grub.d/09_familiarmac_quiet_kernel
chmod 755 /etc/grub.d/09_familiarmac_quiet_kernel
printf '# FamiliarMac: selected installed kernel\nGRUB_DEFAULT="familiarmac-quiet-kernel"\n' > /etc/default/grub.d/95-familiarmac-kernel.cfg
update-initramfs -u -k "$kernel"
update-grub
grub-script-check /boot/grub/grub.cfg
grep -q "menuentry .*familiarmac-quiet-kernel" /boot/grub/grub.cfg
trap - ERR
echo 'Console initialization and quiet selected-kernel entry installed; no restart.'
