import importlib.util
from pathlib import Path
import tempfile
spec=importlib.util.spec_from_file_location('launchers',Path(__file__).resolve().parents[1]/'scripts/settings_launchers.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
    home=Path(d);base=home/'base';base.mkdir();system=home/'system';system.mkdir()
    text='[Desktop Entry]\nName=Appearance\nExec=gnome-control-center background\nDBusActivatable=true\nNoDisplay=true\n'
    source=system/'gnome-background-panel.desktop';source.write_text(text)
    wrapper=home/'space path/familiarmac-settings'
    dest=home/'.local/share/applications'/source.name
    m.install(base,home,wrapper,system)
    assert f'Exec="{wrapper}" background' in dest.read_text()
    assert 'DBusActivatable=false' in dest.read_text()
    m.install(base,home,wrapper,system);m.restore(base,home);assert not dest.exists()
    (base/'panel-launchers.json').unlink();dest.write_text(text+'# user original\n')
    m.install(base,home,wrapper,system);m.restore(base,home);assert dest.read_text()==text+'# user original\n'
    (base/'panel-launchers.json').unlink();m.install(base,home,wrapper,system);dest.write_text('user new edit')
    m.install(base,home,wrapper,system);m.restore(base,home);assert dest.read_text()=='user new edit'
assert m.rewrite('[Desktop Entry]\nExec=unrelated-app background\n',Path('/wrapper')) is None
print('Settings panel launchers: route, arguments, idempotence, restore and user-edit preservation PASS')
