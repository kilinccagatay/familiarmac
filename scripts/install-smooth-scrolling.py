#!/usr/bin/env python3
"""Legacy entry name: install responsive scrolling, never enable animation."""
from pathlib import Path
import configparser
import json
import re
import subprocess
import sys

HOME=Path.home()
STATE=HOME/'.local/state/macbook-zorin/responsive-scrolling.json'
START='// BEGIN FamiliarMac responsive scrolling'
END='// END FamiliarMac responsive scrolling'

def firefox_profiles(home):
    bases=[home/'.mozilla/firefox',home/'.config/mozilla/firefox',home/'.var/app/org.mozilla.firefox/config/mozilla/firefox',home/'.var/app/org.mozilla.firefox/.mozilla/firefox']
    found=set()
    for base in bases:
        ini=base/'profiles.ini'
        if not ini.exists(): continue
        config=configparser.ConfigParser(interpolation=None);config.read(ini)
        for section in config.sections():
            if not section.startswith('Profile') or not config.has_option(section,'Path'):continue
            p=Path(config.get(section,'Path'))
            if config.getboolean(section,'IsRelative',fallback=True):p=base/p
            if p.is_dir():found.add(p/'user.js')
    return sorted(found)

def firefox_text(text):
    block=START+'\nuser_pref("general.smoothScroll", false);\n'+END
    if START in text:
        if END not in text:raise ValueError('Incomplete managed Firefox block')
        return re.sub(re.escape(START)+r'.*?'+re.escape(END),lambda m:block,text,flags=re.S)
    return text+'\n'+block+'\n'

def launcher_text(text):
    def change(m):
        line=m[0].replace('--enable-smooth-scrolling','--disable-smooth-scrolling')
        if '--disable-smooth-scrolling' not in line:
            line=re.sub(r'^(Exec=(?:"[^"]+"|\S+))',r'\1 --disable-smooth-scrolling',line)
        return line
    return re.sub(r'^Exec=.*$',change,text,flags=re.M)

def main():
    if '--restore' in sys.argv:
        if not STATE.exists():raise SystemExit('No responsive-scrolling installation.')
        saved=json.loads(STATE.read_text())
        for name,r in saved.items():
            p=Path(name)
            if not p.exists() or p.read_text()!=r['installed']:raise SystemExit(f'Edited file; refusing restore: {p}')
        for name,r in saved.items():
            p=Path(name)
            if r['before'] is None:p.unlink()
            else:p.write_text(r['before'])
        STATE.unlink()
        print('Files restored. Reset general.smoothScroll in Firefox about:config if Firefox already loaded it; fully reopen apps.')
        return
    saved=json.loads(STATE.read_text()) if STATE.exists() else {}
    plans={}
    for p in firefox_profiles(HOME):
        before=p.read_text() if p.exists() else None
        plans[p]=(before,firefox_text(before or ''))
    apps=HOME/'.local/share/applications'
    # Only the applications for which the prior installer added this animation.
    legacy=HOME/'.local/state/macbook-zorin/smooth-scrolling.json'
    old=json.loads(legacy.read_text()) if legacy.exists() else {}
    names=set(old)|{'chatgpt.desktop'}
    for name in names:
        p=apps/name
        system=Path('/usr/share/applications')/name
        if not p.exists() and not system.exists():continue
        before=p.read_text() if p.exists() else None
        source=before if before is not None else system.read_text()
        after=launcher_text(source)
        baseline=before
        if name in old and source==old[name]['installed']:
            baseline=old[name]['previous']
        # The removed FamiliarMac enable flag must not be reinstated on rollback.
        if baseline is not None:baseline=baseline.replace(' --enable-smooth-scrolling','')
        plans[p]=(baseline,after)
    for p,(before,after) in plans.items():
        if str(p) in saved and p.read_text() not in (saved[str(p)]['installed'],after):
            raise SystemExit(f'Edited managed file; refusing overwrite: {p}')
    for p,(before,after) in plans.items():
        saved.setdefault(str(p),{'before':before})['installed']=after
    STATE.parent.mkdir(parents=True,exist_ok=True)
    STATE.write_text(json.dumps(saved,indent=2));STATE.chmod(0o600)
    for p,(_,after) in plans.items():
        p.parent.mkdir(parents=True,exist_ok=True);p.write_text(after)
    subprocess.run(['update-desktop-database',str(apps)],check=True)
    print('Responsive scrolling saved. Fully reopen affected applications; ChatGPT result still needs physical verification.')

if __name__=='__main__':main()
