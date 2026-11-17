#!/usr/bin/python3
"""Read application-owned bindings when GMenu omits accelerators. Never assign keys."""
from pathlib import Path
import json
import sys
import re
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


def read_gimp_bindings(path):
    """GIMP v1 saves unchanged defaults as commented action records."""
    from gi.repository import Gtk
    if not path.is_file(): return {}
    if path.stat().st_size > 4 * 1024 * 1024: raise ValueError('Shortcut file too large')
    text = path.read_text()
    if not re.search(r'^\(file-version 1\)\s*$', text, re.M): return {}
    records = []
    for line in text.splitlines():
        match = re.fullmatch(r'\s*(#\s*)?\(action((?:\s+"(?:[^"\\]|\\.)*")+)\)\s*', line)
        if not match: continue
        strings = re.findall(r'"(?:[^"\\]|\\.)*"', match[2])
        values = [json.loads(value) for value in strings]
        if not re.fullmatch(r'[a-zA-Z0-9.-]+', values[0]): continue
        records.append((bool(match[1]), values))
    actions = {}; owners = {}
    # User overrides and explicit unbindings win over serialized defaults,
    # regardless of the order in which GIMP enumerated its action hash table.
    for default in (True, False):
        for is_default, values in records:
            if is_default != default: continue
            action = 'app.'+values[0]
            for old in actions.get(action, []):
                if owners.get(old) == action: owners.pop(old)
            keys = []
            for key in values[1:]:
                code, mods = Gtk.accelerator_parse(key)
                if not code: continue
                key = Gtk.accelerator_name(code, mods)
                previous = owners.get(key)
                if previous and previous != action:
                    actions[previous] = [v for v in actions[previous] if v != key]
                owners[key] = action; keys.append(key)
            actions[action] = keys
    return {action: keys[0] for action, keys in actions.items() if keys}


def gimp_sources(app_id):
    home = Path.home()
    base = (home/'.var/app/org.gimp.GIMP/config' if app_id == 'org.gimp.GIMP.desktop'
            else home/'.config')/'GIMP'
    # Never pick another installed version's shortcuts by timestamp.
    profiles = [p for p in base.glob('3.*') if (p/'shortcutsrc').is_file()]
    if len(profiles) != 1: return None, [base]
    return profiles[0]/'shortcutsrc', [base, profiles[0], profiles[0]/'shortcutsrc']


def read_gtk_accelmap(paths):
    """Read GtkAccelMap dumps by detailed action ID, never by translated label."""
    from gi.repository import Gio, Gtk
    records = []
    for path in paths:
        if not path.is_file(): continue
        if path.stat().st_size > 4 * 1024 * 1024: raise ValueError('Shortcut file too large')
        for line in path.read_text().splitlines():
            match = re.fullmatch(r'\s*(;\s*)?\(gtk_accel_path\s+("(?:[^"\\]|\\.)*")\s+("(?:[^"\\]|\\.)*")\)\s*', line)
            if not match: continue
            raw, key = json.loads(match[2]), json.loads(match[3])
            if not raw.startswith(('<Actions>/app.', '<Actions>/win.')): continue
            try:
                valid, name, target = Gio.Action.parse_detailed_name(raw[len('<Actions>/'):])
                if not valid: continue
                action = Gio.Action.print_detailed_name(name, target)
            except Exception: continue
            records.append((bool(match[1]), action, key))
    actions = {}; owners = {}
    for default in (True, False):
        for is_default, action, key in records:
            if default != is_default: continue
            old = actions.pop(action, None)
            if owners.get(old) == action: owners.pop(old)
            code, mods = Gtk.accelerator_parse(key)
            if not code: continue
            key = Gtk.accelerator_name(code, mods)
            previous = owners.get(key)
            if previous: actions.pop(previous, None)
            owners[key] = action; actions[action] = key
    return actions


def gtk_accelmap_sources(app_id):
    # Bounded lookup within this application's profile only. Do not scan other
    # apps' configs or trust menu labels as action identities.
    from gi.repository import Gio
    if not re.fullmatch(r'[A-Za-z0-9_.-]+\.desktop', app_id): return [], []
    app = Gio.DesktopAppInfo.new(app_id)
    if not app: return [], []
    flatpak = app.get_string('X-Flatpak')
    base = Path.home()/'.var/app'/flatpak/'config' if flatpak and re.fullmatch(r'[A-Za-z0-9_.-]+', flatpak) else Path.home()/'.config'
    leaf = app_id.removesuffix('.desktop').split('.')[-1]
    names = {leaf, leaf.lower(), leaf.capitalize()}
    executable = Path(app.get_executable() or '').name
    if re.fullmatch(r'[A-Za-z0-9_-]+', executable) and executable not in ('flatpak', 'env', 'sh'):
        names.update((executable, executable.capitalize()))
    folders = [base/name for name in sorted(names)]
    paths = [folder/name for folder in folders for name in ('accels', 'accels.scm', 'accelmap')]
    return paths, [folder for folder in folders if folder.is_dir()]


