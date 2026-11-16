#!/bin/bash
# Optional static GRUB background; no delay, fake progress or driver changes.
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
mode=${1:---install}
case "$mode" in --install|--restore) ;; *) echo 'Usage: install-early-logo.sh [--install|--restore]' >&2; exit 2;; esac
[[ $EUID == 0 ]] || { echo 'Administrative privileges required.' >&2; exit 1; }
config=/etc/default/grub.d/97-familiarmac-early-logo.cfg
image=/boot/grub/familiarmac-early-logo.png
state=/var/lib/macbook-zorin/early-logo
marker='# FamiliarMac: static early boot logo'
if [[ -e "$config" ]] && ! grep -Fxq "$marker" "$config"; then echo 'Unmanaged configuration; refusing overwrite.' >&2; exit 1; fi
install -d -m700 "$state"
[[ -e "$state/grub.cfg.before" ]] || cp -p /boot/grub/grub.cfg "$state/grub.cfg.before"
# Preserve the current working generated configuration for transactional rollback.
cp -p /boot/grub/grub.cfg "$state/grub.cfg.transaction"
for file in "$config" "$image"; do
  name=$(basename "$file")
  rm -f "$state/$name.transaction"
  if [[ -e "$file" ]]; then cp -p "$file" "$state/$name.transaction"; fi
done
rollback() {
  cp -p "$state/grub.cfg.transaction" /boot/grub/grub.cfg
  for file in "$config" "$image"; do
    name=$(basename "$file")
    if [[ -e "$state/$name.transaction" ]]; then cp -p "$state/$name.transaction" "$file"; else rm -f "$file"; fi
  done
}
trap rollback ERR
if [[ "$mode" == --restore ]]; then
  rm -f "$config" "$image"
else
  install -d -m755 /etc/default/grub.d
  /usr/bin/python3 scripts/render-grub-background.py "$image"
  chmod 644 "$image"
  cat > "$config" <<'CONFIG'
# FamiliarMac: static early boot logo
# Disable the menu theme so GRUB_BACKGROUND is drawn on gfxterm.
# Keep existing timeout, video mode and kernel handoff configuration.
GRUB_THEME=""
GRUB_BACKGROUND="/boot/grub/familiarmac-early-logo.png"
CONFIG
fi
update-grub
grub-script-check /boot/grub/grub.cfg
if [[ "$mode" == --install ]]; then grep -q 'familiarmac-early-logo.png' /boot/grub/grub.cfg; fi
trap - ERR
echo "Early logo $mode complete. Visual validation requires a reboot; firmware display is outside GRUB's control."
