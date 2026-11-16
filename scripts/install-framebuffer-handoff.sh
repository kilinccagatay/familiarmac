#!/usr/bin/env bash
# Opt-in, reversible workaround for deferred fbcon takeover on MacBookPro10,1.
# Does not switch GPUs, disable acceleration, change GDM or restart anything.
set -euo pipefail
mode=${1:---install}
case "$mode" in --install|--restore|--check) ;; *) echo 'Usage: install-framebuffer-handoff.sh [--install|--restore|--check]' >&2; exit 2;; esac
config=/etc/default/grub.d/98-familiarmac-framebuffer.cfg
state=/var/lib/macbook-zorin/framebuffer-handoff
marker='# FamiliarMac: deferred framebuffer takeover workaround'
if [[ "$mode" != --restore ]]; then
  [[ $(cat /sys/class/dmi/id/product_name) == MacBookPro10,1 ]] || { echo 'This workaround is restricted to MacBookPro10,1.' >&2; exit 1; }
  [[ -d /sys/module/nouveau ]] || { echo 'Nouveau must be the current driver.' >&2; exit 1; }
fi
command -v update-grub >/dev/null
if [[ -f "$config" ]] && ! grep -Fxq "$marker" "$config"; then
  echo "Refusing to overwrite unmanaged file: $config" >&2; exit 1
fi
if [[ "$mode" == --check ]]; then
  echo 'Applicable: MacBookPro10,1 with Nouveau. Will add only fbcon=nodefer to future boots.'
  echo 'This is an unverified workaround until a reboot and logout comparison.'
  exit 0
fi
[[ $EUID == 0 ]] || { echo 'Administrative privileges required.' >&2; exit 1; }
if [[ "$mode" == --restore ]]; then
  [[ -f "$config" ]] || { echo 'Workaround is not installed.'; exit 0; }
  backup=$(mktemp)
  cp -p "$config" "$backup"
  rm "$config"
  if ! update-grub; then cp -p "$backup" "$config"; rm "$backup"; update-grub || true; exit 1; fi
  rm "$backup"
  echo 'Workaround removed. Reboot when convenient to restore deferred takeover.'
  exit 0
fi
if [[ -f "$config" ]]; then echo 'Workaround already installed; no changes.'; exit 0; fi
install -d -m755 /etc/default/grub.d
install -d -m700 "$state"
[[ -f "$state/grub.cfg.before" ]] || cp -p /boot/grub/grub.cfg "$state/grub.cfg.before"
[[ -f "$state/cmdline.before" ]] || cp /proc/cmdline "$state/cmdline.before"
cat > "$config" <<'CONFIG'
# FamiliarMac: deferred framebuffer takeover workaround
# Optional MacBookPro10,1/Nouveau workaround; remove this file and update-grub to undo.
case " ${GRUB_CMDLINE_LINUX_DEFAULT} ${GRUB_CMDLINE_LINUX} " in
  *" fbcon=nodefer "*) ;;
  *) GRUB_CMDLINE_LINUX_DEFAULT="${GRUB_CMDLINE_LINUX_DEFAULT} fbcon=nodefer" ;;
esac
CONFIG
chmod 644 "$config"
if ! update-grub; then rm "$config"; update-grub || true; exit 1; fi
if ! grep -Eq '^[[:space:]]*linux[[:space:]].*fbcon=nodefer' /boot/grub/grub.cfg; then
  rm "$config"; update-grub; echo 'Generated boot entries did not contain the workaround; rolled back.' >&2; exit 1
fi
printf '%s\n' 'Installed for next boot only. Current session is unchanged.'
printf '%s\n' 'Verify /proc/cmdline and fbcon journal after reboot, then visually compare boot and logout.'
