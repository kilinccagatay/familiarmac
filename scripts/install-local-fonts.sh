#!/usr/bin/env bash
# Opt-in local font import. Proprietary font files are never bundled/downloaded.
set -euo pipefail
[[ $EUID == 0 && $# == 1 && -d $1 ]] || { echo 'Usage: sudo bash scripts/install-local-fonts.sh /path/to/your/fonts'; exit 2; }
source_dir=$(realpath "$1")
cd -- "$(dirname -- "$0")/.."
dest=/usr/local/share/fonts/familiarmac-local
state=/var/lib/macbook-zorin/local-fonts
install -d -m755 "$dest"
install -d -m700 "$state"
[[ -f "$state/gdm.gresource" ]] || cp -a /usr/local/share/macbook-zorin/gdm.gresource "$state/gdm.gresource"
count=0
for file in "$source_dir"/*.otf "$source_dir"/*.ttf "$source_dir"/*.woff; do
  [[ -f "$file" ]] || continue
  fc-scan "$file" >/dev/null || { echo "Invalid font: $file"; exit 1; }
  install -m644 "$file" "$dest/"
  count=$((count+1))
done
[[ $count -gt 0 ]] || { echo 'No supported fonts supplied.'; exit 1; }
fc-cache -f "$dest"
bash scripts/refine-visuals.sh --gdm-only
echo 'Local fonts and clock style installed. No sessions restarted.'
