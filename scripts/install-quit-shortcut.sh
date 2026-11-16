#!/usr/bin/env bash
set -euo pipefail
# Change only the known wrong mapping; preserve all other local keyboard edits.
[[ $EUID == 0 ]] || exit 1
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/keyd/macbook.conf');s=p.read_text()
if 'q = A-f4' in s:
    backup=Path('/var/lib/macbook-zorin/keyd-before-quit.conf')
    if not backup.exists():backup.write_text(s)
    p.write_text(s.replace('q = A-f4','q = C-q'))
elif 'q = C-q' not in s:
    raise SystemExit('Unexpected Cmd+Q mapping; left untouched.')
PY
/usr/local/bin/keyd check /etc/keyd/macbook.conf
/usr/local/bin/keyd reload
