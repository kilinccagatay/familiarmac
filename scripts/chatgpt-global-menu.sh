#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
[[ $EUID == 0 ]] || { echo 'Run with sudo or pkexec.'; exit 1; }
# Restore patches in reverse order before updating the native menu bridge.
if [[ -f /var/lib/macbook-zorin/chatgpt-renderer-menu/state.json ]]; then
  python3 scripts/chatgpt-renderer-menu.py restore
fi
# Migrate the earlier removeMenu-only patch using its checked backup.
if [[ -f /var/lib/macbook-zorin/chatgpt-global-menu/state.json ]]; then
  python3 scripts/chatgpt-global-menu.py restore
fi
install -d /usr/local/lib/macbook-zorin
install -m644 bridges/appmenu-bridge.cjs bridges/appmenu-exporter.py /usr/local/lib/macbook-zorin/
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
python3 scripts/chatgpt-global-menu.py prepare "$tmp/global.asar"
node --input-type=module --check < "$tmp/global.js"
python3 scripts/chatgpt-global-menu.py install "$tmp/global.asar"

# Native panel export has been verified; remove the duplicate renderer menu.
python3 scripts/chatgpt-renderer-menu.py prepare "$tmp/renderer.asar"
node --check "$tmp/renderer.js"
python3 scripts/chatgpt-renderer-menu.py install "$tmp/renderer.asar"
