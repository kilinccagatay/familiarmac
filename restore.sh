#!/usr/bin/env bash
# Restore in reverse layering order. Files edited since installation are not forced.
set -euo pipefail
cd -- "$(dirname -- "$0")"
[[ $EUID != 0 ]] || { echo 'Run as your desktop user, without sudo.'; exit 1; }
case ${1:-} in
  ''|--all|--system-appearance|--system) ;;
  *) echo 'Usage: ./restore.sh [--all | --system-appearance | --system]' >&2; exit 2;;
esac
if [[ ${1:-} == --system-appearance || ${1:-} == --all ]]; then
  sudo bash scripts/install-system-appearance.sh --restore
  if [[ ${1:-} != --all ]]; then exit 0; fi
fi
python3 scripts/install-finder-search.py --restore
state="${XDG_STATE_HOME:-$HOME/.local/state}/macbook-zorin"
if [[ -f "$HOME/.config/systemd/user/familiarmac-app-integrations.service" ]]; then python3 scripts/install-app-integrations.py --restore; fi
if [[ -f "$state/trash-drop.json" ]]; then python3 scripts/install-trash-drop.py --restore; fi
if [[ -f "$state/brightness.json" ]]; then python3 scripts/install-brightness.py --restore; fi
if [[ -f "$state/responsive-scrolling.json" ]]; then python3 scripts/install-smooth-scrolling.py --restore; fi
if [[ -f "$state/brave-launcher.json" ]]; then python3 scripts/install-brave-global-menu.py --restore; fi
if [[ -f "$state/wsf.json" ]]; then bash scripts/install-scroll-speed.sh --restore; fi
if [[ -f "$state/rounded-corners.json" ]]; then python3 scripts/install-rounded-corners.py --restore; fi
if [[ -f "$state/dock-icons.json" ]]; then python3 scripts/install-dock-icons.py --restore; fi
if [[ -f "$state/desktop.json" ]]; then python3 scripts/desktop.py restore; fi
if [[ ${1:-} == --system ]]; then
  sudo bash scripts/install-login-layout.sh --restore
  sudo bash scripts/system.sh restore
fi
echo 'Restored. Log out/in manually; reboot if boot/keyboard settings changed. Packages and source files retained.'
