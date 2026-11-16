#!/usr/bin/python3
"""User-local Firefox Flatpak integration; no injected or fabricated menu items."""
from pathlib import Path
import configparser, json, os, re, shutil, subprocess, sys
HOME=Path.home()
ROOT=Path(__file__).resolve().parents[1]
APP='org.mozilla.firefox'
base=HOME/'.var/app'/APP/'config'
lib=base/'familiarmac-menu/lib'
state=HOME/'.local/state/familiarmac/firefox-menu'
marker='// BEGIN FamiliarMac global menu'
end='// END FamiliarMac global menu'
def refresh():
    lib.mkdir(parents=True,exist_ok=True)
    for name in ('libdbusmenu-glib.so.4','libdbusmenu-gtk3.so.4'):
        src=Path('/usr/lib')/subprocess.check_output(['gcc','-dumpmachine'],text=True).strip()/name
        dst=lib/name
        if not dst.exists() or dst.read_bytes()!=src.read_bytes(): shutil.copy2(src,dst)
    # Seed only a genuinely empty first installation, never replace an existing profile.
    parents = (base/'mozilla/firefox', HOME/'.var/app'/APP/'.mozilla/firefox')
    if not any((p/'profiles.ini').exists() or (p.exists() and any(p.iterdir())) for p in parents):
        parent = parents[0]
        (parent/'familiarmac.default').mkdir(parents=True, exist_ok=True)
        (parent/'profiles.ini').write_text('[General]\nStartWithLastProfile=1\nVersion=2\n\n[Profile0]\nName=default\nIsRelative=1\nPath=familiarmac.default\nDefault=1\n')
    for parent in parents:
        ini=parent/'profiles.ini'
        if not ini.exists(): continue
        cfg=configparser.ConfigParser();cfg.read(ini)
        for section in cfg.sections():
            if not section.startswith('Profile') or not cfg.has_option(section,'Path'): continue
            p=Path(cfg[section]['Path'])
            if cfg[section].get('IsRelative','1')=='1': p=parent/p
            if not p.is_dir(): continue
            dest=p/'user.js'; old=dest.read_text() if dest.exists() else ''
            # Keep the user's prefs and block unchanged if already installed.
            clean=re.sub(re.escape(marker)+r'.*?'+re.escape(end)+r'\n?', '', old, flags=re.S)
            state.mkdir(parents=True,exist_ok=True)
            backup=state/(p.name+'.user.js.before')
            if not backup.exists(): backup.write_text(old)
            text=clean.rstrip()+'\n'+marker+'\nuser_pref("widget.gtk.global-menu.enabled", true);\nuser_pref("browser.tabs.inTitlebar", 0);\n'+end+'\n'
            if text != old: dest.write_text(text)
if '--restore' in sys.argv:
    pairs=[(HOME/'.local/share/flatpak/overrides'/APP,'override'),(HOME/'.local/share/applications'/(APP+'.desktop'),'desktop')]
    for dest,name in pairs:
        expected=state/(name+'.installed')
        if not expected.exists() or not dest.exists() or dest.read_text()!=expected.read_text():
            raise SystemExit('Managed '+name+' changed externally; refusing automatic restore.')
    for dest,name in pairs:
        old=json.loads((state/(name+'.before.json')).read_text())
        if old is None:dest.unlink()
        else:dest.write_text(old)
    for parent in (base/'mozilla/firefox',HOME/'.var/app'/APP/'.mozilla/firefox'):
        for dest in parent.glob('*/user.js'):
            old=dest.read_text()
            dest.write_text(re.sub(re.escape(marker)+r'.*?'+re.escape(end)+r'\n?', '', old, flags=re.S))
    print('Managed Firefox overrides removed; restart Firefox to apply. Backups retained.')
    sys.exit()
if '--refresh' in sys.argv:
    refresh();sys.exit()
if not shutil.which('flatpak') or subprocess.run(['flatpak','info',APP],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
    print('Firefox Flatpak not installed; no changes.');sys.exit()
state.mkdir(parents=True,exist_ok=True)
refresh()
override=HOME/'.local/share/flatpak/overrides'/APP
backup=state/'override.before.json'
if not backup.exists(): backup.write_text(json.dumps(override.read_text() if override.exists() else None))
# Preserve any existing per-app library path instead of replacing its entries.
cfg=configparser.ConfigParser(interpolation=None);cfg.optionxform=str
if override.exists():cfg.read(override)
old=cfg.get('Environment','LD_LIBRARY_PATH',fallback='')
paths=[str(lib)]+[p for p in old.split(':') if p and p!=str(lib)]
subprocess.run(['flatpak','override','--user','--talk-name=com.canonical.AppMenu.Registrar',
                '--nosocket=wayland','--socket=x11','--env=MOZ_ENABLE_WAYLAND=0','--env=LD_LIBRARY_PATH='+':'.join(paths),APP],check=True)
# Persist preparation on every launcher invocation, including after updates.
helper=HOME/'.local/lib/familiarmac/firefox-global-menu.py'
helper.parent.mkdir(parents=True,exist_ok=True)
if Path(__file__).resolve()!=helper.resolve(): shutil.copy2(__file__,helper)
launcher=HOME/'.local/bin/familiarmac-firefox'
launcher.parent.mkdir(parents=True,exist_ok=True)
launcher.write_text('#!/usr/bin/python3\nimport os,subprocess,sys\nfrom pathlib import Path\nsubprocess.run(["/usr/bin/python3",str(Path.home()/".local/lib/familiarmac/firefox-global-menu.py"),"--refresh"],check=True)\nos.execv("/usr/bin/flatpak",["flatpak",*sys.argv[1:]])\n')
launcher.chmod(0o755)
src=Path('/var/lib/flatpak/exports/share/applications')/(APP+'.desktop')
if not src.exists():src=HOME/'.local/share/flatpak/exports/share/applications'/(APP+'.desktop')
dest=HOME/'.local/share/applications'/(APP+'.desktop')
saved=state/'desktop.before.json'
if not saved.exists():saved.write_text(json.dumps(dest.read_text() if dest.exists() else None))
# Read current vendor launcher on each explicit install; preserve every action.
text=src.read_text().replace('Exec=/usr/bin/flatpak ', 'Exec="'+str(launcher)+'" ')
dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(text)
(state/'override.installed').write_text(override.read_text())
(state/'desktop.installed').write_text(text)
print('Firefox integration installed; restart Firefox to activate. Existing browser was not stopped.')

