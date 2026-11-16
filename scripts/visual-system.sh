#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
repo=$PWD
[[ $EUID == 0 ]] || exit 1
state=/var/lib/macbook-zorin
mkdir -p "$state"
if [[ ${1:-install} == restore ]]; then
  if [[ -f "$state/gdm-original" ]]; then
    update-alternatives --set gdm-theme.gresource "$(cat "$state/gdm-original")"
    if [[ $(cat "$state/gdm-status") == auto ]]; then update-alternatives --auto gdm-theme.gresource; fi
  fi
  if [[ -f "$state/gdm-conf-original" ]]; then
    cp -a "$state/gdm-conf-original" /usr/share/gdm/dconf/99-macbook-zorin
  elif [[ -f "$state/gdm-conf-absent" ]]; then
    rm -f /usr/share/gdm/dconf/99-macbook-zorin
  fi
  /usr/share/gdm/generate-config
  exit 0
fi
if [[ ! -f "$state/gdm-original" ]]; then
  update-alternatives --query gdm-theme.gresource | sed -n 's/^Value: //p' > "$state/gdm-original"
  update-alternatives --query gdm-theme.gresource | sed -n 's/^Status: //p' > "$state/gdm-status"
fi
if [[ ! -f "$state/gdm-conf-original" && ! -f "$state/gdm-conf-absent" ]]; then
  if [[ -e /usr/share/gdm/dconf/99-macbook-zorin ]]; then cp -a /usr/share/gdm/dconf/99-macbook-zorin "$state/gdm-conf-original";
  else touch "$state/gdm-conf-absent"; fi
fi
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends sassc libglib2.0-dev-bin libxml2-utils gnome-screenshot xclip
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/gtk" "$tmp/icons"
tar -xzf vendor/whitesur-gtk.tar.gz -C "$tmp/gtk"
tar -xzf vendor/whitesur-icons.tar.gz -C "$tmp/icons"
# Upstream picks its GNOME 46 sources using the installed gnome-shell version.
bash "$tmp/gtk/install.sh" -d /usr/share/themes -n MacBook-WhiteSur -c dark -o normal --shell -i apple --silent-mode
bash "$tmp/icons/install.sh" -d /usr/share/icons -n MacBook-WhiteSur
dest=/usr/local/share/macbook-zorin
mkdir -p "$dest"
install -m644 assets/apple-login.png "$dest/apple-login.png"
install -m644 "$tmp/gtk/src/assets/gnome-shell/backgrounds/background-default.png" "$dest/wallpaper.png"
cp -a /usr/share/themes/MacBook-WhiteSur-Dark/gnome-shell "$tmp/gdm"
sed -i 's|url("assets/|url("resource:///org/gnome/shell/theme/assets/|g; s|url(assets/|url(resource:///org/gnome/shell/theme/assets/|g' "$tmp/gdm/gnome-shell.css"
glib-compile-resources --sourcedir="$tmp/gdm" --target="$tmp/gdm.gresource" "$tmp/gtk/src/main/gnome-shell/gnome-shell-theme.gresource.xml"
gresource list "$tmp/gdm.gresource" | grep -q '/org/gnome/shell/theme/gnome-shell.css'
install -m644 "$tmp/gdm.gresource" "$dest/gdm.gresource"
# Register our own resource; retain the distribution's original resources untouched.
update-alternatives --install /usr/share/gnome-shell/gdm-theme.gresource gdm-theme.gresource "$dest/gdm.gresource" 15
update-alternatives --set gdm-theme.gresource "$dest/gdm.gresource"
cat > /usr/share/gdm/dconf/99-macbook-zorin <<'EOF'
[org/gnome/login-screen]
logo='/usr/local/share/macbook-zorin/apple-login.png'
[org/gnome/desktop/interface]
gtk-theme='MacBook-WhiteSur-Dark'
icon-theme='MacBook-WhiteSur-dark'
EOF
/usr/share/gdm/generate-config
theme=/usr/share/plymouth/themes/macbook-apple
for frame in "$theme"/throbber-*.png "$theme"/animation-*.png; do install -m644 assets/apple.png "$frame"; done
update-initramfs -u
echo 'WhiteSur masaüstü/simge teması, GDM ve küçük Apple açılış logosu kuruldu. GDM yeniden başlatılmadı.'
bash scripts/refine-visuals.sh
