#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
NODE=${NODE:-node}
command -v "$NODE" >/dev/null || { echo 'Node 18+ required; set NODE=/path/to/node'; exit 1; }
for tool in gjs dbus-run-session cc make python3; do
  command -v "$tool" >/dev/null || { echo "Missing test dependency: $tool (Ubuntu: sudo apt-get install gjs dbus-daemon build-essential python3)" >&2; exit 1; }
done
sha256sum --check vendor/SHA256SUMS
for f in install.sh apply.sh restore.sh scripts/*.sh tests/*.sh; do bash -n "$f"; done
python3 - <<'CHECK'
import ast
from pathlib import Path
for p in list(Path('scripts').glob('*.py'))+list(Path('bridges').glob('*.py')):
    ast.parse(p.read_text(),filename=str(p))
CHECK
for f in extensions/familiarmac-display-scale@local/*.js extensions/familiarmac-genie@local/*.js extensions/familiarmac-panel-layout@local/*.js extensions/familiarmac-lock@local/*.js extensions/macbook-menu@local/*.js extensions/familiarmac-icons@local/*.js overrides/appmenu/*.js overrides/rounded-window-corners/manager/*.js; do
  "$NODE" --input-type=module --check < "$f"
done
for f in tests/*.cjs; do
  [[ $f == tests/login-layout.cjs ]] && continue
  "$NODE" "$f"
done
python3 tests/keyd-ipc.py
bash scripts/test.sh
python3 tests/editor-decorations.py
python3 tests/native-qt-decorations.py
python3 tests/native-electron-menus.py
python3 tests/responsive-scrolling.py
python3 tests/wsf-installer.py
python3 tests/installer-plan.py
python3 tests/desktop-layout.py
git diff --check

python3 tests/brightness.py

python3 tests/lean-initramfs.py

GIO_USE_VFS=local dbus-run-session -- gjs -m tests/gtk-menu-model.js
GIO_USE_VFS=local dbus-run-session -- gjs -m tests/gtk-appmenu-only.js
python3 tests/app-integrations.py

python3 tests/quiet-kernel-entry.py

python3 tests/console-init.py

python3 tests/desktop-extension.py

python3 tests/video-firmware.py

python3 tests/native-trash-target.py

python3 tests/chromium-integrations.py

python3 tests/flatpak-appearance.py

python3 tests/app-integration-install.py

python3 tests/application-shortcuts.py

python3 tests/toolkit-detection.py

python3 tests/flatpak-gtk3-menu.py

python3 tests/native-menu-integrations.py

python3 tests/seahorse-layout.py

"$NODE" tests/gtk-action-fallback.cjs

"$NODE" tests/application-shortcuts.cjs

python3 tests/portal-owners.py
"$NODE" tests/portal-owners.cjs

python3 tests/snap-appearance.py

gjs tests/dock-autostart.js

python3 tests/app-lifecycle.py

gjs tests/lazy-dbusmenu.js

"$NODE" tests/lazy-menu-rebuild.cjs

"$NODE" tests/dbusmenu-property-refresh.cjs

"$NODE" tests/dbusmenu-warm-cache.cjs

python3 tests/hardware-catalog.py
python3 tests/settings-applications.py
python3 tests/finder-search-installer.py
python3 tests/settings-launchers.py
python3 tests/hardware-install-boundary.py

python3 tests/combined-install.py

python3 tests/release-update.py
python3 tests/settings-updates.py
python3 tests/package-manager.py

python3 tests/release-package.py

"$NODE" tests/mission-control-input.cjs
"$NODE" tests/bluetooth-label.cjs

python3 tests/mouse-shortcuts.py
python3 tests/mouse-seat-state.py

PYTHONPATH=vendor/familiarmac-magic-mouse python3 -m unittest discover -s vendor/familiarmac-magic-mouse/tests

python3 tests/magic-actions.py

dbus-run-session -- python3 tests/remmina-native-gtk.py
