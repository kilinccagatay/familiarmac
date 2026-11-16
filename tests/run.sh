#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
NODE=${NODE:-node}
command -v "$NODE" >/dev/null || { echo 'Node 18+ required; set NODE=/path/to/node'; exit 1; }
sha256sum --check vendor/SHA256SUMS
for f in install.sh apply.sh restore.sh scripts/*.sh tests/*.sh; do bash -n "$f"; done
python3 - <<'CHECK'
import ast
from pathlib import Path
for p in list(Path('scripts').glob('*.py'))+list(Path('bridges').glob('*.py')):
    ast.parse(p.read_text(),filename=str(p))
CHECK
for f in extensions/macbook-menu@local/*.js extensions/familiarmac-icons@local/*.js overrides/rounded-window-corners/manager/*.js; do
  "$NODE" --input-type=module --check < "$f"
done
for f in tests/*.cjs; do
  [[ $f == tests/login-layout.cjs ]] && continue
  "$NODE" "$f"
done
bash scripts/test.sh
bash tests/scroll-scale.sh
python3 tests/installer-plan.py
git diff --check

python3 tests/brightness.py
