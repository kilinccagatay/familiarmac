import importlib.util,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('appearance',root/'scripts/flatpak-appearance.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as t:
 home=Path(t);p=home/'.var/app/example.App/config/gtk-4.0/gtk.css';p.parent.mkdir(parents=True);p.write_text('/* user CSS */\nbutton { font-weight: bold; }\n')
 before=p.read_text();m.apply(home,['example.App'],root/'config');first=p.read_text();mtime=p.stat().st_mtime_ns
 m.apply(home,['example.App'],root/'config');assert p.read_text()==first;assert p.stat().st_mtime_ns==mtime
 assert before.strip() in first;assert first.count(m.BEGIN)==1
 assert (p.parent/'familiarmac-controls/close.svg').is_file()
 assert 'background-size: 14px 14px' in first
 assert '@import' not in first,'host-only theme path leaked into sandbox'
 m.restore(home);assert p.read_text()==before
 m.apply(home,['example.App'],root/'config');p.write_text(p.read_text()+'/* later user change */\n');m.restore(home)
 assert 'later user change' in p.read_text();assert m.BEGIN not in p.read_text()
print('Shared Flatpak CSS: preservation, idempotency, no host imports, safe restore PASS')

with tempfile.TemporaryDirectory() as t:
 home=Path(t);p=home/'.config/gtk-4.0/gtk.css';p.parent.mkdir(parents=True)
 p.write_text('/* existing host theme */\n');before=p.read_text()
 m.apply(home,[],root/'config',include_native=True);first=p.read_text()
 assert before.strip() in first and first.count(m.BEGIN)==1
 assert (p.parent/'familiarmac-controls/close.svg').is_file()
 m.apply(home,[],root/'config',include_native=True);assert p.read_text()==first
 assert 'GTK4: 16px hit node' not in (home/'.config/gtk-3.0/gtk.css').read_text()
 m.restore(home);assert p.read_text()==before
print('Shared native GTK controls: theme preservation, repeat install and restore PASS')
