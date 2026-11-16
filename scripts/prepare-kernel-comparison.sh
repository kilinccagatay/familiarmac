#!/usr/bin/env bash
# Prepare an installed alternate kernel, without changing the running/default one.
set -euo pipefail
kernel=${1:?Usage: prepare-kernel-comparison.sh INSTALLED_KERNEL}
[[ $kernel =~ ^[0-9]+\.[0-9]+\.[0-9]+-[0-9]+-generic$ ]] || exit 2
[[ $EUID == 0 && $kernel != "$(uname -r)" ]] || exit 2
[[ $(cat /sys/class/dmi/id/product_name) == MacBookPro10,1 ]] || exit 2
[[ -f /boot/vmlinuz-$kernel && -f /boot/initrd.img-$kernel && -d /usr/src/linux-headers-$kernel ]] || exit 2
grep -q 'FamiliarMac: early Nouveau' /etc/initramfs-tools/hooks/familiarmac-early-kms
state=/var/lib/macbook-zorin/kernel-comparison/$kernel
install -d -m700 "$state"
exec > >(tee "$state/prepare.log") 2>&1
[[ -f "$state/initrd.before" ]] || cp -p "/boot/initrd.img-$kernel" "$state/initrd.before"
# Build only for the alternate kernel. Preserve the working current wl module.
dkms install -m broadcom-sta -v 6.30.223.271 -k "$kernel"
modinfo -k "$kernel" wl > "$state/wl.txt"
if ! update-initramfs -u -k "$kernel"; then
    cp -p "$state/initrd.before" "/boot/initrd.img-$kernel"; exit 1
fi
lsinitramfs "/boot/initrd.img-$kernel" > "$state/initrd-list.txt"
for module in nouveau apple-gmux; do
    grep -Eq "/$module\\.ko(\\.|$)" "$state/initrd-list.txt" || { cp -p "$state/initrd.before" "/boot/initrd.img-$kernel"; exit 1; }
done
# Read menu identifiers; don't change the default or schedule a reboot here.
grep -E 'submenu |menuentry ' /boot/grub/grub.cfg > "$state/menu-entries.txt"
echo 'Comparison kernel prepared. Current kernel, default boot and running services unchanged.'
