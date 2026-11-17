#!/usr/bin/env python3
"""Opt-in pinned WSF installer. Never restarts Shell or edits system files."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
HOME = Path.home()
STATE = HOME / '.local/state/macbook-zorin/wsf.json'
UUID = 'touchpad-speed-control@ritesh'
SCHEMA = 'org.gnome.shell.extensions.touchpad-speed-control'
LIB = HOME / '.local/lib/wayland-scroll-factor/libwsf_preload.so'
DROP = HOME / '.config/systemd/user/org.gnome.Shell@wayland.service.d/95-wsf.conf'
ENV = HOME / '.config/environment.d/wayland-scroll-factor.conf'
OLD_DROP = HOME / '.config/systemd/user/org.gnome.Shell@wayland.service.d/90-macbook-scroll.conf'
OLD_LIB = HOME / '.local/lib/macbook-zorin/scroll-scale.so'
EXT = HOME / '.local/share/gnome-shell/extensions' / UUID
CONFIG = HOME / '.config/wayland-scroll-factor/config'

def run(*args):
    return subprocess.check_output(args, text=True).strip()

def digest(data):
    return hashlib.sha256(data).hexdigest()

def save(state):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_suffix('.tmp')
    tmp.write_text(json.dumps(state, indent=2))
    tmp.chmod(0o600)
    tmp.replace(STATE)

def settings():
    from gi.repository import Gio
    source = Gio.SettingsSchemaSource.new_from_directory(str(EXT/'schemas'), Gio.SettingsSchemaSource.get_default(), False)
    return Gio.Settings.new_full(source.lookup(SCHEMA, False), None, None)

def check_legacy():
    expected = f'[Service]\nEnvironment="LD_PRELOAD={OLD_LIB}"\n'
    if OLD_DROP.exists() and OLD_DROP.read_text() != expected:
        raise SystemExit('Legacy drop-in was edited; inspect it manually. Nothing removed.')
    # Only our exact historical build is eligible for removal.
    if OLD_LIB.exists():
        allowed = json.loads((ROOT/'config/legacy-scroll-hashes.json').read_text())
        if digest(OLD_LIB.read_bytes()) not in allowed:
            raise SystemExit('Unrecognized legacy library; inspect manually. Nothing removed.')

def restore(state):
    from gi.repository import Gio, GLib
    manager = run('systemctl','--user','show-environment')
    preload = re.findall(r'^LD_PRELOAD=(.*)$', manager, re.M)
    if any(value != str(LIB) for value in preload):
        raise SystemExit('User manager preload changed; refusing restore.')
    for name, record in state['files'].items():
        p = Path(name)
        if p.exists() and digest(p.read_bytes()) != record['installed']:
            raise SystemExit(f'Changed since installation: {p}; refusing restore.')
    shell = Gio.Settings.new('org.gnome.shell')
    if not state['extension_was_enabled']:
        shell.set_strv('enabled-extensions', [x for x in shell.get_strv('enabled-extensions') if x != UUID])
    s = settings()
    for key, val in state['settings'].items():
        if val is None: s.reset(key)
        else: s.set_value(key, GLib.Variant.parse(None, val, None, None))
    Gio.Settings.sync()
    # Files restored only after all preflight checks; legacy scaler is never resurrected.
    for name, record in state['files'].items():
        p = Path(name)
        if record['before'] is None: p.unlink(missing_ok=True)
        else:
            p.write_bytes(base64.b64decode(record['before']))
            p.chmod(record['mode'])
    subprocess.run(['systemctl','--user','daemon-reload'], check=True)
    subprocess.run(['systemctl','--user','unset-environment','LD_PRELOAD'], check=True)
    STATE.unlink()
    print('WSF configuration restored; log out/in manually. Legacy scaler stays removed.')

def main():
    if os.geteuid() == 0: raise SystemExit('Run as desktop user, not root.')
    if '--restore' in sys.argv:
        if not STATE.exists(): raise SystemExit('No managed WSF installation.')
        restore(json.loads(STATE.read_text())); return
    if os.environ.get('XDG_SESSION_TYPE') != 'wayland': raise SystemExit('GNOME Wayland session required.')
    if not re.search(r'\b46\.', run('gnome-shell','--version')):
        raise SystemExit('This integration is validated for GNOME 46 only.')
    if any(c in str(HOME) for c in '\n\r%"\\ '):
        raise SystemExit('Unsupported home path for systemd preload arguments.')
    for tool in ['gcc','glib-compile-schemas','systemctl','readelf']:
        if not shutil.which(tool): raise SystemExit(f'Missing dependency: {tool}')
    check_legacy()
    for p in (ENV, DROP):
        if p.exists() and str(LIB) not in p.read_text():
            raise SystemExit(f'Unmanaged configuration: {p}')
    active = run('systemctl','--user','show','org.gnome.Shell@wayland.service','-p','ExecStart','--value')
    command = re.search(r'argv\[\]=(.*?) ;', active)
    allowed = ['/usr/bin/gnome-shell', '/usr/local/libexec/macbook-gdm-shell', f'/usr/bin/env LD_PRELOAD={LIB} /usr/bin/gnome-shell']
    if not command or command.group(1).strip() not in allowed:
        raise SystemExit('Unrecognized Shell launch command; inspect before overriding.')
    # Do not drop another preload, whether inherited or configured on the service.
    envs = run('systemctl','--user','show','org.gnome.Shell@wayland.service','-p','Environment','--value')
    manager = run('systemctl','--user','show-environment')
    for text in (envs, manager, os.environ.get('LD_PRELOAD','')):
        if text == os.environ.get('LD_PRELOAD',''):
            values = [text]
        else: values = re.findall(r'LD_PRELOAD=([^\s\n]*)', text)
        for value in values:
            if any(x not in (str(LIB),str(OLD_LIB)) for x in re.split(r'[: ]+',value.strip('"')) if x):
                raise SystemExit('Another LD_PRELOAD exists; refusing to replace it.')
    manifest = json.loads((ROOT/'vendor/manifest.json').read_text())
    for item in manifest:
        if any(part in item['path'] for part in ['wayland-scroll-factor-1.0.4/', 'touchpad-speed-control-v5/']):
            if digest((ROOT/item['path']).read_bytes()) != item['sha256']:
                raise SystemExit('Pinned source checksum mismatch: '+item['path'])
    src = ROOT/'vendor/wayland-scroll-factor-1.0.4'
    subprocess.run(['bash',str(src/'scripts/check-libinput-abi.sh')],check=True)
    with tempfile.TemporaryDirectory(prefix='familiarmac-wsf-') as td:
        tmp = Path(td)
        flags = ['gcc','-O2','-std=c11','-fstack-protector-strong','-D_FORTIFY_SOURCE=2','-Wl,-z,relro,-z,now']
        common = [str(src/'src/wsf_config.c'),str(src/'src/wsf_proc.c')]
        subprocess.run(flags+['-shared','-fPIC','-fvisibility=hidden',str(src/'src/wsf_preload.c')]+common+['-ldl','-pthread','-o',str(tmp/'lib.so')],check=True)
        subprocess.run(flags+['-fPIE','-pie',f'-DWSF_LIBDIR="{LIB.parent}"','-DWSF_VERSION="1.0.4"','-I'+str(src/'src'),str(src/'tools/wsf.c')]+common+['-ldl','-o',str(tmp/'wsf')],check=True)
        shutil.copytree(ROOT/'vendor/touchpad-speed-control-v5',tmp/'extension')
        subprocess.run(['glib-compile-schemas',str(tmp/'extension/schemas')],check=True)
        payload = {LIB:(tmp/'lib.so').read_bytes(),HOME/'.local/bin/wsf':(tmp/'wsf').read_bytes()}
        for p in (tmp/'extension').rglob('*'):
            if p.is_file(): payload[EXT/p.relative_to(tmp/'extension')] = p.read_bytes()
        payload[LIB.parent/'LICENSE'] = (src/'LICENSE').read_bytes()
        payload[DROP] = f'[Service]\n# FamiliarMac WSF: user compositor only; system/GDM service unchanged.\nExecStart=\nExecStart=/usr/bin/env LD_PRELOAD={LIB} /usr/bin/gnome-shell\n'.encode()
        payload[ENV] = f'# Generated by wsf\nLD_PRELOAD={LIB}\n'.encode()
        payload[CONFIG] = b'scroll_vertical_factor=0.2500\nscroll_horizontal_factor=0.2500\npinch_zoom_factor=1.0000\npinch_rotate_factor=1.0000\n'
        from gi.repository import Gio
        shell = Gio.Settings.new('org.gnome.shell')
        if STATE.exists():
            state=json.loads(STATE.read_text())
            for name,record in state['files'].items():
                p=Path(name)
                if not p.exists() or digest(p.read_bytes()) != record['installed']:
                    raise SystemExit(f'Managed file changed: {p}. No overwrite.')
            print('WSF already installed; existing tuning retained.'); return
        state={'files':{},'settings':{},'extension_was_enabled':UUID in shell.get_strv('enabled-extensions')}
        if (EXT/'schemas/gschemas.compiled').exists():
            s=settings()
            for k in ['global-factor','h-global-factor','app-factors','h-app-factors','show-panel-indicator','enabled']:
                v=s.get_user_value(k);state['settings'][k]=v.print_(True) if v is not None else None
        else:
            state['settings']={k:None for k in ['global-factor','h-global-factor','app-factors','h-app-factors','show-panel-indicator','enabled']}
        for p,data in payload.items():
            # Adopting the manual experiment must not leave WSF preloaded on undo.
            before=p.read_bytes() if p.exists() and p not in (ENV,DROP) else None
            state['files'][str(p)]={'before':base64.b64encode(before).decode() if before is not None else None,'mode':p.stat().st_mode & 0o777 if p.exists() else 0o644,'installed':digest(data)}
        save(state)  # Recoverable record exists before any installed file changes.
        for p,data in payload.items():
            p.parent.mkdir(parents=True,exist_ok=True)
            staging=p.with_name(p.name+'.fm-new');staging.write_bytes(data)
            staging.chmod(0o755 if p in (LIB,HOME/'.local/bin/wsf') else 0o644)
            staging.replace(p)
        s=settings()
        from gi.repository import GLib
        s.set_double('global-factor',0.25);s.set_double('h-global-factor',0.25)
        for k in ['app-factors','h-app-factors']:s.set_value(k,GLib.Variant('a{sd}',{}))
        s.set_boolean('show-panel-indicator',False);s.set_boolean('enabled',True)
        shell.set_strv('enabled-extensions',list(dict.fromkeys(shell.get_strv('enabled-extensions')+[UUID])))
        Gio.Settings.sync()
        OLD_DROP.unlink(missing_ok=True);OLD_LIB.unlink(missing_ok=True)
        subprocess.run(['systemctl','--user','daemon-reload'],check=True)
        subprocess.run(['systemctl','--user','set-environment',f'LD_PRELOAD={LIB}'],check=True)
        print('WSF 1.0.4 + Touchpad Speed Control 5 installed at 25%. Log out/in manually; no Shell restart.')

if __name__ == '__main__': main()
