#!/usr/bin/python3
"""Idempotent per-user GNOME setup with exact per-key/file rollback."""
import json
import os
from pathlib import Path
import shutil
import sys
import re
import shlex
import base64
import zipfile
import subprocess
import gi
gi.require_version('Gio', '2.0')
from gi.repository import Gio, GLib

ROOT = Path(__file__).resolve().parents[1]
STATE = Path(os.environ.get('XDG_STATE_HOME', Path.home()/'.local/state'))/'macbook-zorin'
STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
SAVE = STATE/'desktop.json'
state = json.loads(SAVE.read_text()) if SAVE.exists() else {'settings': {}, 'files': {}}

def persist():
    SAVE.write_text(json.dumps(state, indent=2))
    SAVE.chmod(0o600)

def get_settings(schema):
    if ':' in schema:
        name,path=schema.split(':',1)
        return Gio.Settings.new_with_path(name,path)
    if schema == 'org.gnome.shell.extensions.com.github.hermes83.compiz-alike-magic-lamp-effect':
        source = Gio.SettingsSchemaSource.new_from_directory(str(Path.home()/'.local/share/gnome-shell/extensions/compiz-alike-magic-lamp-effect@hermes83.github.com/schemas'), Gio.SettingsSchemaSource.get_default(), False)
        return Gio.Settings.new_full(source.lookup(schema, False), None, None)
    if schema == 'org.gnome.shell.extensions.appmenu':
        source = Gio.SettingsSchemaSource.new_from_directory(str(Path.home()/'.local/share/gnome-shell/extensions/appmenu@ChathurangaBW.github.io/schemas'), Gio.SettingsSchemaSource.get_default(), False)
        return Gio.Settings.new_full(source.lookup(schema, False), None, None)
    if schema == 'org.gnome.shell.extensions.touchpad-gesture-customization':
        source = Gio.SettingsSchemaSource.new_from_directory(str(Path.home()/'.local/share/gnome-shell/extensions/touchpad-gesture-customization@coooolapps.com/schemas'), Gio.SettingsSchemaSource.get_default(), False)
        return Gio.Settings.new_full(source.lookup(schema, False), None, None)
    return Gio.Settings.new(schema)

def setting(schema, key, value=None):
    if schema in ('org.gnome.desktop.peripherals.touchpad',
                  'org.gnome.shell.extensions.touchpad-gesture-customization') and os.environ.get('MACBOOK_INPUT_PRESET') != '1':
        return None
    s = get_settings(schema)
    identity = schema+'|'+key
    # Existing input preferences belong to the user, including gesture tuning.
    if schema in ('org.gnome.desktop.peripherals.touchpad',
                  'org.gnome.shell.extensions.touchpad-gesture-customization') and identity in state['settings']:
        return s
    if identity not in state['settings']:
        v = s.get_user_value(key)
        state['settings'][identity] = None if v is None else v.print_(True)
        persist()
    if value is not None:
        parsed = GLib.Variant.parse(s.get_value(key).get_type(), value, None, None)
        if not s.set_value(key, parsed):
            raise RuntimeError(identity)
    return s

def write(path, content):
    path = Path(path)
    name = str(path)
    if name not in state['files']:
        state['files'][name] = {'base64': base64.b64encode(path.read_bytes()).decode()} if path.exists() else None
        persist()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content) if isinstance(content, bytes) else path.write_text(content)

def restore():
    for identity, value in state['settings'].items():
        schema, key = identity.split('|')
        s = get_settings(schema)
        if value is None: s.reset(key)
        else: s.set_value(key, GLib.Variant.parse(s.get_value(key).get_type(), value, None, None))
    for name, content in state['files'].items():
        p = Path(name)
        if content is None: p.unlink(missing_ok=True)
        elif isinstance(content, dict): p.write_bytes(base64.b64decode(content['base64']))
        else: p.write_text(content)
    Gio.Settings.sync()
    SAVE.rename(STATE/'desktop-restored.json')
    print('Masaüstü ayarları geri alındı. Oturumu kapatıp açın.')

if len(sys.argv)>1 and sys.argv[1]=='restore':
    restore(); sys.exit(0)
if os.geteuid()==0: raise SystemExit('Bu betiği sudo ile çalıştırmayın.')

