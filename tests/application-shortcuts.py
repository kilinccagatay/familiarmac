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
with tempfile.TemporaryDirectory() as t:
 p=Path(t)/'shortcutsrc'
 p.write_text('(file-version 1)\n# (action "file-new" "<Primary>n")\n# (action "file-open" "<Primary>o")\n(action "file-new" "<Primary>o")\n(action "file-save")\n# (action "file-save" "<Primary>s")\n')
 values=m.read_gimp_bindings(p)
 assert values=={'app.file-new':'<Primary>o'},values
 p.write_text('(file-version 99)\n# (action "file-open" "<Primary>o")\n')
 assert m.read_gimp_bindings(p)=={}
print('GIMP saved defaults, user overrides, explicit unbinding, collisions and unknown-version guard PASS')
with tempfile.TemporaryDirectory() as t:
 p=Path(t)/'accels.scm'
 p.write_text('; (gtk_accel_path "<Actions>/win.file.open" "<Primary>o")\n'
              '; (gtk_accel_path "<Actions>/win.file.save" "<Primary>s")\n'
              '(gtk_accel_path "<Actions>/win.file.open" "<Primary>s")\n'
              '(gtk_accel_path "<Actions>/win.document.go-to-tab(2)" "<Alt>3")\n'
              '(gtk_accel_path "<Actions>/Unrelated/Open" "<Primary>o")\n')
 values=m.read_gtk_accelmap([p])
 assert values=={'win.file.open':'<Primary>s','win.document.go-to-tab(2)':'<Alt>3'},values
 p.write_text(p.read_text()+'(gtk_accel_path "<Actions>/win.file.open" "")\n')
 assert 'win.file.open' not in m.read_gtk_accelmap([p])
print('Generic GTK accelmap: detailed IDs, defaults, overrides, targets, collisions and unbinding PASS')
with tempfile.TemporaryDirectory() as t:
 p=Path(t)/'application.py'
 prefix='class Editor(Adw.Application):\n    def do_startup(self):\n'
 p.write_text(prefix+'        self.set_accels_for_action("win.find", ["<Ctl>f"])\n        self.set_accels_for_action("win.save_as", ["<Ctl><Shift>s"])\n')
 assert m.read_python_gtk_bindings(p)=={'win.find':'<Primary>f','win.save_as':'<Primary><Shift>s'}
 p.write_text(p.read_text()+'        self.set_accels_for_action("win.find", [])\n')
 assert 'win.find' not in m.read_python_gtk_bindings(p)
 p.write_text(prefix+'        if user_setting:\n            self.set_accels_for_action("win.find", ["<Ctl>f"])\n')
 assert m.read_python_gtk_bindings(p)=={}
 p.write_text(prefix+'        self.set_accels_for_action("win.find", dynamic_keys)\n')
 assert m.read_python_gtk_bindings(p)=={}
 p.write_text(prefix+'        self.set_accels_for_action("win.find", ["<Ctl>f"])\n        self.set_accels_for_action("win.other", ["<Ctl>f"])\n')
 assert m.read_python_gtk_bindings(p)=={}
 p.write_text(prefix+'        self.set_accels_for_action("win.find", ["<Ctl>f"])\n    def rebind(self):\n        self.set_accels_for_action("win.find", ["F3"])\n')
 assert m.read_python_gtk_bindings(p)=={}
print('Static GTK binding reader: literal startup, exact underscore IDs, unbinding, conflicts, dynamic/conditional/later override rejection PASS')

builder = '''<interface><menu><item><attribute name="action">app.open</attribute><attribute name="accel">&lt;Control&gt;o</attribute></item><item><attribute name="label">Save</attribute><attribute name="accel">&lt;Control&gt;s</attribute></item></menu><object class="GtkShortcut"><property name="action"><object class="GtkNamedAction"><property name="action-name">win.find</property></object></property><property name="trigger">&lt;Control&gt;f</property></object></interface>'''
assert m.read_builder_bindings(builder) == {'app.open':'<Primary>o','win.find':'<Primary>f'}
print('GtkBuilder exact action/trigger extraction; no translated-label guessing PASS')
