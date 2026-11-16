#!/usr/bin/env bash
# Update the existing shared bridge without modifying application archives.
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
[[ $EUID == 0 ]] || { echo 'Run with sudo or pkexec.' >&2; exit 1; }
target=/usr/local/lib/macbook-zorin
[[ -f "$target/appmenu-bridge.cjs" && -f "$target/appmenu-exporter.py" ]] || {
  echo 'Install the Electron menu integration first.' >&2; exit 1;
}
backup=$(mktemp -d /var/lib/macbook-zorin/menu-bridge-backup.XXXXXX)
for name in appmenu-bridge.cjs appmenu-exporter.py; do
  cp -a "$target/$name" "$backup/$name"
  install -m644 "bridges/$name" "$target/$name.new"
  mv -f "$target/$name.new" "$target/$name"
done
echo "Menu bridge updated; previous files: $backup"
echo 'Restart the application normally to load the new bridge.'
