import importlib.util
from pathlib import Path
import tempfile
import gi
gi.require_version('Gtk','3.0')
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('bindings',root/'scripts/application-shortcuts.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as t:
 p=Path(t);a=p/'base.xml';b=p/'custom.xml'
 a.write_text('<keys><bind gaction="app.save" keys="&lt;Primary&gt;s"/><bind gaction="app.open" keys="&lt;Primary&gt;o"/><bind gaction="win.dialog(\'Export\')" keys="&lt;Primary&gt;e"/></keys>')
 b.write_text('<keys><bind gaction="app.save" keys="&lt;Primary&gt;o"/><bind gaction="win.dialog(\'Export\')" keys=""/></keys>')
 values=m.read_bindings([a,b]);assert values=={'app.save':'<Primary>o'},values
 b.write_text('<keys><bind gaction="app.save" keys="&lt;Primary&gt;z,&lt;Shift&gt;F2"/></keys>')
 values=m.read_bindings([a,b]);assert values['app.save']=='<Primary>z';assert values['win.dialog::Export']=='<Primary>e'
 assert a.read_text().startswith('<keys>')
print('Actual shortcut sources: targets, user overrides, unbinding, collision precedence and first displayed binding PASS')
