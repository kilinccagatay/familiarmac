#!/usr/bin/python3
import importlib.util,tempfile
from pathlib import Path
from unittest.mock import patch
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('native_qt',root/'scripts/native-qt-decorations.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
text='[Desktop Entry]\nType=Application\nName=Example\nExec=example --option %U\nActions=new;\n\n[Desktop Action new]\nExec=example --new\n'
s=m.launcher_text(text)
assert 'Exec=env QT_QPA_PLATFORM=xcb example --option %U' in s
assert 'Exec=env QT_QPA_PLATFORM=xcb example --new' in s
for command in ['env QT_QPA_PLATFORM=wayland example','example -platform wayland']:
 try:m.launcher_text(text.replace('example --option %U',command))
 except ValueError:pass
 else:raise AssertionError('Explicit platform must be preserved')
with tempfile.TemporaryDirectory() as d:
 p=Path(d)/'example';p.write_bytes(b'\x7fELFtest')
 with patch.object(m.shutil,'which',return_value=str(p)),patch.object(m.subprocess,'check_output',return_value='(NEEDED) Shared library: [libQt6Widgets.so.6]'),patch.object(Path,'glob',return_value=iter([Path('/fake/libqxcb.so')])):
  assert m.qt_major('example')=='6'
  # Simple env assignments retain detection without executing a wrapper.
  with patch.object(Path,'glob',return_value=iter([Path('/fake/libqxcb.so')])):
   assert m.qt_major('env FOO=bar example --arg')=='6'
  assert m.qt_major('env -u DISPLAY example') is None
 with patch.object(m.shutil,'which',return_value=str(p)),patch.object(m.subprocess,'check_output',return_value='(NEEDED) Shared library: [libgtk-3.so.0]'):
  assert m.qt_major('example') is None
 m.HOME=Path(d);m.STATE=m.HOME/'state';m.STATE.mkdir();target=m.HOME/'.local/share/applications/example.desktop';target.parent.mkdir(parents=True);target.write_text(s)
 import json
 rec=m.STATE/'example.desktop.json';rec.write_text(json.dumps({'before':None,'installed':s}))
 target.write_text(s+'# user edit\n')
 try:m.restore()
 except RuntimeError:pass
 else:raise AssertionError('Edited launcher must survive restore')
 assert target.exists();target.write_text(s);m.restore();assert not target.exists()
print('Native Qt: dependency detection, arguments/actions, explicit platform and rollback protection PASS')