values = {
 'org.gnome.desktop.wm.preferences': {'button-layout': "'close,minimize,maximize:'", 'action-double-click-titlebar': "'toggle-maximize'"},
 'org.gnome.desktop.interface': {'gtk-theme': "'ZorinGrey-Dark'", 'icon-theme': "'ZorinGrey-Dark'", 'color-scheme': "'prefer-dark'", 'enable-animations': 'true', 'enable-hot-corners': 'false', 'show-battery-percentage': 'true', 'clock-show-date': 'true'},
 'org.gnome.desktop.peripherals.touchpad': {'natural-scroll': 'true', 'tap-and-drag': 'false', 'speed': '-0.15', 'accel-profile': "'adaptive'", 'two-finger-scrolling-enabled': 'true', 'edge-scrolling-enabled': 'false', 'click-method': "'fingers'", 'disable-while-typing': 'true', 'middle-click-emulation': 'false'},
 'org.gnome.shell.extensions.zorin-dash': {'dock-position': "'BOTTOM'", 'extend-height': 'false', 'dash-max-icon-size': '48', 'autohide': 'false', 'intellihide': 'false', 'dock-fixed': 'true', 'running-indicator-style': "'DOTS'", 'show-trash': 'true', 'show-show-apps-button': 'true', 'show-apps-at-top': 'true', 'show-mounts': 'true', 'apply-custom-theme': 'false', 'custom-background-color': 'true', 'background-color': "'#242424'", 'background-opacity': '0.82', 'transparency-mode': "'FIXED'"},
 'org.gnome.desktop.wm.keybindings': {'switch-input-source': "['XF86Keyboard']", 'switch-applications': "['<Alt>Tab']", 'switch-applications-backward': "['<Shift><Alt>Tab']", 'switch-windows': '@as []', 'switch-windows-backward': '@as []', 'minimize': "['<Super>h']", 'switch-to-workspace-left': "['<Control><Alt>Left', '<Super>Page_Up']", 'switch-to-workspace-right': "['<Control><Alt>Right', '<Super>Page_Down']", 'move-to-workspace-left': "['<Control><Alt><Shift>Left']", 'move-to-workspace-right': "['<Control><Alt><Shift>Right']"},
 'org.gnome.mutter': {'dynamic-workspaces': 'true', 'workspaces-only-on-primary': 'false'},
 'org.gnome.shell.keybindings': {'toggle-overview': "['<Control>Up']", 'show-screenshot-ui': "['<Super><Shift>s']", 'screenshot': "['Print']"},
}
# Initialize tap-to-click only once; preserve later user changes.
identity = 'org.gnome.desktop.peripherals.touchpad|tap-to-click'
if identity not in state['settings']:
    setting('org.gnome.desktop.peripherals.touchpad', 'tap-to-click', 'true')

for schema, keys in values.items():
    for key, value in keys.items(): setting(schema,key,value)

# GNOME Screenshot supports direct area selection and clipboard-only capture.
capture=Path.home()/'.local/bin/macbook-screenshot-clipboard'
write(capture,(ROOT/'scripts/screenshot-clipboard.sh').read_text())
capture.chmod(0o755)
capture_command=shlex.quote(str(capture))
media=setting('org.gnome.settings-daemon.plugins.media-keys','custom-keybindings')
bindings=media.get_strv('custom-keybindings')
for suffix,label,accelerator,command in [
    ('area-file','Save screenshot area','<Super><Shift>4','gnome-screenshot --area'),
    ('screen-clipboard','Copy entire screen','<Super><Control><Shift>3',capture_command),
    ('area-clipboard','Copy screenshot area','<Super><Control><Shift>4',capture_command+' --area')]:
    path=f'/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/macbook-{suffix}/'
    schema='org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:'+path
    for key,value in [('name',label),('binding',accelerator),('command',command)]:
        setting(schema,key,GLib.Variant('s',value).print_(True))
    if path not in bindings: bindings.append(path)
media.set_strv('custom-keybindings',bindings)

# Preserve unrelated XSettings overrides.
s = setting('org.gnome.settings-daemon.plugins.xsettings','overrides')
overrides = s.get_value('overrides').unpack()
overrides = {k: GLib.Variant('s' if isinstance(v,str) else 'i',v) for k,v in overrides.items()}
overrides['Gtk/DecorationLayout'] = GLib.Variant('s','close,minimize,maximize:')
s.set_value('overrides',GLib.Variant('a{sv}',overrides))

