#!/usr/bin/python3
import importlib.util
import tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('native_menu',Path(__file__).resolve().parents[1]/'scripts/native-menu-integrations.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
source='[Desktop Entry]\nName=Example\nExec=example %U\nDBusActivatable=true\n[Desktop Action private]\nName=Private\nExec=example --private %u\n'
result=m.launcher_text(source)
assert 'Exec=env GDK_BACKEND=x11 example %U' in result
assert 'Exec=env GDK_BACKEND=x11 example --private %u' in result
assert 'DBusActivatable=false' in result
# Restore must preserve unrelated user changes rather than silently replacing them.
import json
with tempfile.TemporaryDirectory() as tmp:
 m.HOME=Path(tmp);m.STATE=m.HOME/'state';m.STATE.mkdir()
 target=m.HOME/'.local/share/applications/example.desktop';target.parent.mkdir(parents=True);target.write_text(result)
 record=m.STATE/'example.json';data={'desktop':'example.desktop','before':None,'installed':result,'settings':[]};record.write_text(json.dumps(data))
 target.write_text('user change')
 try: m.restore()
 except RuntimeError: pass
 else: raise AssertionError('external edit was overwritten')
 assert target.read_text()=='user change'
 target.write_text(result);m.restore();assert not target.exists() and not record.exists()
print('Native menu profiles: launch arguments/actions, D-Bus bypass and guarded restore PASS')
