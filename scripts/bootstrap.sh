#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || exit 1
apt-get update
apt-get install -y --no-install-recommends build-essential dconf-cli pkexec python3-gi python3-gi-cairo gir1.2-gtk-3.0 xwayland gnome-session-canberra nodejs gjs \
  gir1.2-dbusmenu-glib-0.4 libdbusmenu-glib4 libdbusmenu-gtk3-4 appmenu-gtk3-module appmenu-gtk2-module libglib2.0-bin libglib2.0-dev-bin sassc libxml2-utils \
  gnome-characters gnome-screenshot xclip desktop-file-utils unzip
# Core does not preinstall the Dock; it is available in Zorin's shared repository.
# Preserve an existing supported Dock instead of upgrading it as a side effect.
if [[ ! -f /usr/share/gnome-shell/extensions/zorin-dash@zorinos.com/metadata.json ]]; then
  apt-get install -y --no-install-recommends gnome-shell-extension-zorin-dash
fi
