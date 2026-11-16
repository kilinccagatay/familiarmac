#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
[[ $EUID == 0 ]] || { echo 'Run with sudo or pkexec.'; exit 1; }
theme=/usr/share/plymouth/themes/macbook-apple
backup=/var/lib/macbook-zorin/boot-before-spaced-progress
if [[ ! -e "$backup" ]]; then cp -a "$theme" "$backup"; fi
install -m644 assets/boot/*.png "$theme/"
install -m644 config/macbook.script "$theme/macbook.script"
install -m644 config/macbook-apple.plymouth "$theme/macbook-apple.plymouth"
update-initramfs -u
echo 'Boot theme installed; desktop and input settings untouched.'
