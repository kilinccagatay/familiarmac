#!/usr/bin/env bash
# Optional same-terminal static logo: no terminal reinitialization or clear.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
mode=${1:---check}
case "$mode" in --check|--install|--restore) ;; *) exit 2;; esac
if [[ $mode == --install ]]; then
  echo 'Installation withdrawn: cold-boot test reproduced corruption and no early logo. Use --restore.' >&2
  exit 1
fi
[[ $(cat /sys/class/dmi/id/product_name) == MacBookPro10,1 && -d /sys/firmware/efi ]] || { echo 'Test profile: EFI MacBookPro10,1 only.'; exit 1; }
config=/etc/default/grub.d/97-familiarmac-static-logo.cfg
refresh=/etc/grub.d/06_familiarmac_static_logo
image=/boot/grub/familiarmac-static-logo.png
state=/var/lib/macbook-zorin/grub-static-logo
marker='# FamiliarMac: same-terminal static logo'
if [[ $mode == --check ]]; then
  echo 'Static GRUB background with no mode/terminal reset, clear, sleep or kernel option change.'
  exit 0
fi
[[ $EUID == 0 ]] || { echo 'Administrative privileges required.'; exit 1; }
for f in "$config" "$refresh"; do
  [[ ! -e "$f" ]] || grep -Fxq "$marker" "$f" || { echo 'Unmanaged file; refusing.'; exit 1; }
done
[[ ! -e /etc/grub.d/06_familiarmac_early_logo && ! -e /etc/default/grub.d/97-familiarmac-early-logo.cfg ]] || { echo 'Remove withdrawn early-logo experiment first.'; exit 1; }
install -d -m700 "$state"
exec > "$state/last-install.log" 2>&1
cp -p /boot/grub/grub.cfg "$state/grub.cfg.transaction"
for f in "$config" "$refresh" "$image"; do
  name=$(basename "$f")
  rm -f "$state/$name.transaction"
  [[ ! -e "$f" ]] || cp -p "$f" "$state/$name.transaction"
done
rollback() {
  cp -p "$state/grub.cfg.transaction" /boot/grub/grub.cfg
  for f in "$config" "$refresh" "$image"; do
    name=$(basename "$f")
    if [[ -e "$state/$name.transaction" ]]; then cp -p "$state/$name.transaction" "$f"; else rm -f "$f"; fi
  done
}
trap rollback ERR
if [[ $mode == --restore ]]; then
  rm -f "$config" "$refresh" "$image"
else
  [[ -f "$state/grub.cfg.original" ]] || cp -p /boot/grub/grub.cfg "$state/grub.cfg.original"
  /usr/bin/python3 "$root/scripts/render-grub-background.py" "$image"
  chmod 644 "$image"
  install -d -m755 /etc/default/grub.d
  cat > "$config" <<'CFG'
# FamiliarMac: same-terminal static logo
GRUB_THEME=""
GRUB_BACKGROUND="/boot/grub/familiarmac-static-logo.png"
CFG
  cat > "$refresh" <<'REFRESH'
#!/bin/sh
# FamiliarMac: same-terminal static logo
# 05_debian_theme loads the background on the already active gfxterm.
# Empty echo flushes scheduled paint; no terminal_output, clear or sleep.
cat <<'GRUB'
if [ "$grub_platform" = "efi" ]; then
  echo -n
fi
GRUB
REFRESH
  chmod 755 "$refresh"
fi
update-grub
grub-script-check /boot/grub/grub.cfg
# Verify all mode/handoff and boot command lines remain byte-identical.
python3 - "$state/grub.cfg.transaction" /boot/grub/grub.cfg <<'PY'
import re,sys
from pathlib import Path
pattern=re.compile(r'^\s*(?:linux(?:efi)? |initrd(?:efi)? |set gfx(?:mode|payload)=|gfxmode |terminal_output |set timeout(?:_style)?=)')
def critical(path): return [l for l in Path(path).read_text().splitlines() if pattern.match(l)]
assert critical(sys.argv[1])==critical(sys.argv[2]), 'Boot/mode commands changed; rolling back'
PY
if [[ $mode == --install ]]; then grep -q 'background_image .*familiarmac-static-logo.png' /boot/grub/grub.cfg; fi
trap - ERR
echo "Static logo $mode complete. Reboot visual validation pending; no restart performed."
