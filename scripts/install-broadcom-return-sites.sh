#!/usr/bin/env bash
# Repair wrapper metadata, without processing the proprietary blob or unloading wl.
set -euo pipefail
mode=${1:---check}
case "$mode" in --check|--install|--restore) ;; *) exit 2;; esac
k=$(uname -r)
src=/usr/src/broadcom-sta-6.30.223.271/Makefile
state=/var/lib/macbook-zorin/broadcom-return-sites/$k
module=/lib/modules/$k/updates/dkms/wl.ko.zst
cache=/var/lib/dkms/broadcom-sta/6.30.223.271/$k
expected=f50bf08837501cca8ef60fc61fe2f8e7ce187d5cb0bd56e2da534bad7aae46ce
[[ "$k" == 7.0.0-43-generic ]] || { echo 'This tested repair is restricted to kernel 7.0.0-43-generic.'; exit 1; }
if [[ $mode == --check ]]; then
  echo 'Adds objtool metadata to open-source wl wrappers; does not unload wl or change graphics/GRUB.'
  exit 0
fi
[[ $EUID == 0 ]] || { echo 'Administrative privileges required.'; exit 1; }
restore() {
  cp -a "$state/Makefile" "$src"
  cp -a "$state/wl.ko.zst" "$module"
  cp -a "$state/initrd.img" "/boot/initrd.img-$k"
  rm -rf "$cache"
  cp -a "$state/dkms-kernel" "$cache"
  depmod "$k"
}
if [[ $mode == --restore ]]; then
  [[ -f "$state/complete-backup" ]] || exit 1
  restore
  rm -f "$state/installed"
  echo 'Original source, module, DKMS cache and initramfs restored. Restart manually.'
  exit 0
fi
[[ ! -f "$state/installed" ]] || { echo 'Already installed.'; exit 0; }
[[ $(sha256sum "$src" | cut -d' ' -f1) == "$expected" ]] || { echo 'Unknown source revision; refusing.'; exit 1; }
[[ -f "$module" && -d "$cache" && ! -e "$state/complete-backup" ]] || { echo 'Backup/state needs review.'; exit 1; }
install -d -m700 "$state"
exec > >(tee "$state/install.log") 2>&1
cp -a "$src" "$state/Makefile"
cp -a "$module" "$state/wl.ko.zst"
cp -a "/boot/initrd.img-$k" "$state/initrd.img"
cp -a "$cache" "$state/dkms-kernel"
touch "$state/complete-backup"
trap 'result=$?; trap - ERR; restore; exit "$result"' ERR
cat >> "$src" <<'PATCH'

# FamiliarMac: annotate compiled wrappers before linking the opaque blob.
$(addprefix $(obj)/,$(wl-objs)): override objtool-enabled = y
PATCH
dkms build -m broadcom-sta -v 6.30.223.271 -k "$k" --force
dkms install -m broadcom-sta -v 6.30.223.271 -k "$k" --force
zstd -dc "$module" > "$state/verified.ko"
readelf -SW "$state/verified.ko" > "$state/sections.txt"
grep -q ' .return_sites ' "$state/sections.txt"
[[ -n $(modinfo -F signer "$state/verified.ko") ]]
update-initramfs -u -k "$k"
rm "$state/verified.ko"
touch "$state/installed"
trap - ERR
echo 'Installed signed module with return-site metadata. No modules unloaded; restart manually to validate.'
