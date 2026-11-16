#!/usr/bin/env bash
# Optional firmware timeout adjustment. Never modifies boot entries/order.
set -euo pipefail
export LC_ALL=C
mode=${1:---check}
case "$mode" in --install|--restore|--check) ;; *) exit 2;; esac
state=/var/lib/macbook-zorin/firmware-timeout
[[ $(cat /sys/class/dmi/id/product_name) == MacBookPro10,1 ]] || exit 1
current=$(efibootmgr)
timeout=$(sed -n 's/^Timeout: \([0-9]*\) seconds$/\1/p' <<< "$current")
[[ $timeout =~ ^[0-9]+$ ]] || { echo 'No numeric firmware timeout; refusing.'; exit 1; }
if [[ $mode == --check ]]; then echo "Firmware timeout: $timeout seconds. Reboot needed to measure effect."; exit 0; fi
[[ $EUID == 0 ]] || exit 1
install -d -m700 "$state"
if [[ $mode == --restore ]]; then
  [[ -f "$state/timeout.before" ]] || exit 0
  target=$(cat "$state/timeout.before")
else
  if [[ ! -f "$state/timeout.before" ]]; then
    printf '%s\n' "$timeout" > "$state/timeout.before"
    printf '%s\n' "$current" > "$state/entries.before"
  fi
  target=0
fi
[[ $target =~ ^[0-9]+$ ]] || exit 1
efibootmgr --timeout "$target"
after=$(efibootmgr)
if ! grep -Fxq "Timeout: $target seconds" <<< "$after"; then
  efibootmgr --timeout "$timeout"
  echo 'Readback failed; previous timeout reinstated.' >&2; exit 1
fi
[[ $(grep '^BootOrder:' <<< "$current") == $(grep '^BootOrder:' <<< "$after") ]] || { echo 'Unexpected boot-order change; investigate.' >&2; exit 1; }
echo "Firmware timeout verified: $target seconds. Physical timing remains unverified."
