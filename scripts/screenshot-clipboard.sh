#!/usr/bin/env bash
set -euo pipefail
# Keep a real clipboard owner alive after GNOME Screenshot exits on Wayland.
# XWayland bridges the PNG selection to native Wayland applications.
temp=$(mktemp --suffix=.png)
trap 'rm -f "$temp"' EXIT
args=()
if [[ ${1:-} == --area ]]; then args+=(--area); fi
gnome-screenshot "${args[@]}" --file="$temp"
[[ -s $temp ]] || exit 0
xclip -selection clipboard -target image/png -in "$temp"
