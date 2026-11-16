#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
[[ $EUID == 0 ]] || { echo 'sudo ile çalıştırın.' >&2; exit 1; }
temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT
python3 scripts/chatgpt-frame.py prepare "$temp/native.asar"
[[ -f "$temp/native.asar" ]] || exit 0
node --check "$temp/native.js"
python3 scripts/chatgpt-frame.py install "$temp/native.asar"
