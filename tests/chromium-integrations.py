import importlib.util,json,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('chromium',root/'scripts/chromium-integrations.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as temp:
 m.HOME=Path(temp);m.STATE=m.HOME/'state';app='com.google.Chrome'
 base=m.HOME/'.var/app'/app/'config/google-chrome';pref=base/'Default/Preferences'
 m.refresh(app);assert json.loads(pref.read_text())['browser']['custom_chrome_frame'] is False
 data=json.loads(pref.read_text());data['personal']={'keep':42};pref.write_text(json.dumps(data))
 (base/'SingletonLock').symlink_to('host-123456')
 before=pref.read_bytes();m.refresh(app);assert pref.read_bytes()==before,'running profile changed'
 (base/'SingletonLock').unlink();m.refresh(app)
 data=json.loads(pref.read_text());assert data['personal']=={'keep':42};assert data['browser']['custom_chrome_frame'] is False
 # New profiles are configured too, independently of the first profile's record.
 second=base/'Profile 1/Preferences';second.parent.mkdir();second.write_text('{"browser":{"custom_chrome_frame":true},"personal":17}')
 m.refresh(app);assert json.loads(second.read_text())['browser']['custom_chrome_frame'] is False
 # Explicit changes after adaptation are retained, not fought by the timer.
 data=json.loads(second.read_text());data['browser']['custom_chrome_frame']=True;second.write_text(json.dumps(data))
 before_second=second.read_bytes();m.refresh(app);assert second.read_bytes()==before_second
 # Put the managed value back to exercise the existing safe restore path.
 data['browser']['custom_chrome_frame']=False;second.write_text(json.dumps(data))
 before=pref.stat().st_mtime_ns;m.refresh(app);assert pref.stat().st_mtime_ns==before,'repeat rewrote profile'
 m.restore();assert 'custom_chrome_frame' not in json.loads(pref.read_text())['browser'];assert json.loads(pref.read_text())['personal']['keep']==42
print('Chromium: first-run profile, running-profile guard, preservation, idempotency and restore PASS')
