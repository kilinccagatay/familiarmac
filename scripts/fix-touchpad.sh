#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
[[ $EUID == 0 ]] || exit 1
keyd check config/apple.conf
install -m644 config/apple.conf /etc/keyd/macbook.conf
systemctl restart keyd
journalctl -u keyd --since '-5 seconds' --no-pager
