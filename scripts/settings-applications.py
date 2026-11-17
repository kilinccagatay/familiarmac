#!/usr/bin/python3
"""Settings inventory and explicit, per-app live menu rediscovery (no profile writes)."""
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import xml.etree.ElementTree as ET
from gi.repository import Gio, GLib
STATE = Path.home()/'.local/state/familiarmac/menu-inspections'

def inventory():
    apps = {a.get_id(): a for a in Gio.AppInfo.get_all() if a.should_show() and a.get_id()}
    result = []
    try: configured = {r['id']:r for r in json.loads((STATE.parent/'toolkits/applications.json').read_text())}
    except (OSError, ValueError, KeyError): configured = {}
    for app_id, app in sorted(apps.items(), key=lambda pair: pair[1].get_display_name().casefold()):
        record = {}
        try: record = json.loads((STATE/(app_id+'.json')).read_text())
        except (OSError, ValueError): pass
        default = 'Configured — live menu not checked.' if configured.get(app_id,{}).get('needs_review') is False else 'Not checked — open the app and choose Check menus.'
        status = record.get('message', default)
        if record.get('checkedAt'): status += ' Last checked: '+record['checkedAt'][:16].replace('T',' ')+' UTC.'
        result.append({'id':app_id, 'name':app.get_display_name(), 'status':status, 'adapted':record.get('status') == 'adapted', 'review':record.get('status'), 'can_review':record.get('status') in ('not-exported', 'not-running', 'no-menu-needed', 'needs-support')})
    return result

def recheck(app_id, ui=False, ticket=None):
    if app_id not in {row['id'] for row in inventory()}:
        raise ValueError('Application is no longer installed or visible.')
    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    response = bus.call_sync('org.gnome.Shell', '/org/familiarmac/MenuInspection',
        'org.familiarmac.MenuInspection', 'RecheckOwned' if ticket else 'Recheck',
        GLib.Variant('(ss)', (app_id, ticket)) if ticket else GLib.Variant('(s)', (app_id,)),
        GLib.VariantType.new('(s)'), Gio.DBusCallFlags.NO_AUTO_START, 12000, None)
    record = json.loads(response.unpack()[0])
    previous = next(row for row in inventory() if row['id'] == app_id)
    show_open = record.get('status') == 'not-running' and not previous['adapted']
    # A closed app does not invalidate an earlier successful inspection.
    if record.get('status') == 'not-running' and (previous['adapted'] or previous.get('review') in ('no-menu-needed', 'needs-support')):
        return previous['status'] + ('\nhide' if ui else '')
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = STATE/(app_id+'.json')
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(record, indent=2)+'\n'); tmp.chmod(0o600); tmp.replace(path)
    return record['message'] + (('\nopen' if show_open else '\nhide') if ui else '')

def review(app_id, decision):
    if decision not in ('no-menu-needed', 'needs-support'):
        raise ValueError('Unknown review decision.')
    app = next((row for row in inventory() if row['id'] == app_id), None)
    if not app or not app['can_review']:
        raise ValueError('Check this application first; a missing menu or closed-window result is required.')
    path = STATE/(app_id+'.json')
    record = json.loads(path.read_text())
    if 'inspection' not in record:
        record = {'inspection':record, 'checkedAt':record.get('checkedAt')}
    record.update(status=decision, reviewedAt=datetime.now(timezone.utc).isoformat(), reviewedBy='user',
        message='No menu needed — marked by you.' if decision == 'no-menu-needed' else 'Needs support — menu integration needs attention (marked by you).')
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(record,indent=2)+'\n');tmp.chmod(0o600);tmp.replace(path)
    return record['message']

def launch(app_id):
    app = next((a for a in Gio.AppInfo.get_all() if a.get_id() == app_id and a.should_show()), None)
    if app is None: raise ValueError('Application is no longer installed or visible.')
    try:
        bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        result = bus.call_sync('org.gnome.Shell', '/org/familiarmac/MenuInspection',
            'org.familiarmac.MenuInspection', 'OpenForInspection', GLib.Variant('(s)', (app_id,)),
            GLib.VariantType.new('(s)'), Gio.DBusCallFlags.NO_AUTO_START, 3000, None)
        return result.unpack()[0]
    except GLib.Error as error:
        # Older sessions can still open apps, but cannot establish ownership.
        if 'UnknownMethod' not in str(error) and 'UnknownObject' not in str(error): raise
        app.launch([], Gio.AppLaunchContext())
        return None

def prop(obj, name, value): ET.SubElement(obj, 'property', name=name).text = value

def generate(output):
    tree = ET.parse(Path(__file__).with_name('dock-window.ui'))
    release_state = Path(os.environ.get('XDG_STATE_HOME',Path.home()/'.local/state'))/'familiarmac/releases'
    try: installed = json.loads((release_state/'installed.json').read_text())['version']
    except (OSError,ValueError,KeyError): installed = 'Development build'
    row=tree.find('.//object[@id="release_status"]')
    if row is not None:
        row.find('property[@name="title"]').text='FamiliarMac '+installed
    output.parent.mkdir(parents=True,exist_ok=True)
    temporary=output.with_suffix('.tmp');tree.write(temporary, encoding='utf-8',xml_declaration=True)
    temporary.replace(output)

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ticket');parser.add_argument('--configure',action='store_true');parser.add_argument('--open');parser.add_argument('--ui',action='store_true')
    parser.add_argument('--activate-panel',action='store_true');parser.add_argument('--recheck');parser.add_argument('--generate',type=Path)
    args=parser.parse_args()
    try:
        if args.configure:
            from menu_setup import run
            raise SystemExit(run(inventory, launch, review))
        elif args.activate_panel:
            try:
                bus=Gio.bus_get_sync(Gio.BusType.SESSION,None)
                bus.call_sync('org.gnome.Settings','/org/gnome/Settings','org.gtk.Actions','Describe',GLib.Variant('(s)',('familiarmac-dock',)),None,Gio.DBusCallFlags.NO_AUTO_START,2000,None)
                bus.call_sync('org.gnome.Settings','/org/gnome/Settings','org.gtk.Actions','Activate',GLib.Variant('(sava{sv})',('familiarmac-dock',[],{})),None,Gio.DBusCallFlags.NO_AUTO_START,2000,None)
            except GLib.Error: raise SystemExit(1)
        elif args.open: launch(args.open)
        elif args.recheck: print(recheck(args.recheck, args.ui, args.ticket))
        elif args.generate: generate(args.generate)
        else: print(json.dumps(inventory(),indent=2))
    except GLib.Error as error:
        print('Menu service unavailable or busy. Start a new session after updating FamiliarMac, then retry.')
        raise SystemExit(1)
    except (ValueError,OSError) as error:
        print(str(error));raise SystemExit(1)
