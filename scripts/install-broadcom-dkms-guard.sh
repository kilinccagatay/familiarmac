#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || exit 1
root=$(cd "$(dirname "$0")/.." && pwd)
config=/etc/dkms/broadcom-sta.conf
helper=/usr/local/lib/familiarmac/broadcom-dkms-build
state=/var/lib/macbook-zorin/broadcom-dkms-guard
[[ ! -e "$config" ]] || grep -q '^# FamiliarMac wrapper metadata guard$' "$config" || { echo 'Existing administrator DKMS override; refusing to replace.'; exit 1; }
install -d -m700 "$state"
install -D -m755 "$root/scripts/broadcom-dkms-build" "$helper"
cat > "$config" <<'CFG'
# FamiliarMac wrapper metadata guard
# Preserve the package's build command; updates replacing /usr/src are supported.
MAKE[0]="/usr/local/lib/familiarmac/broadcom-dkms-build ${MAKE[0]}"
CFG
# Return the vendor source to its original bytes: subsequent builds patch only
# their disposable DKMS copy. Do not overwrite an independently updated package.
src=/usr/src/broadcom-sta-6.30.223.271/Makefile
backup=/var/lib/macbook-zorin/broadcom-return-sites/7.0.0-43-generic/Makefile
if [[ -f "$backup" ]] && grep -q '^# FamiliarMac: annotate compiled wrappers' "$src"; then
    cp -a "$src" "$state/patched-Makefile"
    cp -a "$backup" "$src"
fi
dkms build -m broadcom-sta -v 6.30.223.271 -k "$(uname -r)" --force
echo 'Persistent DKMS build guard validated. Running module unchanged.'
