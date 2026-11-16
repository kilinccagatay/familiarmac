#!/usr/bin/env bash
# Optional MacBookPro10,1 early Nouveau initialization, before Plymouth starts.
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
mode=${1:---install}
case "$mode" in --install|--restore|--check) ;; *) echo 'Usage: install-early-kms.sh [--install|--restore|--check]' >&2; exit 2;; esac
hook=/etc/initramfs-tools/hooks/familiarmac-early-kms
marker='# FamiliarMac: early Nouveau before Plymouth'
kernel=$(uname -r)
image=/boot/initrd.img-$kernel
state=/var/lib/macbook-zorin/early-kms
if [[ -f "$hook" ]] && ! grep -Fxq "$marker" "$hook"; then echo 'Refusing to overwrite unmanaged hook.' >&2; exit 1; fi
if [[ "$mode" != --restore ]]; then
  [[ $(cat /sys/class/dmi/id/product_name) == MacBookPro10,1 && -d /sys/module/nouveau ]] || { echo 'Requires MacBookPro10,1 running Nouveau.' >&2; exit 1; }
  modinfo -k "$kernel" nouveau >/dev/null
  modinfo -k "$kernel" apple_gmux >/dev/null
fi
[[ -f "$image" ]] || { echo 'Current kernel initramfs not found.' >&2; exit 1; }
if [[ "$mode" == --check ]]; then echo "Will load apple_gmux then nouveau before Plymouth in $image. No live GPU switch."; exit 0; fi
[[ $EUID == 0 ]] || { echo 'Administrative privileges required.' >&2; exit 1; }
install -d -m700 "$state"
if [[ "$mode" == --restore ]]; then
  [[ -f "$hook" ]] || { echo 'Early KMS hook is not installed.'; exit 0; }
  cp -p "$hook" "$state/hook.before-restore"
  rm "$hook"
  if ! update-initramfs -u -k "$kernel"; then
    cp -p "$state/hook.before-restore" "$hook"
    echo 'Restore failed; hook reinstated. Existing backup is retained.' >&2; exit 1
  fi
  echo 'Early KMS removed for the current kernel. Other rebuilt kernels require update-initramfs -u -k all to remove it there too.'
  exit 0
fi
# Revert the previous failed experiment rather than stacking workarounds.
bash scripts/install-framebuffer-handoff.sh --restore
if [[ -f "$hook" ]]; then echo 'Early KMS already installed.'; exit 0; fi
cp -p "$image" "$state/initrd.img-$kernel.before"
install -d -m755 /etc/initramfs-tools/hooks
cat > "$hook" <<'HOOK'
#!/bin/sh
# FamiliarMac: early Nouveau before Plymouth
set -e
case "${1:-}" in prereqs) exit 0;; esac
. /usr/share/initramfs-tools/hook-functions
# initramfs /init loads /conf/modules before init-premount/plymouth.
force_load apple_gmux
force_load nouveau
HOOK
chmod 755 "$hook"
rollback() {
  rm -f "$hook"
  cp -p "$state/initrd.img-$kernel.before" "$image"
  echo 'Early KMS build failed; original initramfs restored.' >&2
}
if ! update-initramfs -u -k "$kernel"; then rollback; exit 1; fi
listing=$(mktemp)
if ! lsinitramfs "$image" > "$listing"; then rm "$listing"; rollback; exit 1; fi
if ! grep -Eq '/nouveau\.ko(\.|$)' "$listing" || ! grep -Eq '/apple-gmux\.ko(\.|$)' "$listing"; then
  rm "$listing"; rollback; exit 1
fi
rm "$listing"
echo 'Early Nouveau and gmux included. Reboot required; current session unchanged.'
