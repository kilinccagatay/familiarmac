from pathlib import Path
import tempfile, importlib.util, json
spec=importlib.util.spec_from_file_location('snap',Path(__file__).resolve().parents[1]/'scripts/snap-appearance.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as t:
 m.HOME=Path(t);m.STATE=m.HOME/'state';m.running=lambda name:False
 p=m.HOME/'snap/bluebubbles/current/.local/share/app.bluebubbles.BlueBubbles/shared_preferences.json'
 p.parent.mkdir(parents=True);p.write_text(json.dumps({'serverAddress':'preserve-me','titleBarStyle':1}))
 r=m.STATE/'bluebubbles-titlebar.json'
 m.set_native(p,r);assert json.loads(p.read_text())=={'serverAddress':'preserve-me','titleBarStyle':0}
 d=json.loads(p.read_text());d['other']=42;p.write_text(json.dumps(d));m.restore()
 assert json.loads(p.read_text())=={'serverAddress':'preserve-me','titleBarStyle':1,'other':42}
 p.write_text('{"titleBarStyle":2}');m.set_native(p,r);assert json.loads(p.read_text())[m.KEY]==2
 p.write_text('{}');m.set_native(p,r);m.restore();assert json.loads(p.read_text())=={}
 css=m.HOME/'snap/bluebubbles/current/.config/gtk-3.0/gtk.css';css.parent.mkdir(parents=True);css.write_text('FamiliarMac shared controls')
 src=m.HOME/'.config/gtk-3.0/familiarmac-controls/close.svg';src.parent.mkdir(parents=True);src.write_text('one')
 m.apply();dst=css.parent/'familiarmac-controls/close.svg';assert dst.read_text()=='one'
 src.write_text('two');m.apply();assert dst.read_text()=='two';m.restore();assert not dst.exists()
 print('Snap appearance: preference isolation, user choice, asset refresh and rollback passed')
from unittest.mock import patch
from types import SimpleNamespace
with tempfile.TemporaryDirectory() as t:
 m.HOME=Path(t);m.STATE=m.HOME/'state'
 profile=m.HOME/'snap/sample/current';profile.mkdir(parents=True)
 (profile/'.themes').symlink_to('/snap/sample/1/data-dir/themes')
 source=m.HOME/'.themes/Test-Dark/gtk-3.0';source.mkdir(parents=True)
 (source/'gtk.css').write_text('headerbar { color: white; }')
 with patch.object(m.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout="'Test-Dark'\n")):
  m.mirror_theme(profile)
  dest=profile/'.themes/Test-Dark/gtk-3.0/gtk.css'
  assert dest.read_text()==(source/'gtk.css').read_text()
  (source/'gtk.css').write_text('updated');m.mirror_theme(profile);assert dest.read_text()=='updated'
  m.restore();assert (profile/'.themes').is_symlink()
 print('Snap theme: sandbox copy, refresh and original link restoration passed')