whitesur = Path('/usr/share/themes/MacBook-WhiteSur-Dark')
if whitesur.is_dir():
    setting('org.gnome.desktop.interface','gtk-theme',"'MacBook-WhiteSur-Dark'")
    setting('org.gnome.desktop.interface','icon-theme',"'MacBook-WhiteSur-dark'")
    shell_css=Path.home()/'.local/share/themes/MacBook-WhiteSur-Refined/gnome-shell/gnome-shell.css'
    write(shell_css,(ROOT/'config/shell-refinements.css').read_text())
    setting('org.gnome.shell.extensions.user-theme','name',"'MacBook-WhiteSur-Refined'")
    setting('org.gnome.desktop.wm.preferences','theme',"'MacBook-WhiteSur-Dark'")
    wallpaper = "'file:///usr/local/share/macbook-zorin/wallpaper.png'"
    setting('org.gnome.desktop.background','picture-uri',wallpaper)
    setting('org.gnome.desktop.background','picture-uri-dark',wallpaper)
    setting('org.gnome.desktop.background','picture-options',"'zoom'")
    setting('org.gnome.desktop.screensaver','picture-uri',wallpaper)

for version in ('3.0','4.0'):
    css = Path.home()/f'.config/gtk-{version}/gtk.css'
    old = css.read_text() if css.exists() else ''
    marker='/* BEGIN macbook-zorin */'
    old=re.sub(r'/\* BEGIN macbook-zorin \*/.*?/\* END macbook-zorin \*/\n?', '',old,flags=re.S)
    if whitesur.is_dir():
        theme_css = (f'@import url("{(whitesur/"gtk-4.0/gtk.css").as_uri()}");\n' if version=='4.0' else '')
    else:
        theme_css = (ROOT/'config/traffic-lights.css').read_text()
    if version == '4.0': theme_css += '\n' + (ROOT/'config/headerbar-spacing.css').read_text()
    write(css,marker+'\n'+theme_css+'\n/* END macbook-zorin */\n'+old.lstrip('\n'))

write(Path.home()/'.config/keyd/app.conf',(ROOT/'config/app.conf').read_text())
# Install the upstream GNOME integration, loaded after the next login.
import tarfile, tempfile
with tempfile.TemporaryDirectory() as tmp:
    with tarfile.open(ROOT/'vendor/keyd-2.6.0.tar.gz') as archive:
        archive.extractall(tmp, filter='data')
    for f in (Path(tmp)/'data/gnome-extension-45').iterdir():
        if f.is_file(): write(Path.home()/'.local/share/gnome-shell/extensions/keyd@keyd.rvaiya.github.com'/f.name,f.read_text())
# Pinned GNOME 46-compatible upstream gesture engine; no custom event injector.
gesture_dir = Path.home()/'.local/share/gnome-shell/extensions/touchpad-gesture-customization@coooolapps.com'
with zipfile.ZipFile(ROOT/'vendor/touchpad-gestures-v27.zip') as archive:
    for name in archive.namelist():
        if not name.endswith('/'):
            if Path(name).is_absolute() or '..' in Path(name).parts: raise ValueError(name)
            write(gesture_dir/name, archive.read(name))
with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['glib-compile-schemas', '--strict', '--targetdir='+tmp, str(gesture_dir/'schemas')], check=True)
    write(gesture_dir/'schemas/gschemas.compiled', (Path(tmp)/'gschemas.compiled').read_bytes())
for key, value in {
    'horizontal-swipe-3-fingers-gesture': "'WORKSPACE_SWITCHING'",
    'horizontal-swipe-4-fingers-gesture': "'WORKSPACE_SWITCHING'",
    'vertical-swipe-3-fingers-gesture': "'OVERVIEW_NAVIGATION'",
    'vertical-swipe-4-fingers-gesture': "'OVERVIEW_NAVIGATION'",
    'overview-navigation-states': "'WINDOW_PICKER_ONLY'",
    'workspace-switching-states': "'DEFAULT'",
    'pinch-3-finger-gesture': "'NONE'",
    'pinch-4-finger-gesture': "'SHOW_DESKTOP'",
    'follow-natural-scroll': 'true',
    'enable-forward-back-gesture': 'false',
    'enable-vertical-app-gesture': 'false',
    'touchpad-speed-scale': '1.0',
    'touchpad-pinch-speed': '1.0',
}.items(): setting('org.gnome.shell.extensions.touchpad-gesture-customization', key, value)

