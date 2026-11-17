#!/usr/bin/python3
"""Supply shared GTK assets to Snap profiles and supported native-frame preferences.
Never patch Snap binaries, broaden permissions, or edit running app preferences.
"""
from pathlib import Path
import json
import hashlib
import shutil
import subprocess
import sys

HOME = Path.home()
STATE = HOME/'.local/state/familiarmac/snap-appearance'
KEY = 'titleBarStyle'

def running(name):
    for proc in Path('/proc').glob('[0-9]*'):
        try:
            exe = str((proc/'exe').resolve())
            if exe.startswith('/snap/'+name+'/'): return True
        except OSError: continue
    return False

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name+'.familiarmac-tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False))
    tmp.chmod(0o600)
    tmp.replace(path)

def set_native(path, record):
    if path.is_symlink(): return 'symlinked preferences retained'
    before = path.read_text() if path.exists() else None
    data = json.loads(before or '{}')
    if not isinstance(data, dict): raise ValueError('Expected preferences object')
    saved = json.loads(record.read_text()) if record.exists() else None
    if saved and data.get(KEY) != saved['installed']:
        return 'user frame preference retained'
    if data.get(KEY) == 0: return 'native frame already configured'
    # Native=0, custom=1, hidden=2 in the verified upstream enum. Preserve hidden.
    if KEY in data and (type(data[KEY]) is not int or data[KEY] != 1):
        return 'non-default frame preference retained'
    saved = saved or {'present': KEY in data, 'before': data.get(KEY), 'installed': 0}
    if running('bluebubbles'): return 'running; preferences deferred until exit'
    if (path.read_text() if path.exists() else None) != before:
        return 'concurrent edit retained'
    write_json(record, saved)
    data[KEY] = 0
    write_json(path, data)
    return 'native frame configured; restart required'

def theme_digest(folder):
    return {str(p.relative_to(folder)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in folder.rglob('*') if p.is_file()}

def mirror_theme(profile):
    # Keep the system-selected name: never force a dark theme/environment variable.
    result = subprocess.run(['gsettings', 'get', 'org.gnome.desktop.interface', 'gtk-theme'],
                            text=True, capture_output=True)
    name = result.stdout.strip().strip("'")
    if result.returncode or not name or '/' in name or name in ('.', '..'): return
    sources = [HOME/'.themes'/name, HOME/'.local/share/themes'/name, Path('/usr/share/themes')/name]
    source = next((p for p in sources if (p/'gtk-3.0/gtk.css').is_file()), None)
    if source is None: return
    dest = profile/'.themes'/name/'gtk-3.0'
    themes = profile/'.themes'
    link_record = STATE/profile.parent.name/'themes-link.json'
    if themes.is_symlink():
        target = str(themes.readlink())
        # Only replace the standard Snap-owned theme link, retaining it for restore.
        if not target.startswith('/snap/') or not target.endswith('/themes'): return
        write_json(link_record, {'target': target})
        themes.unlink()
        themes.mkdir()
    record = STATE/profile.parent.name/'themes'/(name+'.json')
    saved = json.loads(record.read_text()) if record.exists() else None
    if dest.is_symlink() or (dest.exists() and not saved): return
    if saved and theme_digest(dest) != saved['installed']: return
    wanted = theme_digest(source/'gtk-3.0')
    if saved and wanted == saved['installed']: return
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source/'gtk-3.0', dest, dirs_exist_ok=True)
    if saved:
        for old in saved['installed'].keys() - wanted.keys():
            (dest/old).unlink(missing_ok=True)
    write_json(record, {'installed': theme_digest(dest)})


def apply(only=None):
    reports=[]
    # Snap desktop-launch links gtk.css but omits its relative SVG directory.
    for profile in (HOME/'snap').glob('*/current'):
        if only is not None and profile.parent.name != only: continue
        mirror_theme(profile)
        for gtk in ('gtk-3.0', 'gtk-4.0'):
            css=profile/'.config'/gtk/'gtk.css'
            if not css.exists() or 'FamiliarMac shared controls' not in css.read_text(): continue
            for src in (HOME/'.config'/gtk/'familiarmac-controls').glob('*.svg'):
                dst=css.parent/'familiarmac-controls'/src.name
                rec=STATE/profile.parent.name/gtk/(src.name+'.json')
                old=dst.read_text() if dst.exists() else None
                saved=json.loads(rec.read_text()) if rec.exists() else None
                if dst.is_symlink() or (saved and old!=saved['installed']): continue
                if old is not None and not saved: continue
                new=src.read_text()
                if old==new: continue
                write_json(rec, {'before': saved['before'] if saved else old, 'installed': new})
                dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(new)
    profile=HOME/'snap/bluebubbles/current'
    if profile.exists() and only in (None, 'bluebubbles'):
        if running('bluebubbles'): status='running; preferences deferred until next integration pass'
        else:
            path=profile/'.local/share/app.bluebubbles.BlueBubbles/shared_preferences.json'
            status=set_native(path, STATE/'bluebubbles-titlebar.json')
        reports.append({'id':'bluebubbles_bluebubbles.desktop','package':'snap','status':status})
    return reports

def restore():
    for record in STATE.glob('*/themes/*.json'):
        name = record.parent.parent.name
        dest = HOME/'snap'/name/'current/.themes'/record.stem/'gtk-3.0'
        saved = json.loads(record.read_text())
        if dest.is_symlink() or theme_digest(dest) != saved['installed']: continue
        shutil.rmtree(dest)
        record.unlink()
    for link_record in STATE.glob('*/themes-link.json'):
        themes = HOME/'snap'/link_record.parent.name/'current/.themes'
        # Restore only if no unowned content remains after theme restoration.
        for folder in list(themes.iterdir()) if themes.is_dir() else []:
            if folder.is_dir() and not folder.is_symlink() and not any(folder.iterdir()): folder.rmdir()
        if themes.is_dir() and not any(themes.iterdir()):
            themes.rmdir();themes.symlink_to(json.loads(link_record.read_text())['target'])
            link_record.unlink()
    record=STATE/'bluebubbles-titlebar.json'
    if record.exists():
        if running('bluebubbles'): raise RuntimeError('Close BlueBubbles before restoring')
        path=HOME/'snap/bluebubbles/current/.local/share/app.bluebubbles.BlueBubbles/shared_preferences.json'
        data=json.loads(path.read_text());saved=json.loads(record.read_text())
        if data.get(KEY)!=saved['installed']: raise RuntimeError('Frame preference changed; restore refused')
        if saved['present']:data[KEY]=saved['before']
        else:data.pop(KEY,None)
        write_json(path,data);record.unlink()
    for record in STATE.glob('*/*/*.svg.json'):
        relative=record.relative_to(STATE);name,gtk,filename=relative.parts
        path=HOME/'snap'/name/'current/.config'/gtk/'familiarmac-controls'/filename[:-5]
        saved=json.loads(record.read_text())
        if not path.exists() or path.read_text()!=saved['installed']:continue
        if saved['before'] is None:path.unlink()
        else:path.write_text(saved['before'])
        record.unlink()

if __name__=='__main__':
    if '--restore' in sys.argv:restore()
    else:print(json.dumps(apply(),indent=2))