def read_python_gtk_bindings(path):
    """Conservative static reader; application code is parsed, never imported."""
    import ast
    from gi.repository import Gio, Gtk
    if path.stat().st_size > 1024 * 1024: return {}
    tree = ast.parse(path.read_text())
    classes = [node for node in tree.body if isinstance(node, ast.ClassDef) and any(
        isinstance(base, ast.Attribute) and base.attr == 'Application' and
        isinstance(base.value, ast.Name) and base.value.id in ('Gtk', 'Adw') for base in node.bases)]
    if len(classes) != 1: return {}
    cls = classes[0]
    startup = [n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name == 'do_startup']
    if len(startup) != 1 or startup[0].decorator_list: return {}
    def binding_call(node):
        return isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'set_accels_for_action'
    direct = [n.value for n in startup[0].body if isinstance(n, ast.Expr) and binding_call(n.value)]
    # Conditional, loop-based, nested or later replacements are not static defaults.
    if not direct or {id(n) for n in ast.walk(tree) if binding_call(n)} != {id(n) for n in direct}: return {}
    last_binding = max(call.lineno for call in direct)
    branching = (ast.If, ast.For, ast.While, ast.Try, ast.With, ast.Return, ast.Raise)
    if any(isinstance(n, branching) and n.lineno <= last_binding for n in startup[0].body): return {}
    bindings = {}
    for call in direct:
        if not isinstance(call.func.value, ast.Name) or call.func.value.id != 'self' or len(call.args) != 2 or call.keywords: return {}
        name, keys = call.args
        if not isinstance(name, ast.Constant) or not isinstance(name.value, str): return {}
        if not isinstance(keys, (ast.List, ast.Tuple)) or any(not isinstance(k, ast.Constant) or not isinstance(k.value, str) for k in keys.elts): return {}
        if not name.value.startswith(('app.', 'win.')): continue
        try:
            valid, action, target = Gio.Action.parse_detailed_name(name.value)
            if not valid: return {}
            if target is None and re.fullmatch(r'(app|win)\.[A-Za-z0-9_.-]+', action):
                # Some GTK apps export underscore names despite the narrower
                # GAction detailed-name validator. Preserve the exact wire ID.
                pass
            elif Gio.Action.name_is_valid(action):
                action = Gio.Action.print_detailed_name(action, target)
            else: return {}
        except Exception: return {}
        parsed = []
        for k in keys.elts:
            code, mods = Gtk.accelerator_parse(k.value)
            if not code: return {}
            parsed.append(Gtk.accelerator_name(code, mods))
        bindings[action] = parsed
    owners = {}
    for action, keys in bindings.items():
        for key in keys: owners.setdefault(key, set()).add(action)
    # Ambiguous shared keys are not advertised as an exclusive binding.
    return {a: next(k for k in keys if len(owners[k]) == 1) for a, keys in bindings.items()
            if any(len(owners[k]) == 1 for k in keys)}


def python_gtk_sources(app_id):
    """Find this launcher's own Python package, bounded and without execution."""
    import subprocess
    from gi.repository import Gio
    if not re.fullmatch(r'[A-Za-z0-9_.-]+\.desktop', app_id): return []
    app = Gio.DesktopAppInfo.new(app_id)
    if not app: return []
    flatpak = app.get_string('X-Flatpak')
    leaf = app_id.removesuffix('.desktop').split('.')[-1].lower().replace('-', '_')
    if not re.fullmatch(r'[a-z0-9_]+', leaf): return []
    if flatpak:
        if not re.fullmatch(r'[A-Za-z0-9_.-]+', flatpak): return []
        try:
            result = subprocess.run(['flatpak', 'info', '--show-location', flatpak], capture_output=True, text=True, timeout=3)
        except (OSError, subprocess.TimeoutExpired): return []
        location = Path(result.stdout.strip())
        if result.returncode or not location.is_absolute(): return []
        prefix = location/'files'
        packages = list(prefix.glob('lib/python*/site-packages/'+leaf))
    else:
        packages = [Path('/usr/lib/python3/dist-packages')/leaf, Path('/usr/share')/leaf/leaf]
    candidates = [p/'application.py' for p in packages if (p/'application.py').is_file()]
    if len(candidates) != 1: return []
    source = candidates[0]
    files = list(source.parent.rglob('*.py'))
    if len(files) > 256 or sum(p.stat().st_size for p in files) > 4*1024*1024: return []
    # A second module installing runtime/user bindings makes static inference unsafe.
    for p in files:
        if p != source and 'set_accels_for_action' in p.read_text(): return []
    return [source]


