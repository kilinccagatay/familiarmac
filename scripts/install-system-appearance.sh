#!/usr/bin/env bash
# Portable, opt-in presentation only. Never installs a hardware profile.
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
[[ $EUID == 0 ]] || { echo 'Run through install.sh --system-appearance.' >&2; exit 1; }
exec 9>/run/lock/familiarmac-system-appearance.lock
flock -n 9 || { echo "Another appearance operation is running."; exit 1; }
state=/var/lib/familiarmac/system-appearance
gdm=/usr/local/share/macbook-zorin/gdm.gresource
boot=/usr/share/plymouth/themes/macbook-apple/macbook-apple.plymouth
paths=(usr/local/share/macbook-zorin/gdm.gresource usr/local/share/macbook-zorin/login-layout
  var/lib/macbook-zorin/login-layout usr/local/libexec/macbook-gdm-shell
  etc/systemd/user/org.gnome.Shell@wayland.service.d/80-macbook-login.conf
  etc/systemd/user/org.gnome.Shell@x11.service.d/80-macbook-login.conf
  usr/share/gdm/greeter/applications/org.gnome.Shell.desktop
  usr/share/gdm/dconf/99-macbook-zorin usr/share/plymouth/themes/macbook-apple)
restore() {
  [[ -f "$state/ready" ]] || { echo 'No portable appearance backup.'; return; }
  for name in gdm-theme.gresource default.plymouth; do
    target=$gdm; [[ $name != default.plymouth ]] || target=$boot
    update-alternatives --remove "$name" "$target" || true
    original=$(sed -n 's/^Value: //p' "$state/$name")
    update-alternatives --set "$name" "$original"
    if grep -qx 'Status: auto' "$state/$name"; then update-alternatives --auto "$name"; fi
  done
  for path in "${paths[@]}"; do
    [[ $path == usr/local/libexec/macbook-gdm-shell ]] || rm -rf -- "/$path"
  done
  tar -xpf "$state/files.tar" -C /
  # Existing user managers may retain the removed ExecStart drop-in until reboot.
  # Keep a harmless trampoline so a login during rollback cannot fail with 203/EXEC.
  install -d /usr/local/libexec
  trampoline=$(mktemp /usr/local/libexec/macbook-gdm-shell.XXXXXX)
  printf '#!/bin/sh\nexec /usr/bin/gnome-shell "$@"\n' > "$trampoline"
  chmod 755 "$trampoline"
  mv -f "$trampoline" /usr/local/libexec/macbook-gdm-shell
  /usr/share/gdm/generate-config
  update-initramfs -u -k all
  rm -f "$state/installed" "$state/ready"
  echo 'Previous boot/login appearance restored. No sessions restarted.'
}
if [[ ${1:-} == --restore ]]; then restore; exit; fi
for tool in node python3 gresource glib-compile-resources update-initramfs update-alternatives; do command -v "$tool" >/dev/null; done
[[ -f /usr/share/themes/MacBook-WhiteSur-Dark/gnome-shell/gnome-shell.css && -f /usr/local/share/macbook-zorin/wallpaper.png ]] || { echo 'Run --prepare-desktop first.'; exit 1; }
[[ -x /usr/share/gdm/generate-config ]] || { echo 'Unsupported GDM installation.'; exit 1; }
# Validate the exact upstream login source before changing system files.
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
python3 scripts/build-login-layout.py "$tmp/layout"
node --input-type=module --check < "$tmp/layout/loginDialog.js"
if [[ ! -f "$state/ready" ]]; then
  for path in "$gdm" "${boot%/*}" /var/lib/macbook-zorin/login-layout /usr/local/share/macbook-zorin/login-layout /usr/local/libexec/macbook-gdm-shell /usr/share/gdm/dconf/99-macbook-zorin /etc/systemd/user/org.gnome.Shell@{wayland,x11}.service.d/80-macbook-login.conf; do
    if [[ "$path" == /usr/local/libexec/macbook-gdm-shell ]] && cmp -s "$path" <(printf '#!/bin/sh\nexec /usr/bin/gnome-shell "$@"\n'); then continue; fi
    [[ ! -e "$path" ]] || { echo "Existing legacy installation: refusing to replace $path"; exit 1; }
  done
  install -d -m700 "$state"
  for name in gdm-theme.gresource default.plymouth; do update-alternatives --query "$name" > "$state/$name"; done
  existing=(); for path in "${paths[@]}"; do [[ ! -e /$path ]] || existing+=("$path"); done
  tar -cpf "$state/files.tar" -C / --files-from /dev/null "${existing[@]}"
  touch "$state/ready"
fi
# Failed installation rolls back this layer, never the desktop or hardware setup.
trap 'code=$?; trap - ERR; flock -u 9; bash scripts/install-system-appearance.sh --restore || echo "Rollback incomplete; backup retained in $state" >&2; exit "$code"' ERR
install -d /usr/local/share/macbook-zorin /usr/share/plymouth/themes/macbook-apple
if [[ ! -f $gdm ]]; then cp --dereference "$(sed -n 's/^Value: //p' "$state/gdm-theme.gresource")" "$gdm"; fi
update-alternatives --install /usr/share/gnome-shell/gdm-theme.gresource gdm-theme.gresource "$gdm" 15
cat > /usr/share/gdm/dconf/99-macbook-zorin <<'CONF'
[org/gnome/login-screen]
logo=''
[org/gnome/desktop/interface]
gtk-theme='MacBook-WhiteSur-Dark'
icon-theme='Adwaita'
CONF
bash scripts/install-login-layout.sh
install -m644 assets/boot/*.png /usr/share/plymouth/themes/macbook-apple/
install -m644 config/macbook.script /usr/share/plymouth/themes/macbook-apple/
install -m644 config/macbook-apple.plymouth "$boot"
update-alternatives --install /usr/share/plymouth/themes/default.plymouth default.plymouth "$boot" 150
update-alternatives --set default.plymouth "$boot"
update-initramfs -u -k all
touch "$state/installed"
trap - ERR
echo 'Boot splash and GDM installed. Applies at next reboot; no sessions restarted.'
