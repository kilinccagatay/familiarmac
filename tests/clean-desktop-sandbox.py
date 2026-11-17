#!/usr/bin/env python3
"""Opt-in integration test on Zorin 18: real installers, isolated HOME/settings.
Requires bwrap and installed build dependencies. No host service bus or writes.
This is not a fresh OS/VM or a running GNOME Shell visual test.
"""
import argparse,hashlib,json,os,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--node',default=shutil.which('node'));args=p.parse_args()
if not args.node:raise SystemExit('Pass --node /path/to/node (18+)')
if os.geteuid()==0:raise SystemExit('Run as an ordinary user')
for tool in ('bwrap','dbus-run-session','sassc','xmllint'):
    if not shutil.which(tool):raise SystemExit('Missing '+tool)

def protected():
    out={}
    for d in ('/etc/default/grub','/etc/modprobe.d','/etc/initramfs-tools','/etc/NetworkManager','/boot'):
        path=Path(d)
        for f in ([path] if path.is_file() else path.rglob('*')):
            try:
                if f.is_file():out[str(f)]=hashlib.sha256(f.read_bytes()).hexdigest()
            except PermissionError:out[str(f)]='unreadable'
    return out
before=protected()
with tempfile.TemporaryDirectory(prefix='fm-clean-install-') as td:
    t=Path(td)
    for n in ('home','themes','icons','localshare','bin','identity','flatpak'): (t/n).mkdir()
    for sub in ('objects','refs/heads','refs/remotes','tmp','state','extensions'):
        (t/'flatpak/repo'/sub).mkdir(parents=True,exist_ok=True)
    (t/'flatpak/repo/config').write_text('[core]\nrepo_version=1\nmode=bare-user-only\n')
    (t/'identity/product_name').write_text('PortableTestPC\n');(t/'identity/sys_vendor').write_text('Other\n');(t/'identity/chassis_type').write_text('9\n')
    (t/'bin/systemctl').write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$HOME/service-calls.log"\ncase "$*" in *is-enabled*) exit 1;; esac\nexit 0\n')
    (t/'bin/sudo').write_text('#!/bin/sh\necho "Unexpected privileged command blocked: $*" >&2\nexit 91\n')
    (t/'bin/node').touch()
    for f in (t/'bin').iterdir():f.chmod(0o755)
    def run(command,root=False,check=True):
        cmd=['bwrap','--die-with-parent','--unshare-all','--ro-bind','/','/',
             '--tmpfs','/home','--tmpfs','/root','--tmpfs','/run','--tmpfs','/tmp',
             '--proc','/proc','--dev','/dev','--ro-bind',str(ROOT),'/tmp/repo',
             '--bind',str(t/'home'),'/home/test','--bind',str(t/'themes'),'/usr/share/themes',
             '--bind',str(t/'icons'),'/usr/share/icons','--bind',str(t/'localshare'),'/usr/local/share',
             '--ro-bind',str(t/'bin'),'/tmp/testbin','--ro-bind',str(Path(args.node).resolve()),'/tmp/testbin/node',
             '--ro-bind',str(t/'identity'),'/sys/class/dmi/id',
             '--bind',str(t/'flatpak'),'/var/lib/flatpak','--tmpfs','/var/lib/snapd',
             '--clearenv','--setenv','HOME','/home/test','--setenv','PATH','/tmp/testbin:/usr/bin:/bin',
             '--setenv','XDG_CONFIG_HOME','/home/test/.config','--setenv','XDG_DATA_HOME','/home/test/.local/share',
             '--setenv','XDG_STATE_HOME','/home/test/.local/state','--setenv','XDG_RUNTIME_DIR','/run/test',
             '--dir','/run/test','--setenv','XDG_SESSION_TYPE','wayland','--setenv','GSETTINGS_BACKEND','keyfile',
             '--setenv','LANG','C.UTF-8','--chdir','/tmp/repo']
        if root:cmd+=['--uid','0']
        cmd+=['dbus-run-session','--',*command]
        r=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
        print(r.stdout,flush=True)
        if check and r.returncode:raise RuntimeError(f'{command} exited {r.returncode}')
        return r
    # Dependencies come from host; real theme construction goes to empty mounts.
    run(['bash','scripts/install-desktop-themes.sh'],root=True)
    assert (t/'themes/MacBook-WhiteSur-Dark/gtk-4.0/gtk.css').is_file()
    assert (t/'localshare/macbook-zorin/wallpaper.png').is_file()
    run(['gsettings','set','org.gnome.shell','favorite-apps',"['org.familiarmac.Missing.desktop']"])
    run(['gsettings','set','org.gnome.desktop.interface','enable-animations','false'])
    run(['bash','install.sh','--desktop'])
    h=t/'home'
    expected=['.local/share/gnome-shell/extensions/familiarmac-genie@local/extension.js',
              '.local/share/gnome-shell/extensions/familiarmac-genie@local/schemas/gschemas.compiled',
              '.local/share/applications/familiarmac-genie-preferences.desktop',
              '.local/share/gnome-shell/extensions/macbook-menu@local/extension.js',
              '.local/lib/familiarmac/app-lifecycle.py','.config/systemd/user/familiarmac-app-lifecycle.timer',
              '.local/share/familiarmac/about/device.svg','.config/gtk-4.0/gtk.css',
              '.local/share/gnome-shell/extensions/familiarmac-desktop-icons@local/metadata.json']
    for f in expected:assert (h/f).is_file(),f
    assert json.loads((h/'.local/share/familiarmac/about/device.json').read_text())['model']=='PortableTestPC'
    # Full profile must reject a foreign model before reaching sudo.
    r=run(['bash','install.sh','--full'],check=False)
    assert r.returncode!=0 and 'Full hardware profile only supports MacBookPro10,1' in r.stdout
    assert 'Unexpected privileged' not in r.stdout
    old='compiz-alike-magic-lamp-effect@hermes83.github.com'
    genie='familiarmac-genie@local'
    assert not (h/'.local/share/gnome-shell/extensions'/old).exists()
    assert genie in run(['gsettings','get','org.gnome.shell','enabled-extensions']).stdout
    assert 'false' in run(['gsettings','get','org.gnome.desktop.interface','enable-animations']).stdout
    # Simulate an older installed profile, without destroying user extension files.
    legacy=h/'.local/share/gnome-shell/extensions'/old;legacy.mkdir();(legacy/'keep.txt').write_text('user-owned')
    run(['gsettings','set','org.gnome.shell','enabled-extensions',f"['{old}']"])
    run(['gsettings','set','org.gnome.shell','disabled-extensions',f"['{genie}']"])
    schema='/home/test/.local/share/gnome-shell/extensions/familiarmac-genie@local/schemas'
    run(['gsettings','--schemadir',schema,'set','org.gnome.shell.extensions.familiarmac-genie','animate','false'])
    # Second application must succeed and retain a single owned CSS block.
    run(['bash','install.sh','--desktop'])
    enabled=run(['gsettings','get','org.gnome.shell','enabled-extensions']).stdout
    disabled=run(['gsettings','get','org.gnome.shell','disabled-extensions']).stdout
    assert genie in enabled and old not in enabled and old in disabled and genie not in disabled
    assert (legacy/'keep.txt').read_text()=='user-owned'
    assert 'false' in run(['gsettings','--schemadir',schema,'get','org.gnome.shell.extensions.familiarmac-genie','animate']).stdout
    assert 'false' in run(['gsettings','get','org.gnome.desktop.interface','enable-animations']).stdout
    assert (h/'.config/gtk-4.0/gtk.css').read_text().count('/* BEGIN macbook-zorin */')==1
    calls=(h/'service-calls.log').read_text();assert 'familiarmac-app-lifecycle.timer' in calls
    assert all(line.startswith('--user ') for line in calls.splitlines())
    run(['flatpak','list','--app','--columns=application'])
    run(['python3','/home/test/.local/lib/familiarmac/app-integrations.py'])
    run(['python3','/home/test/.local/lib/familiarmac/app-lifecycle.py'])
    # Simulate an installed supported app without launching any user application.
    desktop=h/'.local/share/applications/code.desktop'
    desktop.write_text('[Desktop Entry]\nType=Application\nName=Sandbox Code fixture\nExec=/bin/true\n')
    lifecycle=['python3','/home/test/.local/lib/familiarmac/app-lifecycle.py']
    run(lifecycle);run(lifecycle)
    editor=h/'.config/Code/User/settings.json'
    assert json.loads(editor.read_text())['window.titleBarStyle']=='native'
    # A profile created after installation is deferred while its lock exists.
    chrome=h/'.var/app/com.google.Chrome/config/google-chrome'
    prefs=chrome/'Default/Preferences';prefs.parent.mkdir(parents=True)
    prefs.write_text('{"browser":{"custom_chrome_frame":true},"test_keep":42}')
    lock=chrome/'SingletonLock';lock.symlink_to('sandbox-busy-profile')
    run(lifecycle);run(lifecycle)
    assert json.loads(prefs.read_text())['browser']['custom_chrome_frame'] is True
    lock.unlink();run(lifecycle);run(lifecycle)
    saved=json.loads(prefs.read_text())
    assert saved['browser']['custom_chrome_frame'] is False and saved['test_keep']==42
    snapshot=prefs.stat().st_mtime_ns;run(lifecycle)
    assert prefs.stat().st_mtime_ns==snapshot
    print('PASS: newly discovered editor, deferred locked browser profile, exit retry and unchanged-profile no-op')
    print('PASS: real theme build, foreign-device desktop install/reinstall, adapters, user units, full-mode refusal')
assert protected()==before,'Protected host files changed'
print('PASS: readable host boot, module, initramfs and network files unchanged; sandbox removed')
