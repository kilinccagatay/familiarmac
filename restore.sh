#!/usr/bin/env bash
# Restore in reverse layering order. Files edited since installation are not forced.
set -euo pipefail
cd -- "$(dirname -- "$0")"
[[ $EUID != 0 ]] || { echo 'Run as your desktop user, without sudo.'; exit 1; }
state="${XDG_STATE_HOME:-$HOME/.local/state}/macbook-zorin"
if [[ -f "$state/brightness.json" ]]; then python3 scripts/install-brightness.py --restore; fi
if [[ -f "$state/smooth-scrolling.json" ]]; then python3 scripts/install-smooth-scrolling.py --restore; fi
if [[ -f "$state/brave-launcher.json" ]]; then python3 scripts/install-brave-global-menu.py --restore; fi
if [[ -f "$HOME/.config/systemd/user/org.gnome.Shell@wayland.service.d/90-macbook-scroll.conf" ]]; then bash scripts/install-scroll-speed.sh --restore; fi
if [[ -f "$state/rounded-corners.json" ]]; then python3 scripts/install-rounded-corners.py --restore; fi
if [[ -f "$state/desktop.json" ]]; then python3 scripts/desktop.py restore; fi
if [[ ${1:-} == --system ]]; then
  sudo bash scripts/install-login-layout.sh --restore
  sudo bash scripts/system.sh restore
fi
echo 'Restored. Log out/in manually; reboot if boot/keyboard settings changed. Packages and source files retained.'
