#!/usr/bin/env bash
# Shared presentation assets only: no GDM, keyboard, boot or driver changes.
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
[[ $EUID == 0 ]] || { echo 'Run with sudo to install shared theme assets.' >&2; exit 1; }
sha256sum --check vendor/SHA256SUMS
for tool in sassc glib-compile-resources xmllint; do command -v "$tool" >/dev/null; done
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/gtk" "$tmp/icons"
tar --no-same-owner -xzf vendor/whitesur-gtk.tar.gz -C "$tmp/gtk"
tar --no-same-owner -xzf vendor/whitesur-icons.tar.gz -C "$tmp/icons"
# The pinned upstream installer also installs an unrelated theme-switcher app.
# Desktop preparation owns theme assets only; fail closed if that call changes.
python3 - "$tmp/gtk/install.sh" <<'PY_PATCH'
import sys
from pathlib import Path
p=Path(sys.argv[1]);s=p.read_text();anchor='  install_app\n'
if s.count(anchor)!=1:raise SystemExit('Unsupported WhiteSur installer; no theme files installed')
p.write_text(s.replace(anchor,'  # FamiliarMac: theme-switcher app intentionally omitted\n'))
PY_PATCH
bash "$tmp/gtk/install.sh" -d /usr/share/themes -n MacBook-WhiteSur -c dark -o normal --shell -i apple --silent-mode
bash "$tmp/icons/install.sh" -d /usr/share/icons -n MacBook-WhiteSur
install -Dm644 "$tmp/gtk/src/assets/gnome-shell/backgrounds/background-default.png" /usr/local/share/macbook-zorin/wallpaper.png
echo 'Shared desktop theme assets installed; no login, boot, keyboard or driver changes.'