def read_builder_bindings(xml):
    """Read explicit action/accelerator pairs, never match translated titles."""
    from gi.repository import Gtk
    root = ET.fromstring(xml)
    pairs = []
    for item in root.iter('item'):
        attrs = {a.get('name'): a.text or '' for a in item.findall('attribute')}
        if 'target' not in attrs:
            pairs.append((attrs.get('action', ''), attrs.get('accel', attrs.get('x-gtk-accel', ''))))
    for obj in root.iter('object'):
        if obj.get('class') != 'GtkShortcut': continue
        action = obj.find("./property[@name='action']/object[@class='GtkNamedAction']/property[@name='action-name']")
        trigger = obj.find("./property[@name='trigger']")
        if action is not None and trigger is not None and not list(trigger):
            pairs.append((action.text or '', trigger.text or ''))
    values = {}; conflicts = set()
    for action, key in pairs:
        if not re.fullmatch(r'(app|win)\.[A-Za-z0-9_.-]+', action): continue
        code, mods = Gtk.accelerator_parse(key)
        if not code: continue
        key = Gtk.accelerator_name(code, mods)
        if action in values and values[action] != key: conflicts.add(action)
        values[action] = key
    return {a:k for a,k in values.items() if a not in conflicts}


def resource_bindings(app_id):
    """Bounded read of the selected launcher's packaged GtkBuilder resources."""
    import shutil, subprocess, time
    from gi.repository import Gio
    app = Gio.DesktopAppInfo.new(app_id)
    if not app: return {}, []
    executable = app.get_executable() or ''
    flatpak = app.get_string('X-Flatpak')
    if flatpak:
        # Flatpak launchers name the wrapper rather than the actual executable.
        # Do not guess another package's resources.
        return {}, []
    binary = shutil.which(executable)
    if not binary: return {}, []
    leaf = Path(binary).name
    containers = [Path(binary)] + sorted((Path('/usr/share')/leaf).glob('*.gresource'))
    values = {}; conflicts = set(); sources = []; total = 0
    deadline = time.monotonic() + 8
    for container in containers[:8]:
        try:
            listing = subprocess.run(['gresource', 'list', str(container)], capture_output=True, text=True, timeout=2)
            if listing.returncode: continue
            entries = [x for x in listing.stdout.splitlines() if x.endswith('.ui')]
            if len(entries) > 128: continue
            sources.append(str(container))
            for entry in entries:
                if time.monotonic() > deadline: return {}, sources
                result = subprocess.run(['gresource', 'extract', str(container), entry], capture_output=True, timeout=2)
                total += len(result.stdout)
                if total > 4*1024*1024: return {}, sources
                if result.returncode: continue
                try: bindings = read_builder_bindings(result.stdout)
                except ET.ParseError: continue
                for action, key in bindings.items():
                    if action in values and values[action] != key: conflicts.add(action)
                    values[action] = key
        except (OSError, subprocess.TimeoutExpired): continue
    return {a:k for a,k in values.items() if a not in conflicts}, sources


def main():
    app_id = sys.argv[1] if len(sys.argv) > 1 else ''
    import gi
    gi.require_version('Gtk', '3.0')
    if app_id in ('gimp.desktop', 'org.gimp.GIMP.desktop'):
        path, sources = gimp_sources(app_id)
        print(json.dumps({'shortcuts': read_gimp_bindings(path) if path else {}, 'sources': [str(p) for p in sources]}))
        return
    if app_id in ('org.inkscape.Inkscape.desktop', 'inkscape.desktop'):
        paths, extra = inkscape_sources(app_id)
        values = read_bindings(paths)
    else:
        paths, extra = gtk_accelmap_sources(app_id)
        values = read_gtk_accelmap(paths)
        # Existing user maps (including empty/unbound maps) remain authoritative.
        if not any(p.is_file() for p in paths):
            resource_values, resource_sources = resource_bindings(app_id)
            values.update(resource_values)
            paths += [Path(p) for p in resource_sources]
            sources = python_gtk_sources(app_id)
            if sources:
                values.update(read_python_gtk_bindings(sources[0]))
                paths += sources
    print(json.dumps({'shortcuts': values, 'sources': [str(p) for p in paths+extra]}))


if __name__ == '__main__':
    try: main()
    except (OSError, ValueError, SyntaxError, ET.ParseError):
        print('{"shortcuts":{},"sources":[]}')
