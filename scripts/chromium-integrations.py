#!/usr/bin/python3
"""Shared Chromium Flatpak adapter; refresh profiles only when browser is stopped."""
from pathlib import Path
import json, os, re, shutil, subprocess, sys
HOME=Path.home()
APPS={'com.google.Chrome':'google-chrome','org.chromium.Chromium':'chromium','com.brave.Browser':'BraveSoftware/Brave-Browser','io.github.ungoogled_software.ungoogled_chromium':'chromium'}
STATE=HOME/'.local/state/familiarmac/chromium'

def refresh(app):
    base=HOME/'.var/app'/app/'config'/APPS[app]
    # Chromium SingletonLock can be a dangling symlink; exists() is insufficient.
    if os.path.lexists(base/'SingletonLock'):
        print(app+': running/locked profile; decoration change deferred until next launch.');return
    profiles=list(base.glob('*/Preferences'))
    if not profiles: profiles=[base/'Default/Preferences']
    for path in profiles:
        data=json.loads(path.read_text()) if path.exists() else {}
        browser=data.setdefault('browser',{})
        if not isinstance(browser,dict):continue
        record=STATE/app/(path.parent.name+'.json');record.parent.mkdir(parents=True,exist_ok=True)
        if not record.exists():record.write_text(json.dumps({'path':str(path),'had_value':'custom_chrome_frame' in browser,'before':browser.get('custom_chrome_frame')}))
        if browser.get('custom_chrome_frame') is False:continue
        browser['custom_chrome_frame']=False
        path.parent.mkdir(parents=True,exist_ok=True)
        tmp=path.with_name('Preferences.familiarmac-tmp');tmp.write_text(json.dumps(data));tmp.chmod(0o600);tmp.replace(path)

def apply():
    helper=HOME/'.local/lib/familiarmac/chromium-integrations.py';helper.parent.mkdir(parents=True,exist_ok=True)
    if Path(__file__).resolve()!=helper.resolve():shutil.copy2(__file__,helper)
    launcher=HOME/'.local/bin/familiarmac-chromium';launcher.parent.mkdir(parents=True,exist_ok=True)
    launcher.write_text('#!/usr/bin/python3\nimport os,subprocess,sys\nfrom pathlib import Path\napp=sys.argv[1]\nsubprocess.run(["/usr/bin/python3",str(Path.home()/".local/lib/familiarmac/chromium-integrations.py"),"--refresh",app],check=True)\nos.execv("/usr/bin/flatpak",["flatpak",*sys.argv[2:]])\n');launcher.chmod(0o755)
    for app in APPS:
        sources=[HOME/'.local/share/flatpak/exports/share/applications'/(app+'.desktop'),Path('/var/lib/flatpak/exports/share/applications')/(app+'.desktop')]
        src=next((p for p in sources if p.is_file()),None)
        if src is None:continue
        refresh(app)
        state=STATE/app;state.mkdir(parents=True,exist_ok=True)
        dest=HOME/'.local/share/applications'/(app+'.desktop');dest.parent.mkdir(parents=True,exist_ok=True)
        backup=state/'launcher.json'
        old=json.loads(backup.read_text()) if backup.exists() else {'before':dest.read_text() if dest.exists() else None}
        # Preserve vendor desktop actions and URL/file forwarding. Browser flags
        # must follow the application ID, never precede flatpak's run command.
        text=src.read_text()
        lines=[]
        for line in text.splitlines(keepends=True):
            if line.startswith('Exec=/usr/bin/flatpak '):
                line=line.replace('Exec=/usr/bin/flatpak ',f'Exec="{launcher}" {app} ',1)
                prefix=f'Exec="{launcher}" {app} '
                rest=line[len(prefix):]
                rest=re.sub(r'(?<!\S)'+re.escape(app)+r'(?=\s|$)',app+' --ozone-platform=x11',rest,count=1)
                line=prefix+rest
            lines.append(line)
        text=''.join(lines);old['installed']=text;backup.write_text(json.dumps(old))
        if not dest.exists() or dest.read_text()!=text:dest.write_text(text)
        print(app+': system frame and X11 menu launcher prepared.')

def restore():
    for app in APPS:
        state=STATE/app
        base=HOME/'.var/app'/app/'config'/APPS[app]
        if os.path.lexists(base/'SingletonLock'):raise SystemExit('Close '+app+' before restore.')
        for record in state.glob('*.json'):
            r=json.loads(record.read_text())
            if record.name=='launcher.json':
                path=HOME/'.local/share/applications'/(app+'.desktop')
                if path.exists() and path.read_text()!=r['installed']:raise SystemExit('Launcher changed externally: '+app)
                if r['before'] is None:path.unlink(missing_ok=True)
                else:path.write_text(r['before'])
            else:
                path=Path(r['path'])
                if path.exists():
                    data=json.loads(path.read_text());browser=data.get('browser',{})
                    if browser.get('custom_chrome_frame') is False:
                        if r['had_value']:browser['custom_chrome_frame']=r['before']
                        else:browser.pop('custom_chrome_frame',None)
                        path.write_text(json.dumps(data))
            record.unlink()
if __name__=='__main__':
    if '--restore' in sys.argv:restore()
    elif '--refresh' in sys.argv:
        app=sys.argv[-1]
        if app not in APPS:raise SystemExit('Unsupported Chromium application')
        refresh(app)
    else:apply()
