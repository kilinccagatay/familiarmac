#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
lib="$HOME/.local/lib/macbook-zorin/scroll-scale.so"
drop="$HOME/.config/systemd/user/org.gnome.Shell@wayland.service.d/90-macbook-scroll.conf"
if [[ ${1:-} == --restore ]]; then
  rm -f -- "$drop"
  systemctl --user daemon-reload
  echo 'Scroll scaling disabled for next login.'
  exit
fi
if [[ -n $(systemctl --user show org.gnome.Shell@wayland.service -p Environment --value | sed -n '/LD_PRELOAD=/p') && ! -f "$drop" ]]; then
  echo 'Existing LD_PRELOAD detected; refusing to replace it.'; exit 1
fi
mkdir -p -- "$(dirname "$lib")" "$(dirname "$drop")"
gcc -shared -fPIC -O2 -Wall -Wextra -Werror native/scroll-scale.c -ldl -o "$lib.new"
mv -- "$lib.new" "$lib"
printf '[Service]\nEnvironment="LD_PRELOAD=%s"\n' "$lib" > "$drop"
systemctl --user daemon-reload
echo 'Finger scroll distance set to 50% for next login. Shell was not restarted.'
