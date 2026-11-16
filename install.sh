#!/usr/bin/env bash
# Public entry point. No arguments = read-only inspection.
set -euo pipefail
cd -- "$(dirname -- "$0")"
mode=check; dry=0; input=0; scroll=0; smooth=0; brave=0; chatgpt=0; wifi=0; brightness=0
usage() {
  cat <<'EOF'
Usage: ./install.sh [--check | --desktop | --full] [options]
  --check          Read-only compatibility and dependency report (default)
  --desktop        GNOME user profile + extensions + window rounding
  --full           Above + WhiteSur, keyd, boot, GDM (MacBookPro10,1 only)
  --input-preset   Opt into initial reference touchpad/gesture preferences
  --scroll         Finger scroll distance 50% (experimental Shell preload)
  --brightness     Allow gmux brightness-down to reach true zero (native up retained)
  --smooth         Smooth-scroll launch flags for installed Chromium apps
  --brave          Brave X11 launcher for exported global menus
  --chatgpt        Version-guarded native frame/menu patches (requires --full)
  --wifi           BCM4360 driver repair (requires --full; network may disconnect)
  --dry-run        Print exact commands without changing the desktop
  --help           Show this help
See docs/INSTALL.md before using --full. No automatic logout/reboot.
EOF
}
for arg in "$@"; do
  case "$arg" in
    --check) mode=check;; --desktop) mode=desktop;; --full) mode=full;;
    --dry-run) dry=1;; --input-preset) input=1;; --scroll) scroll=1;;
    --brightness) brightness=1;; --smooth) smooth=1;; --brave) brave=1;; --chatgpt) chatgpt=1;; --wifi) wifi=1;;
    --help|-h) usage; exit;; *) echo "Unknown option: $arg" >&2; usage; exit 2;;
  esac
done
if [[ $mode == check ]]; then python3 scripts/doctor.py; exit; fi
[[ $EUID != 0 ]] || { echo 'Run as your desktop user, without sudo.' >&2; exit 1; }
[[ $mode == full || $chatgpt$wifi == 00 ]] || { echo '--chatgpt/--wifi require --full.' >&2; exit 2; }
run() { printf ' +'; printf ' %q' "$@"; printf '\n'; if [[ $dry == 0 ]]; then "$@"; fi; }
if [[ $dry == 0 ]]; then
  python3 scripts/doctor.py --require "$mode"
  sha256sum --check vendor/SHA256SUMS
fi
if [[ $mode == full ]]; then
  run sudo bash scripts/bootstrap.sh
  run sudo bash scripts/system.sh install "$(id -un)"
  run sudo bash scripts/install-login-layout.sh
fi
run env MACBOOK_INPUT_PRESET="$input" python3 scripts/desktop.py
run python3 scripts/install-rounded-corners.py
if [[ $brightness == 1 ]]; then run python3 scripts/install-brightness.py; fi
if [[ $scroll == 1 ]]; then run bash scripts/install-scroll-speed.sh; fi
if [[ $brave == 1 ]]; then run python3 scripts/install-brave-global-menu.py; fi
if [[ $smooth == 1 ]]; then run python3 scripts/install-smooth-scrolling.py; fi
if [[ $chatgpt == 1 ]]; then
  run sudo bash scripts/chatgpt-native-frame.sh
  run sudo bash scripts/chatgpt-global-menu.sh
fi
if [[ $wifi == 1 ]]; then run sudo bash scripts/wifi.sh; fi
echo 'Done. New Shell code/scroll library loads on next login; app patches on next app launch.'
