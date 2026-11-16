#!/usr/bin/env bash
# Temporary Plymouth tracing; no renderer, mode, timing or module changes.
set -euo pipefail
mode=${1:---check}
case "$mode" in --install|--restore|--check) ;; *) exit 2;; esac
file=/etc/default/grub.d/96-familiarmac-boot-trace.cfg
marker='# FamiliarMac: temporary Plymouth trace'
[[ ! -f "$file" ]] || grep -Fxq "$marker" "$file" || { echo 'Unmanaged configuration; refusing.'; exit 1; }
if [[ $mode == --check ]]; then
  echo 'Enables plymouth.debug for next boot; log: /var/log/plymouth-debug.log. Restore after diagnosis.'
  exit 0
fi
[[ $EUID == 0 ]] || { echo 'Administrative privileges required.'; exit 1; }
state=/var/lib/macbook-zorin/boot-trace
install -d -m700 "$state"
exec > "$state/last-install.log" 2>&1
cp -p /boot/grub/grub.cfg "$state/grub.cfg.before"
if [[ $mode == --restore ]]; then
  [[ -f "$file" ]] || exit 0
  mv "$file" "$state/trace.removed"
  if ! update-grub; then
    mv "$state/trace.removed" "$file"
    cp -p "$state/grub.cfg.before" /boot/grub/grub.cfg
    exit 1
  fi
else
  [[ ! -f "$file" ]] || { echo 'Tracing already enabled.'; exit 0; }
  cat > "$file" <<'CFG'
# FamiliarMac: temporary Plymouth trace
GRUB_CMDLINE_LINUX_DEFAULT="$GRUB_CMDLINE_LINUX_DEFAULT plymouth.debug"
CFG
  if ! update-grub; then
    rm -f "$file"
    cp -p "$state/grub.cfg.before" /boot/grub/grub.cfg
    exit 1
  fi
fi
echo 'Boot trace configuration updated; no restart performed.'
