#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
[[ $EUID == 0 ]] || exit 1
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends gnome-screenshot xclip
keyd check config/apple.conf
install -m644 config/apple.conf /etc/keyd/macbook.conf
systemctl restart keyd
bash scripts/refine-visuals.sh
python3 scripts/chatgpt-frame.py install "$1"
