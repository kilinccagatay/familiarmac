#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import tempfile

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('adapter', root/'scripts/native-electron-menus.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
    folder = Path(tmp)/'An Editor'
    (folder/'resources/app').mkdir(parents=True)
    (folder/'resources/app/package.json').write_text('{}')
    (folder/'chrome_100_percent.pak').touch()
    binary = folder/'editor'
    binary.write_bytes(b'\x7fELF Electron com.canonical.AppMenu.Registrar libdbusmenu-glib.so')
    binary.chmod(0o755)
    command = f'"{binary}" --new-window %F'
    assert m.capable(command)
    text = '[Desktop Entry]\nType=Application\nName=Editor\nExec='+command+'\n[Desktop Action new]\nExec='+command+'\n'
    result = m.launcher_text(text)
    assert result.count('--ozone-platform=x11') == 2
    assert result.count('--new-window %F') == 2
    for unsafe in (text.replace('--new-window', '--ozone-platform=wayland'),
                   text.replace('Type=Application', 'Type=Application\nDBusActivatable=true'),
                   text.replace('[Desktop Action new]\nExec='+command, '[Desktop Action new]\nExec=/bin/true')):
        try:
            m.launcher_text(unsafe)
        except ValueError:
            pass
        else:
            raise AssertionError('Unsupported launch configuration accepted')
    binary.write_bytes(b'\x7fELF Chromium only')
    assert not m.capable(command)
    binary.write_bytes(b'#!/bin/sh\n# Electron com.canonical.AppMenu.Registrar libdbusmenu-glib.so')
    assert not m.capable(command)
print('Native Electron: payload/exporter evidence, quoted paths, actions, backend/activation guards PASS')
