#!/usr/bin/env python3
"""Pure configuration tests: no desktop changes."""
import importlib.util
from pathlib import Path
import tempfile
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('responsive',root/'scripts/install-smooth-scrolling.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
a='// existing settings\nuser_pref("widget.gtk.global-menu.enabled", true);\n'
b=m.firefox_text(a)
assert a in b and 'general.smoothScroll", false' in b
assert m.firefox_text(b)==b
x='Name=ChatGPT\nExec=chatgpt --enable-smooth-scrolling %U\n'
y=m.launcher_text(x)
assert '--enable-smooth' not in y and '--disable-smooth-scrolling %U' in y
assert m.launcher_text(y)==y
with tempfile.TemporaryDirectory() as d:
 h=Path(d);base=h/'.var/app/org.mozilla.firefox/config/mozilla/firefox';base.mkdir(parents=True)
 (base/'profile').mkdir();(base/'profiles.ini').write_text('[Profile0]\nPath=profile\nIsRelative=1\n')
 assert m.firefox_profiles(h)==[base/'profile/user.js']
spec=importlib.util.spec_from_file_location('wsf',root/'scripts/install-wsf.py')
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
with tempfile.TemporaryDirectory() as d:
 w.OLD_LIB=Path(d)/'scroll-scale.so';w.OLD_DROP=Path(d)/'90-macbook-scroll.conf'
 w.check_legacy()
 w.OLD_DROP.write_text('[Service]\nEnvironment=OTHER=keep\n')
 try:w.check_legacy()
 except SystemExit:pass
 else:raise AssertionError('Must protect edited drop-in')
 w.OLD_DROP.unlink();w.OLD_LIB.write_bytes(b'not ours')
 try:w.check_legacy()
 except SystemExit:pass
 else:raise AssertionError('Must protect unknown library')
 assert w.OLD_LIB.exists()
print('Responsive scrolling: idempotence, preservation, Flatpak profiles, unknown legacy protection PASS')
