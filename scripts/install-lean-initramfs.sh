#!/usr/bin/env bash
# Optional fixed-hardware boot optimization; preserves the early KMS hook.
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
mode=${1:---check}
case "$mode" in --install|--restore|--check) ;; *) exit 2;; esac
hook=/etc/initramfs-tools/hooks/familiarmac-trim-gsp
state=/var/lib/macbook-zorin/lean-initramfs
kernel=$(uname -r)
image=/boot/initrd.img-$kernel
[[ $(cat /sys/class/dmi/id/product_name) == MacBookPro10,1 ]] || exit 1
[[ -f /etc/initramfs-tools/hooks/familiarmac-early-kms ]] || { echo 'Early KMS hook is required.'; exit 1; }
if [[ -f "$hook" ]] && ! grep -q 'FamiliarMac: omit modern GSP' "$hook"; then echo 'Unmanaged hook; refusing.'; exit 1; fi
if [[ $mode == --check ]]; then
  echo "Optional removal of Turing/Ampere GSP firmware from $image only. Root firmware and early KMS are retained."
  exit 0
fi
[[ $EUID == 0 ]] || { echo 'Administrative privileges required.'; exit 1; }
install -d -m700 "$state"
exec > "$state/last-install.log" 2>&1
if [[ $mode == --restore ]]; then
  [[ -f "$hook" ]] || exit 0
  mv "$hook" "$state/hook.removed"
  if ! update-initramfs -u -k "$kernel"; then
    mv "$state/hook.removed" "$hook"
    echo 'Rebuild failed; hook restored.'; exit 1
  fi
  exit 0
fi
[[ ! -f "$hook" ]] || { echo 'Already installed.'; exit 0; }
cp -p "$image" "$state/initrd.img-$kernel.before"
install -m755 config/initramfs/familiarmac-trim-gsp "$hook"
rollback() { rm -f "$hook"; cp -p "$state/initrd.img-$kernel.before" "$image"; }
if ! update-initramfs -u -k "$kernel"; then rollback; exit 1; fi
listing=$(mktemp)
if ! lsinitramfs "$image" > "$listing"; then rm "$listing"; rollback; exit 1; fi
if ! grep -Eq '/nouveau\.ko(\.|$)' "$listing" || ! grep -Eq '/apple-gmux\.ko(\.|$)' "$listing" || grep -Eq 'nvidia/(ga102|tu102)/gsp/gsp-.*\.bin' "$listing"; then
  rm "$listing"; rollback; echo 'Validation failed; original image restored.'; exit 1
fi
rm "$listing"
stat -c '%n: %s bytes' "$state/initrd.img-$kernel.before" "$image"
echo 'Lean image installed. Reboot timing and visual verification still required.'
