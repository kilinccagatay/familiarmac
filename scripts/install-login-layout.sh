#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
[[ $EUID == 0 ]] || { echo 'Run via pkexec or sudo.'; exit 1; }
base=/usr/local/share/macbook-zorin/login-layout
state=/var/lib/macbook-zorin/login-layout
wrapper=/usr/local/libexec/macbook-gdm-shell
fallback=/usr/share/gdm/greeter/applications/org.gnome.Shell.desktop
install -d -m755 "$state"
if [[ ${1:-} == --restore ]]; then
  [[ -f "$state/installed" ]] || { echo "No managed login layout installed."; exit 0; }
  for kind in wayland x11; do
    rm -f "/etc/systemd/user/org.gnome.Shell@$kind.service.d/80-macbook-login.conf"
  done
  if [[ -f "$state/greeter.desktop" ]]; then cp -a "$state/greeter.desktop" "$fallback"; else rm -f "$fallback"; fi
  if [[ -f "$state/gdm.gresource" ]]; then install -m644 "$state/gdm.gresource" /usr/local/share/macbook-zorin/gdm.gresource; fi
  echo 'Previous login appearance restored for the next greeter. No sessions restarted.'
  exit
fi
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
python3 scripts/build-login-layout.py "$tmp/layout"
node --input-type=module --check < "$tmp/layout/loginDialog.js"
if [[ ! -f "$state/installed" ]]; then
  cp -a /usr/local/share/macbook-zorin/gdm.gresource "$state/gdm.gresource"
  if [[ -f "$fallback" ]]; then cp -a "$fallback" "$state/greeter.desktop"; fi
fi
# Install source and version guard before enabling any launch override.
install -d -m755 "$base" /usr/local/libexec
install -m644 "$tmp/layout/loginDialog.js" "$tmp/layout/source.json" "$base/"
sha256sum /usr/lib/gnome-shell/libshell-14.so > "$base/library.sha256"
install -m755 scripts/gdm-shell-wrapper.sh "$wrapper"
bash scripts/refine-visuals.sh --gdm-only
for kind in wayland x11; do
  drop="/etc/systemd/user/org.gnome.Shell@$kind.service.d/80-macbook-login.conf"
  install -d -m755 "$(dirname "$drop")"
  printf '[Service]\nExecStart=\nExecStart=%s\n' "$wrapper" > "$drop"
done
# Covers GDM installations which use the gnome-session desktop launcher.
sed "s|^Exec=.*|Exec=$wrapper|" /usr/share/applications/org.gnome.Shell.desktop > "$fallback"
touch "$state/installed"
echo 'Login layout/theme installed. Current user session and GDM were not restarted.'