# Pinned, GNOME 46-compatible dock-directed minimize animation.
lamp_dir = Path.home()/'.local/share/gnome-shell/extensions/compiz-alike-magic-lamp-effect@hermes83.github.com'
with zipfile.ZipFile(ROOT/'vendor/magic-lamp-v25.zip') as archive:
    for name in archive.namelist():
        if not name.endswith('/'):
            if Path(name).is_absolute() or '..' in Path(name).parts: raise ValueError(name)
            write(lamp_dir/name, archive.read(name))
with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['glib-compile-schemas', '--strict', '--targetdir='+tmp, str(lamp_dir/'schemas')], check=True)
    write(lamp_dir/'schemas/gschemas.compiled', (Path(tmp)/'gschemas.compiled').read_bytes())
setting('org.gnome.shell.extensions.com.github.hermes83.compiz-alike-magic-lamp-effect', 'duration', '400.0')

# Real exported app menus; generic File/Edit fallback is intentionally disabled.
appmenu_dir = Path.home()/'.local/share/gnome-shell/extensions/appmenu@ChathurangaBW.github.io'
with tempfile.TemporaryDirectory() as tmp:
    with tarfile.open(ROOT/'vendor/appmenu-5.7.1.tar.gz') as archive:
        archive.extractall(tmp, filter='data')
    for f in Path(tmp).rglob('*'):
        if f.is_file(): write(appmenu_dir/f.relative_to(tmp), f.read_bytes())
    subprocess.run(['glib-compile-schemas', '--strict', '--targetdir='+tmp, str(appmenu_dir/'schemas')], check=True)
    write(appmenu_dir/'schemas/gschemas.compiled', (Path(tmp)/'gschemas.compiled').read_bytes())
# Compact search: keep the vendor archive intact; apply reviewable overrides.
write(appmenu_dir/'searchDialog.js', (ROOT/'overrides/appmenu/searchDialog.js').read_text())
write(appmenu_dir/'stylesheet.css', (appmenu_dir/'stylesheet.css').read_text() + '\n' + (ROOT/'overrides/appmenu/search.css').read_text())
for key, value in {
    'show-os-icon': 'true', 'show-user-switcher': 'false',
    'show-workspace-indicator': 'false', 'search-shortcut': "['<Super>space']",
    'use-real-menus': 'true', 'prefer-macos-style': 'false',
}.items(): setting('org.gnome.shell.extensions.appmenu', key, value)
registrar = Path.home()/'.local/bin/macbook-appmenu-registrar.py'
write(registrar, (ROOT/'scripts/appmenu-registrar.py').read_text())
write(Path.home()/'.config/autostart/macbook-appmenu-registrar.desktop',
      '[Desktop Entry]\nType=Application\nName=Application Menu Registrar\nExec=/usr/bin/python3 '+str(registrar)+'\nNoDisplay=true\nX-GNOME-Autostart-enabled=true\n')

# Install the separate Apple menu, including its own clean icon.
for f in (ROOT/'extensions/macbook-menu@local').iterdir():
    if f.is_file(): write(Path.home()/'.local/share/gnome-shell/extensions/macbook-menu@local'/f.name,f.read_text())
s=setting('org.gnome.shell','enabled-extensions')
extensions=s.get_strv('enabled-extensions')
extensions=[x for x in extensions if x not in ('zorin-menu@zorinos.com', 'x11gestures@joseexposito.github.io')]
for required in ['appmenu@ChathurangaBW.github.io','compiz-alike-magic-lamp-effect@hermes83.github.com','touchpad-gesture-customization@coooolapps.com','macbook-menu@local','keyd@keyd.rvaiya.github.com','user-theme@gnome-shell-extensions.gcampax.github.com']:
    if required not in extensions: extensions.append(required)
s.set_strv('enabled-extensions',extensions)
Gio.Settings.sync()
print(f'Masaüstü uygulandı. Yedek: {SAVE}. keyd entegrasyonu için oturumu yeniden açın.')
