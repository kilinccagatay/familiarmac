#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
repo=$PWD
temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT
tar -xzf vendor/keyd-2.6.0.tar.gz -C "$temp"
patch -d "$temp" -p1 < "$repo/patches/keyd-ipc-read.patch"
make -C "$temp" test-io
"$temp/bin/test-io" "$repo/config/apple.conf" "$repo"/tests/*.t
cc -DDATA_DIR='""' -iquote "$temp/src" -o "$temp/device-match" tests/device-match.c \
  "$temp"/src/{config,string,macro,log,ini,keys,unicode}.c
"$temp/device-match" "$repo/config/apple.conf"
cc -DDATA_DIR='""' -iquote "$temp/src" -o "$temp/screenshot-shortcuts" tests/screenshot-shortcuts.c \
  "$temp"/src/{keyboard,config,string,macro,log,ini,keys,unicode}.c
"$temp/screenshot-shortcuts" "$repo/config/apple.conf"
cc -DDATA_DIR='""' -iquote "$temp/src" -o "$temp/app-bindings" tests/app-bindings.c \
  "$temp"/src/{config,string,macro,log,ini,keys,unicode}.c
"$temp/app-bindings" "$repo/config/apple.conf" "$repo/config/app.conf"
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
def effective(cls,title):
    result={}
    for pattern,title_pattern,bindings in config:
        if fnmatch.fnmatch(cls,pattern) and fnmatch.fnmatch(title,title_pattern):
            for binding in bindings:
                key,value=binding.split('=',1);result[key.strip()]=value.strip()
    return result
for cls,title in [('gjs','desktop-icons-1'),('gjs','desktop-icons-2'),('com-rastersoft-ding','desktop-icons-1'),('org-gnome-nautilus','home')]:
    assert effective(cls,title)['command.backspace']=='C-A-S-backspace', (cls,title)
for cls,title in [('gjs','extension-preferences'),('other-app','desktop-icons-1')]:
    assert effective(cls,title)['command.backspace']=='macro(S-home backspace)'
assert effective('gnome-terminal-server','terminal')['command.backspace']=='C-u'
print('Application matching: desktop WM_CLASS/title, Finder, unrelated GJS, terminal and Ctrl+C preservation PASS')
PY
