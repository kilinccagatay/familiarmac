#!/usr/bin/env bash
# Reversible host-specific boot preference; never removes/holds kernel packages.
set -euo pipefail
[[ $EUID == 0 ]] || exit 2
file=/etc/default/grub.d/95-familiarmac-kernel.cfg
state=/var/lib/macbook-zorin/kernel-preference
install -d -m700 "$state"
[[ ! -f $file ]] || grep -Fxq '# FamiliarMac: selected installed kernel' "$file" || exit 2
cp -p /boot/grub/grub.cfg "$state/grub.cfg.before"
if [[ -f $file ]]; then cp -p "$file" "$state/preference.before"; else rm -f "$state/preference.before"; fi
if [[ ${1:-} == --restore ]]; then
    rm -f "$file"
else
    kernel=${1:?Specify an installed kernel or --restore}
    [[ $kernel =~ ^[0-9]+\.[0-9]+\.[0-9]+-[0-9]+-generic$ ]] || exit 2
    [[ -f /boot/vmlinuz-$kernel && -f /boot/initrd.img-$kernel ]] || exit 2
    modinfo -k "$kernel" nouveau >/dev/null
    modinfo -k "$kernel" wl >/dev/null
    entry=$(python3 - "$kernel" <<'PY'
import re,sys
from pathlib import Path
text=Path('/boot/grub/grub.cfg').read_text()
sub=re.findall(r"\b(gnulinux-advanced-[a-fA-F0-9-]+)\b",text)
entries=re.findall(r"\b(gnulinux-"+re.escape(sys.argv[1])+r"-advanced-[a-fA-F0-9-]+)\b",text)
if not sub or not entries:raise SystemExit('Installed kernel entry not found')
print(sub[0]+'>'+entries[0])
PY
)
    printf '# FamiliarMac: selected installed kernel\nGRUB_DEFAULT="%s"\n' "$entry" > "$file"
fi
if ! update-grub || ! grub-script-check /boot/grub/grub.cfg; then
    if [[ -f $state/preference.before ]]; then cp -p "$state/preference.before" "$file"; else rm -f "$file"; fi
    cp -p "$state/grub.cfg.before" /boot/grub/grub.cfg
    exit 1
fi
grub-editenv /boot/grub/grubenv unset next_entry
printf 'Boot preference updated; no restart performed.\n'
