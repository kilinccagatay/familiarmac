#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
repo=$PWD
temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT
tar -xzf vendor/keyd-2.6.0.tar.gz -C "$temp"
make -C "$temp" test-io
"$temp/bin/test-io" "$repo/config/apple.conf" "$repo"/tests/*.t
cc -DDATA_DIR='""' -iquote "$temp/src" -o "$temp/device-match" tests/device-match.c \
  "$temp"/src/{config,string,macro,log,ini,keys,unicode}.c
"$temp/device-match" "$repo/config/apple.conf"
cc -DDATA_DIR='""' -iquote "$temp/src" -o "$temp/screenshot-shortcuts" tests/screenshot-shortcuts.c \
  "$temp"/src/{keyboard,config,string,macro,log,ini,keys,unicode}.c
"$temp/screenshot-shortcuts" "$repo/config/apple.conf"
python3 - "$repo" <<'PY'
import ast, fnmatch, pathlib, sys
root=pathlib.Path(sys.argv[1])
# Test the actual upstream parser and normalized GNOME window-class match.
import tarfile
with tarfile.open(root/'vendor/keyd-2.6.0.tar.gz') as t:
    text=t.extractfile('./scripts/keyd-application-mapper').read().decode()
tree=ast.parse(text)
fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='parse_config')
namespace={}
exec(compile(ast.Module(body=[fn],type_ignores=[]),'<upstream-parser>','exec'),namespace)
config=namespace['parse_config'](root/'config/app.conf')
matches=[b for pattern,_,bindings in config if fnmatch.fnmatch('gnome-terminal-server',pattern) for b in bindings]
assert 'command.c = C-S-c' in matches
assert 'command.v = C-S-v' in matches
assert not any('control.c' in b for b in matches)
print('Terminal class match and Ctrl+C preservation: PASS')
PY
