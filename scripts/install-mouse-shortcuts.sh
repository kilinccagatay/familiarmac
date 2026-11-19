#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Administrator authentication is required.' >&2; exit 1; }
root=$(cd "$(dirname "$0")/.." && pwd)
if ! /usr/bin/python3 -c 'import evdev' >/dev/null 2>&1; then
 apt-get install -y --no-install-recommends python3-evdev
fi
install -d /usr/local/libexec/magic_mouse_support /usr/local/share/doc/familiarmac-magic-mouse/licenses
install -m644 "$root/vendor/familiarmac-magic-mouse/magic_mouse_support/"*.py /usr/local/libexec/magic_mouse_support/
install -m644 "$root/vendor/familiarmac-magic-mouse/"{LICENSE,THIRD_PARTY_NOTICES.md} /usr/local/share/doc/familiarmac-magic-mouse/
install -m644 "$root/vendor/familiarmac-magic-mouse/licenses/"*.txt /usr/local/share/doc/familiarmac-magic-mouse/licenses/
install -Dm644 "$root/native/mouse-shortcuts/gesture_actions.py" /usr/local/libexec/gesture_actions.py
install -Dm644 "$root/native/mouse-shortcuts/daemon.py" /usr/local/libexec/familiarmac-mouse.py
install -Dm644 "$root/native/mouse-shortcuts/familiarmac-mouse.service" /etc/systemd/system/familiarmac-mouse.service
install -Dm644 "$root/native/mouse-shortcuts/familiarmac-magic-mouse.conf" /etc/modprobe.d/familiarmac-magic-mouse.conf
# Apply to an already loaded driver without disconnecting the mouse or
# restarting the desktop. The modprobe setting covers subsequent loads.
magic_buttons=/sys/module/hid_magicmouse/parameters/emulate_3button
if [[ -e "$magic_buttons" ]]; then
 printf 'N\n' > "$magic_buttons"
fi
systemctl daemon-reload
systemctl enable --now familiarmac-mouse.service
systemctl restart familiarmac-mouse.service
echo 'Mouse shortcut support ready. Keyboard configuration unchanged.'
