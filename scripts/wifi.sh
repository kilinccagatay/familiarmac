#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || exit 1
lspci -n -s 04:00.0 | grep -q '14e4:43a0' || { echo 'BCM4360 bulunamadı'; exit 1; }
DEBIAN_FRONTEND=noninteractive apt-get install -y broadcom-sta-dkms "linux-headers-$(uname -r)"
modinfo wl >/dev/null
# Only the unsupported driver for the internal Wi-Fi card is released.
modprobe -r b43 bcma
modprobe wl
nmcli radio wifi on
udevadm settle
nmcli device status
dkms status
