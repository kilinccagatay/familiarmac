#!/usr/bin/env bash
# Public entry point. No arguments = read-only inspection.
set -euo pipefail
cd -- "$(dirname -- "$0")"
mode=check; dry=0; input=0; scroll=0; smooth=0; brave=0; chatgpt=0; wifi=0; brightness=0
usage() {
  cat <<'EOF'
Usage: ./install.sh [--all | --check | --prepare-desktop | --desktop | --system-appearance | --full] [options]
  --all            Complete portable setup: dependencies, desktop, apps, boot/login
  --check          Read-only compatibility and dependency report (default)
  --prepare-desktop Install dependencies and shared themes only; no hardware profile
  --desktop        GNOME user profile + extensions + window rounding
  --system-appearance Opt-in boot splash and GDM only; no hardware settings
  --full           Above + WhiteSur, keyd, boot, GDM (MacBookPro10,1 only)
  --input-preset   Opt into initial reference touchpad/gesture preferences
  --scroll         Pinned WSF 25% touchpad scaling + responsive app scrolling
  --brightness     Allow gmux brightness-down to reach true zero (native up retained)
  --smooth         Responsive app scrolling only (legacy option name; disables smoothing)
  --brave          Brave X11 launcher for exported global menus
  --chatgpt        Version-guarded native frame/menu patches (requires --full)
  --wifi           BCM4360 driver repair (requires --full; network may disconnect)
  --dry-run        Print exact commands without changing the desktop
  --help           Show this help
See docs/INSTALL.md before using --full. No automatic logout/reboot.
EOF
}
selected_mode=
select_mode() {
  [[ -z $selected_mode || $selected_mode == "$1" ]] || { echo 'Choose only one installation mode.' >&2; exit 2; }
  selected_mode=$1; mode=$1
}
for arg in "$@"; do
  case "$arg" in
    --all) select_mode all;; --check) select_mode check;; --prepare-desktop) select_mode prepare;; --desktop) select_mode desktop;; --full) select_mode full;; --system-appearance) select_mode appearance;;
    --dry-run) dry=1;; --input-preset) input=1;; --scroll) scroll=1;;
    --brightness) brightness=1;; --smooth) smooth=1;; --brave) brave=1;; --chatgpt) chatgpt=1;; --wifi) wifi=1;;
    --help|-h) usage; exit;; *) echo "Unknown option: $arg" >&2; usage; exit 2;;
  esac
done
if [[ $mode == all && $input$scroll$brightness$chatgpt$wifi != 00000 ]]; then
  echo '--all excludes reference input/scaling, gmux, binary patches and Wi-Fi repairs; use the separately documented options deliberately.' >&2
  exit 2
fi
if [[ -f RELEASE.json && ( $mode == full || $wifi == 1 || $brightness == 1 || $chatgpt == 1 ) ]]; then
  echo "Release packages exclude machine-specific repairs. See the repository manual hardware guide." >&2; exit 2
fi
if [[ $mode == check ]]; then python3 scripts/doctor.py; exit; fi
[[ $EUID != 0 ]] || { echo 'Run as your desktop user, without sudo.' >&2; exit 1; }
[[ $mode == full || $chatgpt$wifi == 00 ]] || { echo '--chatgpt/--wifi require --full.' >&2; exit 2; }
run() { printf ' +'; printf ' %q' "$@"; printf '\n'; if [[ $dry == 0 ]]; then "$@"; fi; }
if [[ $mode == appearance ]]; then
  run sudo bash scripts/install-system-appearance.sh
  exit 0
fi
if [[ $dry == 0 ]]; then
  preflight=$mode
  [[ $mode != all ]] || preflight=prepare
  python3 scripts/doctor.py --require "$preflight"
  sha256sum --check vendor/SHA256SUMS
fi
if [[ $mode == prepare || $mode == all ]]; then
  run sudo bash scripts/bootstrap.sh
  run sudo bash scripts/install-desktop-themes.sh
  run sudo bash scripts/install-mouse-shortcuts.sh
  if [[ $mode == prepare ]]; then
    echo 'Preparation complete. Next: ./install.sh --desktop'
    exit 0
  fi
  run python3 scripts/doctor.py --require desktop
fi
if [[ $mode == full ]]; then
  run sudo bash scripts/bootstrap.sh
  run sudo bash scripts/system.sh install "$(id -un)"
  run sudo bash scripts/install-login-layout.sh
fi
run env MACBOOK_INPUT_PRESET="$input" python3 scripts/desktop.py
run python3 scripts/install-rounded-corners.py
run python3 scripts/install-apps.py
run python3 scripts/install-about.py
run python3 scripts/install-finder-search.py
run python3 scripts/install-dock-icons.py
run python3 scripts/install-trash-drop.py
if [[ $brightness == 1 ]]; then run python3 scripts/install-brightness.py; fi
if [[ $scroll == 1 ]]; then run bash scripts/install-scroll-speed.sh; fi
if [[ $brave == 1 ]]; then run python3 scripts/install-brave-global-menu.py; fi
if [[ $smooth == 1 || $scroll == 1 ]]; then run python3 scripts/install-smooth-scrolling.py; fi
if [[ $chatgpt == 1 ]]; then
  run sudo bash scripts/chatgpt-native-frame.sh
  run sudo bash scripts/chatgpt-global-menu.sh
fi
if [[ $wifi == 1 ]]; then run sudo bash scripts/wifi.sh; fi
# Older updater versions restore the entire dconf snapshot after install.sh.
# Finish only the managed extension migration after their successful update.
if [[ ${FAMILIARMAC_UPDATING:-0} == 1 ]]; then run python3 scripts/prepare-update-migration.py; fi
if [[ $mode == all ]]; then
  run sudo bash scripts/install-system-appearance.sh
  if [[ ${FAMILIARMAC_UPDATING:-0} != 1 ]]; then run python3 scripts/release-update.py --register "$PWD"; fi
  echo 'Complete portable setup installed. Save work and reboot manually to load desktop and login visuals.'
  exit 0
fi
if [[ ${FAMILIARMAC_UPDATING:-0} != 1 ]]; then run python3 scripts/release-update.py --register "$PWD"; fi
echo 'Done. New Shell code/scroll library loads on next login; app patches on next app launch.'
