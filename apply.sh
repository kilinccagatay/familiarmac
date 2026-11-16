#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
case "${1:-}" in
  --desktop-only) shift; exec bash install.sh --desktop "$@";;
  --gui) shift; exec bash install.sh --full "$@";;
  *) exec bash install.sh "$@";;
esac
