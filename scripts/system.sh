#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
repo=$PWD
[[ $EUID == 0 ]] || { echo 'Yönetici yetkisi gerekiyor.' >&2; exit 1; }
target_user=${2:-${SUDO_USER:-}}
state=/var/lib/macbook-zorin
mkdir -p "$state"
chmod 700 "$state"
backup() {
  local path=$1 name=$2
  if [[ ! -e "$state/$name.saved" ]]; then
    if [[ -e $path ]]; then cp -a "$path" "$state/$name"; else touch "$state/$name.absent"; fi
    touch "$state/$name.saved"
  fi
}
restore_file() {
  local path=$1 name=$2
  [[ -e "$state/$name.saved" ]] || return 0
  if [[ -e "$state/$name.absent" ]]; then rm -f "$path"; else cp -a "$state/$name" "$path"; fi
}
if [[ ${1:-install} == restore ]]; then
  if [[ -f "$state/chatgpt-renderer-menu/state.json" ]]; then
    python3 scripts/chatgpt-renderer-menu.py restore || echo "Renderer menu restore skipped: app changed." >&2
  fi
  if [[ -f "$state/chatgpt-global-menu/state.json" ]]; then
    python3 scripts/chatgpt-global-menu.py restore || echo 'Global menu patch restore skipped: app changed.' >&2
  fi
  if [[ -f "$state/chatgpt-frame/state.json" ]]; then
    if ! python3 scripts/chatgpt-frame.py restore; then
      echo 'ChatGPT dosyası değişti; uygulama geri alınmadı. Diğer ayarlar geri alınıyor.' >&2
    fi
  fi
  if [[ -f "$state/gdm-original" ]]; then bash scripts/visual-system.sh restore; fi
  systemctl disable --now keyd || true
  restore_file /etc/keyd/macbook.conf keyd-conf
  restore_file /etc/libinput/local-overrides.quirks quirks
  restore_file /etc/modprobe.d/macbook-zorin.conf hid-apple
  if [[ -f "$state/plymouth-original" ]]; then
    update-alternatives --set default.plymouth "$(cat "$state/plymouth-original")"
  fi
  if [[ -f "$state/group-added" ]]; then gpasswd -d "$(cat "$state/group-added")" keyd || true; fi
  update-initramfs -u
  echo 'Sistem ayarları geri alındı. Yeniden başlatın.'
  exit 0
fi
[[ -n $target_user && $target_user != root ]] || { echo 'Kullanıcı adı gerekli.'; exit 1; }
id "$target_user" >/dev/null
[[ $(cat /sys/class/dmi/id/product_name) == MacBookPro10,1 ]] || { echo 'Bu profil MacBookPro10,1 için hazırlanmıştır.'; exit 1; }
if [[ ! -e "$state/installed" ]] && { command -v keyd >/dev/null || [[ -d /etc/keyd ]]; }; then
  echo 'Mevcut keyd kurulumu var; üzerine yazılmadı.' >&2; exit 1
fi
backup /etc/keyd/macbook.conf keyd-conf
backup /etc/libinput/local-overrides.quirks quirks
backup /etc/modprobe.d/macbook-zorin.conf hid-apple
if [[ ! -f "$state/plymouth-original" ]]; then readlink -f /etc/alternatives/default.plymouth > "$state/plymouth-original"; fi

if ! command -v cc >/dev/null || ! command -v make >/dev/null; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends build-essential
fi
build=$(mktemp -d)
trap 'rm -rf "$build"' EXIT
tar -xzf vendor/keyd-2.6.0.tar.gz -C "$build"
patch -d "$build" -p1 < "$repo/patches/keyd-ipc-read.patch"
make -C "$build" COMMIT=7c0aecb
"$build/bin/keyd" check "$repo/config/apple.conf"
make -C "$build" COMMIT=7c0aecb install
touch "$state/installed"
install -Dm644 config/apple.conf /etc/keyd/macbook.conf
if ! id -nG "$target_user" | tr ' ' '\n' | grep -qx keyd; then
  usermod -aG keyd "$target_user"
  printf '%s\n' "$target_user" > "$state/group-added"
fi
mkdir -p /etc/libinput
if ! grep -q '^\[MacBook Zorin keyd\]' /etc/libinput/local-overrides.quirks 2>/dev/null; then
cat >> /etc/libinput/local-overrides.quirks <<'EOF'

[MacBook Zorin keyd]
MatchUdevType=keyboard
MatchName=keyd*keyboard
AttrKeyboardIntegration=internal
EOF
fi
printf '%s\n' 'options hid_apple fnmode=1' > /etc/modprobe.d/macbook-zorin.conf

# Use the distribution's two-step theme so disk-unlock and update prompts remain intact.
theme=/usr/share/plymouth/themes/macbook-apple
mkdir -p "$theme"
cp -a /usr/share/plymouth/themes/zorin-logo/. "$theme/"
cp /usr/share/plymouth/themes/zorin-logo/zorin-logo.plymouth "$theme/macbook-apple.plymouth"
sed -i -e 's/Name=Zorin Logo/Name=MacBook Apple/' \
  -e 's@ImageDir=.*@ImageDir=/usr/share/plymouth/themes/macbook-apple@' \
  -e 's/UseFirmwareBackground=true/UseFirmwareBackground=false/g' \
  -e 's/UseEndAnimation=true/UseEndAnimation=false/g' \
  -e 's/^VerticalAlignment=.*/VerticalAlignment=.45/' "$theme/macbook-apple.plymouth"
for frame in "$theme"/throbber-*.png "$theme"/animation-*.png; do cp assets/apple.png "$frame"; done
update-alternatives --install /usr/share/plymouth/themes/default.plymouth default.plymouth "$theme/macbook-apple.plymouth" 100
update-alternatives --set default.plymouth "$theme/macbook-apple.plymouth"
update-initramfs -u
systemctl daemon-reload
# Start only at the next login/reboot: the per-app mapper needs the new group membership.
systemctl enable keyd
touch "$state/complete"
echo 'Apple açılış teması ve keyd kuruldu. Etkinleşmesi için yeniden başlatın.'
bash scripts/visual-system.sh install
# Wi-Fi repair is a separate, explicit installer option.
