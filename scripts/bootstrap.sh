#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || exit 1
apt-get update
apt-get install -y --no-install-recommends build-essential python3-gi nodejs gjs \
  gir1.2-dbusmenu-glib-0.4 libglib2.0-bin libglib2.0-dev-bin sassc libxml2-utils \
  gnome-screenshot xclip desktop-file-utils unzip
