#!/usr/bin/env bash
# macbook-zorin: GDM presentation overlay, never regular user sessions.
set -eu
base=/usr/local/share/macbook-zorin/login-layout
if [[ $(id -un) == gdm && -r "$base/library.sha256" ]]; then
  if sha256sum --status -c "$base/library.sha256"; then
    export G_RESOURCE_OVERLAYS="/org/gnome/shell/gdm=$base${G_RESOURCE_OVERLAYS:+:$G_RESOURCE_OVERLAYS}"
  else
    logger -t macbook-login 'GNOME version changed; using original login layout.'
  fi
fi
exec /usr/bin/gnome-shell "$@"
