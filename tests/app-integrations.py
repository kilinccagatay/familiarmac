#!/usr/bin/python3
"""Hermetic first-profile and installation-event tests; no desktop settings changed."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('dispatch',root/'scripts/app-integrations.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as temp:
    home=Path(temp);m.HOME=home
    native=home/'vendor';native.mkdir()
    local=home/'.local/share/applications';local.mkdir(parents=True)
    m.roots={'native':[native,local],'flatpak':[]}
    entries=[{'id':'managed'}]
    first=m.fingerprint(entries)
    (local/'managed.desktop').write_text('managed output')
    assert m.fingerprint(entries)==first, 'managed writes trigger loop'
    (native/'new.desktop').write_text('[Desktop Entry]\nName=New\n')
    second=m.fingerprint(entries)
    assert second!=first,'new install not detected'
    (local/'custom.desktop').write_text('[Desktop Entry]\nName=Custom\n')
    assert m.fingerprint(entries)!=second,'user install not detected'
    env=dict(os.environ,HOME=temp)
    command=['/usr/bin/python3',str(root/'scripts/firefox-global-menu.py'),'--refresh']
    subprocess.run(command,env=env,check=True)
    profile=home/'.var/app/org.mozilla.firefox/config/mozilla/firefox/familiarmac.default/user.js'
    assert 'browser.tabs.inTitlebar' in profile.read_text()
    profile.write_text('user_pref("personal.setting",42);\n'+profile.read_text())
    subprocess.run(command,env=env,check=True)
    text=profile.read_text()
    subprocess.run(command,env=env,check=True)
    assert profile.read_text()==text and text.count('// BEGIN FamiliarMac')==1
    assert 'personal.setting' in text
print('Installation events, self-write suppression, empty Firefox home and preference preservation PASS')
