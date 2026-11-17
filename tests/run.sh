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
for f in extensions/familiarmac-panel-layout@local/*.js extensions/familiarmac-lock@local/*.js extensions/macbook-menu@local/*.js extensions/familiarmac-icons@local/*.js overrides/appmenu/*.js overrides/rounded-window-corners/manager/*.js; do
  "$NODE" --input-type=module --check < "$f"
done
for f in tests/*.cjs; do
  [[ $f == tests/login-layout.cjs ]] && continue
  "$NODE" "$f"
done
bash scripts/test.sh
python3 tests/editor-decorations.py
python3 tests/native-qt-decorations.py
python3 tests/responsive-scrolling.py
python3 tests/wsf-installer.py
python3 tests/installer-plan.py
git diff --check

python3 tests/brightness.py

python3 tests/lean-initramfs.py

GIO_USE_VFS=local dbus-run-session -- gjs -m tests/gtk-menu-model.js
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
