#!/usr/bin/env bash
# Versioned portable dependencies and appearance only. No hardware repair profile.
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
[[ $EUID == 0 && -f RELEASE.json ]] || { echo 'Use the packaged update dialog.' >&2; exit 1; }
# All nested portable installers share the same lock-aware apt wrapper.
export FAMILIARMAC_APT_HELPER="$PWD/scripts/package-manager.py"
apt-get() { python3 "$FAMILIARMAC_APT_HELPER" "$@"; }
export -f apt-get
bash scripts/bootstrap.sh
bash scripts/install-desktop-themes.sh
# Never adopt/overwrite a reference machine's legacy GDM or boot setup.
if [[ -f /var/lib/familiarmac/system-appearance/installed ]]; then
  bash scripts/install-system-appearance.sh
fi

bash scripts/install-mouse-shortcuts.sh
