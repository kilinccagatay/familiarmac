#!/usr/bin/env bash
# Read-only evidence: never switch GPUs, restart GDM or end a session.
set -euo pipefail
printf 'Model: '; cat /sys/class/dmi/id/product_name
printf 'Kernel: '; uname -r
printf '\nConnected outputs:\n'
for status in /sys/class/drm/card*-*/status; do
  [[ -f "$status" ]] || continue
  printf '%s: ' "$(basename "$(dirname "$status")")"; cat "$status"
done
printf '\nSession renderer history (current boot):\n'
journalctl -b --no-pager -o short-monotonic | rg 'Running GNOME Shell|selected primary|Created gbm renderer|Added device.*(nouveau|i915)' || true
printf '\nKernel graphics errors (current boot):\n'
journalctl -b -k --no-pager -o short-monotonic | rg -i '(nouveau|i915|drm).*(error|fail|fault|hang|timeout|reset)' || true
printf '\nHardware mux state (requires root for debugfs):\n'
if [[ -r /sys/kernel/debug/vgaswitcheroo/switch ]]; then
  cat /sys/kernel/debug/vgaswitcheroo/switch
else
  printf 'Not readable; renderer identity alone does not prove the mux never changed.\n'
fi
