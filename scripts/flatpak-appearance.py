#!/usr/bin/python3
"""Share narrowly scoped GTK controls across installed Flatpaks, preserving app CSS."""
from pathlib import Path
import json,re,shutil
BEGIN='/* BEGIN FamiliarMac shared controls */'
END='/* END FamiliarMac shared controls */'

def merge_css(old, rules):
    old=re.sub(re.escape(BEGIN)+r'.*?'+re.escape(END)+r'\n?', '', old, flags=re.S)
    return old.rstrip()+'\n\n'+BEGIN+'\n'+rules+'\n'+END+'\n'

def apply(home, apps, config):
    state=home/'.local/state/familiarmac/flatpak-appearance';state.mkdir(parents=True,exist_ok=True)
    controls=(config/'fixed-traffic-lights.css').read_text()
    for app in apps:
        for version,extra in [('3.0','context-menu-spacing.css'),('4.0','headerbar-spacing.css')]:
            target=home/'.var/app'/app/'config'/('gtk-'+version)/'gtk.css'
            target.parent.mkdir(parents=True,exist_ok=True)
            record=state/(app+'-gtk'+version+'.json')
            old=target.read_text() if target.exists() else ''
            saved=json.loads(record.read_text()) if record.exists() else {'path':str(target),'before':old if target.exists() else None}
            rules=(config/extra).read_text()+'\n'+controls
            if version=='3.0': rules=rules.split('/* GTK4: 16px hit node')[0]
            assets=target.parent/'familiarmac-controls';assets.mkdir(exist_ok=True)
            for source in (config/'familiarmac-controls').glob('*.svg'):
                dest=assets/source.name
                if not dest.exists() or dest.read_bytes()!=source.read_bytes(): shutil.copy2(source,dest)
            text=merge_css(old,rules)
            if text!=old:target.write_text(text)
            saved['installed']=text;record.write_text(json.dumps(saved))

def restore(home):
    for record in (home/'.local/state/familiarmac/flatpak-appearance').glob('*.json'):
        saved=json.loads(record.read_text());target=Path(saved['path'])
        if target.exists():
            text=target.read_text()
            if text==saved['installed']:
                if saved['before'] is None:target.unlink()
                else:target.write_text(saved['before'])
            else:
                target.write_text(re.sub(re.escape(BEGIN)+r'.*?'+re.escape(END)+r'\n?', '', text, flags=re.S))
        record.unlink()
