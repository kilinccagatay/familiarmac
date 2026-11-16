#!/usr/bin/python3
"""Read application-owned bindings when GMenu omits accelerators. Never assign keys."""
from pathlib import Path
import json
import sys
import xml.etree.ElementTree as ET


def read_bindings(paths):
    from gi.repository import Gio, Gtk
    by_action = {}; owners = {}
    for path in paths:
        if not path.is_file(): continue
        if path.stat().st_size > 4 * 1024 * 1024: raise ValueError('Shortcut file too large')
        root = ET.fromstring(path.read_bytes())
        if root.tag != 'keys': continue
        for bind in root.findall('bind'):
            action = bind.get('gaction')
            if not action: continue
            try:
                valid, name, target = Gio.Action.parse_detailed_name(action)
                if not valid or not Gio.Action.name_is_valid(name): continue
                action = Gio.Action.print_detailed_name(name, target)
            except Exception: continue
            # Last definition of an action replaces its earlier binding list.
            for old in by_action.get(action, []):
                if owners.get(old) == action: owners.pop(old)
            keys = []
            for key in bind.get('keys', '').split(','):
                key = key.strip()
                if not key: continue
                code, mods = Gtk.accelerator_parse(key)
                if not code: continue
                key = Gtk.accelerator_name(code, mods)
                previous = owners.get(key)
                if previous and previous != action:
                    by_action[previous] = [v for v in by_action[previous] if v != key]
                owners[key] = action; keys.append(key)
            by_action[action] = keys
    return {action: values[0] for action, values in by_action.items() if values}


def inkscape_sources(app_id):
    home = Path.home()
    flatpak = app_id == 'org.inkscape.Inkscape.desktop'
    if flatpak:
        deployments = [home/'.local/share/flatpak/app/org.inkscape.Inkscape', Path('/var/lib/flatpak/app/org.inkscape.Inkscape')]
        roots = [p/'files/share/inkscape/keys' for base in deployments for p in base.glob('*/*/active')]
        profile = home/'.var/app/org.inkscape.Inkscape/config/inkscape'
    else:
        roots = [Path('/usr/local/share/inkscape/keys'), Path('/usr/share/inkscape/keys')]
        profile = home/'.config/inkscape'
    preferences = profile/'preferences.xml'
    selected = 'default.xml'
    if preferences.is_file():
        root = ET.fromstring(preferences.read_bytes())
        group = root.find("./group[@id='options']/group[@id='kbshortcuts']")
        if group is not None: selected = group.get('shortcutfile') or selected
    path = Path(selected)
    if not path.is_absolute():
        path = next((root/selected for root in roots if (root/selected).is_file()), Path('/nonexistent'))
    return [path, profile/'keys/default.xml'], [preferences, profile, profile/'keys']


def main():
    app_id = sys.argv[1] if len(sys.argv) > 1 else ''
    if app_id not in ('org.inkscape.Inkscape.desktop', 'inkscape.desktop'):
        print('{"shortcuts":{},"sources":[]}'); return
    import gi
    gi.require_version('Gtk', '3.0')
    paths, extra = inkscape_sources(app_id)
    print(json.dumps({'shortcuts': read_bindings(paths), 'sources': [str(p) for p in paths+extra]}))


if __name__ == '__main__':
    try: main()
    except (OSError, ValueError, ET.ParseError):
        print('{"shortcuts":{},"sources":[]}')
