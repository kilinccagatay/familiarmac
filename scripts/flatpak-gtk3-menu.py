#!/usr/bin/python3
"""Provide only the GTK3 menu exporter to compatible Flatpak runtimes.
Never expose host GTK/GLib or set a global preload. Existing environment survives.
"""
from pathlib import Path
import filecmp
import shutil
import subprocess


def prepare(home):
    modules = sorted(Path('/usr/lib').glob('*/gtk-3.0/modules/libappmenu-gtk-module.so'))
    parsers = sorted(Path('/usr/lib').glob('*/libappmenu-gtk3-parser.so.0'))
    schema = Path('/usr/share/glib-2.0/schemas/org.appmenu.gtk-module.gschema.xml')
    if not modules or not parsers or not schema.is_file():
        raise RuntimeError('GTK3 menu module, parser or schema missing')
    folder = home/'.local/share/familiarmac/gtk3-menu'
    schemas = folder/'share/glib-2.0/schemas'
    schemas.mkdir(parents=True, exist_ok=True)
    for source, target in [(modules[0], folder/modules[0].name),
                           (parsers[0], folder/parsers[0].name), (schema, schemas/schema.name)]:
        if not target.exists() or not filecmp.cmp(source, target, shallow=False):
            temp = target.with_suffix(target.suffix+'.new')
            shutil.copyfile(source, temp)
            temp.chmod(0o644)
            temp.replace(target)
    subprocess.run(['glib-compile-schemas', str(schemas)], check=True, timeout=10)
    return folder


def environment_options(folder, environment):
    """Merge three search paths, retaining package and user-defined entries."""
    folder = str(folder)
    def prepend(value, item):
        return ':'.join([item] + [p for p in value.split(':') if p and p != item])
    modules = [p for p in environment.get('GTK_MODULES','').split(':')
               if p and p not in ('appmenu-gtk-module', folder+'/libappmenu-gtk-module.so')]
    modules.append(folder+'/libappmenu-gtk-module.so')
    return ['--filesystem='+folder+':ro',
            '--env=GTK_MODULES='+':'.join(modules),
            '--env=LD_LIBRARY_PATH='+prepend(environment.get('LD_LIBRARY_PATH',''), folder),
            '--env=XDG_DATA_DIRS='+prepend(environment.get('XDG_DATA_DIRS','') or '/app/share:/usr/share', folder+'/share')]


def options(app, folder):
    # Read the actual sandbox environment, including existing global/app overrides.
    result = subprocess.run(['flatpak','run','--command=sh',app,'-c',
        'printf "%s\\n%s\\n%s\\n" "$GTK_MODULES" "$LD_LIBRARY_PATH" "$XDG_DATA_DIRS"'],
        text=True, capture_output=True, check=True, timeout=20)
    values = result.stdout.splitlines()
    if len(values) != 3: raise RuntimeError('Cannot read sandbox environment')
    args = environment_options(folder, dict(zip(['GTK_MODULES','LD_LIBRARY_PATH','XDG_DATA_DIRS'], values)))
    # Resolve all symbols against the runtime before persisting any override.
    probe = subprocess.run(['flatpak','run',*args,'--command=sh',app,'-c',
        'ldd -r "$1" && gsettings list-keys org.appmenu.gtk-module', 'sh',
        str(folder/'libappmenu-gtk-module.so')], text=True, capture_output=True, timeout=20)
    diagnostics = probe.stdout+probe.stderr
    if probe.returncode or 'not found' in diagnostics or 'undefined symbol' in diagnostics:
        raise RuntimeError('GTK3 exporter incompatible with sandbox runtime; overrides unchanged')
    return args
