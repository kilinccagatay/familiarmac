#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
[[ $EUID == 0 ]] || exit 1
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cp -a /usr/share/themes/MacBook-WhiteSur-Dark/gnome-shell "$tmp/theme"
install -m644 /usr/local/share/macbook-zorin/wallpaper.png "$tmp/theme/assets/background.png"
cat config/gdm.css >> "$tmp/theme/gnome-shell.css"
sed -i 's|url("assets/|url("resource:///org/gnome/shell/theme/assets/|g; s|url(assets/|url(resource:///org/gnome/shell/theme/assets/|g' "$tmp/theme/gnome-shell.css"
python3 - "$tmp/theme" <<'PY'
import sys, pathlib, xml.etree.ElementTree as ET
p=pathlib.Path(sys.argv[1]); root=ET.Element('gresources'); resource=ET.SubElement(root,'gresource',prefix='/org/gnome/shell/theme')
for f in sorted(p.rglob('*')):
    if f.is_file(): ET.SubElement(resource,'file').text=str(f.relative_to(p))
for name in ['gdm.css','gdm-dark.css','gdm-light.css','gdm-high-contrast.css','gnome-shell-dark.css','gnome-shell-light.css']:
    ET.SubElement(resource,'file',alias=name).text='gnome-shell.css'
ET.ElementTree(root).write(p.parent/'theme.xml',encoding='utf-8',xml_declaration=True)
PY
glib-compile-resources --sourcedir="$tmp/theme" --target="$tmp/gdm.gresource" "$tmp/theme.xml"
gresource extract "$tmp/gdm.gresource" /org/gnome/shell/theme/gdm.css > "$tmp/check.css"
grep -q 'Local GDM refinement' "$tmp/check.css"
install -m644 "$tmp/gdm.gresource" /usr/local/share/macbook-zorin/gdm.gresource
update-alternatives --set gdm-theme.gresource /usr/local/share/macbook-zorin/gdm.gresource
sed -i "s|^logo=.*|logo=''|" /usr/share/gdm/dconf/99-macbook-zorin
sed -i "s|^icon-theme=.*|icon-theme='Adwaita'|" /usr/share/gdm/dconf/99-macbook-zorin
/usr/share/gdm/generate-config
[[ ${1:-all} == --gdm-only ]] && exit 0
theme=/usr/share/plymouth/themes/macbook-apple
install -m644 assets/boot/*.png "$theme/"
install -m644 config/macbook.script "$theme/macbook.script"
install -m644 config/macbook-apple.plymouth "$theme/macbook-apple.plymouth"
update-initramfs -u
echo 'GDM css aliases and Apple progress theme installed.'
