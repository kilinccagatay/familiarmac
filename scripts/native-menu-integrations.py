#!/usr/bin/python3
"""Apply audited native menu profiles, preserving launch arguments and rollback."""
import configparser
import json
from pathlib import Path
import sys
from gi.repository import Gio, GLib

HOME = Path.home()
BASE = Path(__file__).resolve().parent
STATE = HOME / '.local/state/familiarmac/native-menus'


def launcher_text(source):
    cfg = configparser.ConfigParser(interpolation=None, strict=False)
    cfg.optionxform = str
    cfg.read_string(source)
    for section in cfg.sections():
        if 'Exec' in cfg[section]:
            cfg[section]['Exec'] = 'env GDK_BACKEND=x11 ' + cfg[section]['Exec']
    cfg['Desktop Entry']['DBusActivatable'] = 'false'
    import io
    stream = io.StringIO()
    cfg.write(stream, space_around_delimiters=False)
    return stream.getvalue()


def restore():
    for record in STATE.glob('*.json'):
        data = json.loads(record.read_text())
        target = HOME / '.local/share/applications' / data['desktop']
        if not target.exists() or target.read_text() != data['installed']:
            raise RuntimeError('Launcher changed externally: ' + str(target))
        for item in data['settings']:
            settings = Gio.Settings.new(item['schema'])
            if settings.get_value(item['key']).print_(True) == item['installed']:
                if item['before'] is None:
                    settings.reset(item['key'])
                else:
                    settings.set_value(item['key'], GLib.Variant.parse(None, item['before'], None, None))
        if data['before'] is None:
            target.unlink()
        else:
            target.write_text(data['before'])
        record.unlink()
    Gio.Settings.sync()


def apply():
    catalog = BASE / 'app-integrations.json'
    if not catalog.exists(): catalog = BASE.parent / 'config/app-integrations.json'
    for entry in json.loads(catalog.read_text()):
        if entry.get('adapter') != Path(__file__).name: continue
        desktop = entry['id'] + '.desktop'
        source = next((p / desktop for p in (Path('/usr/local/share/applications'), Path('/usr/share/applications')) if (p / desktop).is_file()), None)
        if source is None: continue
        target = HOME / '.local/share/applications' / desktop
        STATE.mkdir(parents=True, exist_ok=True)
        record = STATE / (entry['id'] + '.json')
        data = json.loads(record.read_text()) if record.exists() else {
            'desktop': desktop, 'before': target.read_text() if target.exists() else None, 'settings': []}
        if record.exists() and (not target.exists() or target.read_text() != data['installed']):
            raise RuntimeError('Launcher changed externally: ' + str(target))
        if not record.exists() and target.exists():
            raise RuntimeError('User launcher exists; refusing to overwrite: ' + str(target))
        schemas = Gio.SettingsSchemaSource.get_default()
        for schema, values in entry.get('settings', {}).items():
            definition = schemas.lookup(schema, True)
            if definition is None: continue
            settings = Gio.Settings.new(schema)
            for key, value in values.items():
                if not definition.has_key(key): continue
                prior = next((x for x in data['settings'] if x['schema'] == schema and x['key'] == key), None)
                if prior is None:
                    before = settings.get_user_value(key)
                    prior = {'schema': schema, 'key': key, 'before': before.print_(True) if before is not None else None}
                    data['settings'].append(prior)
                elif settings.get_value(key).print_(True) != prior['installed']:
                    continue  # Respect later user choices.
                settings.set_value(key, GLib.Variant.parse(None, value, None, None))
                prior['installed'] = settings.get_value(key).print_(True)
        data['installed'] = launcher_text(source.read_text())
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(data['installed'])
        record.write_text(json.dumps(data, indent=2))
    Gio.Settings.sync()


if __name__ == '__main__':
    restore() if '--restore' in sys.argv else apply()
