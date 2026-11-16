#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || exit 1
apt-get update
apt-get install -y --no-install-recommends build-essential python3-gi python3-gi-cairo gir1.2-gtk-3.0 xwayland gnome-session-canberra nodejs gjs \
  gir1.2-dbusmenu-glib-0.4 libdbusmenu-glib4 libdbusmenu-gtk3-4 appmenu-gtk3-module appmenu-gtk2-module libglib2.0-bin libglib2.0-dev-bin sassc libxml2-utils \
  gnome-screenshot xclip desktop-file-utils unzip
