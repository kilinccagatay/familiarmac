import importlib.util
from pathlib import Path
import configparser, tempfile, subprocess
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('toolkits', 'scripts/toolkit-integrations.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
 root=Path(tmp);(root/'bin').mkdir();(root/'lib/app').mkdir(parents=True)
 (root/'bin/editor').write_bytes(b'\x7fELF');(root/'lib/app/libeditor.so').write_bytes(b'\x7fELF')
 cfg=configparser.ConfigParser();cfg.read_dict({'Application':{'command':'editor'}})
 def result(args,**kwargs):
  name=Path(args[-1]).name
  lib='libeditor.so' if name=='editor' else 'libgtk-3.so.0'
  return subprocess.CompletedProcess(args,0,stdout=f'(NEEDED) Shared library: [{lib}]')
 with patch.object(m.shutil,'which',return_value='/usr/bin/readelf'),patch.object(m.subprocess,'run',side_effect=result):
  assert m.gtk3_capable(cfg,root), 'transitive GTK3 not detected'
 with patch.object(m.shutil,'which',return_value='/usr/bin/readelf'),patch.object(m.subprocess,'run',return_value=subprocess.CompletedProcess([],0,stdout='(NEEDED) [libgtk-4.so.1]')):
  assert not m.gtk3_capable(cfg,root), 'GTK4 must keep its backend'
 (root/'bin/editor').write_text('#!/bin/sh\nexit 1')
 with patch.object(m.subprocess,'run',side_effect=AssertionError('wrapper executed')):
  assert not m.gtk3_capable(cfg,root)
 (root/'bin/editor.bin').write_bytes(b'\x7fELF')
 (root/'bin/editor').write_text('#!/bin/sh\nexport EXAMPLE=value\nexec editor.bin "$@"\n')
 with patch.object(m.shutil,'which',return_value='/usr/bin/readelf'),patch.object(m.subprocess,'run',return_value=subprocess.CompletedProcess([],0,stdout='(NEEDED) [libgtk-3.so.0]')):
  assert m.gtk3_capable(cfg,root), 'literal exec wrapper should resolve without running'
 (root/'bin/editor').write_text('#!/bin/sh\nexec $(danger) "$@"\n')
 with patch.object(m.subprocess,'run',side_effect=AssertionError('dynamic wrapper executed')):
  assert not m.gtk3_capable(cfg,root)
print('Toolkit detection: transitive GTK3, GTK4 exclusion, no wrapper execution PASS')
with tempfile.TemporaryDirectory() as tmp:
 root=Path(tmp);bundle=root/'extra/unrelated-app-name';bundle.mkdir(parents=True)
 (bundle/'chrome_100_percent.pak').touch()
 binary=bundle/'arbitrary-executable';binary.write_bytes(b'\x7fELF Electron com.canonical.AppMenu.Registrar libdbusmenu-glib.so.4');binary.chmod(0o755)
 (root/'lib').mkdir();library=root/'lib/libdbusmenu-glib.so.4';library.touch()
 assert not m.electron_menu_capable(root), 'Chromium assets alone are not Electron evidence'
 (bundle/'resources').mkdir();(bundle/'resources/app.asar').touch()
 assert m.electron_menu_capable(root), 'must not depend on VS Code app ID or binary name'
 library.unlink();assert not m.electron_menu_capable(root), 'missing runtime library must not force backend'
 library.touch();binary.write_bytes(b'\x7fELF Electron');assert not m.electron_menu_capable(root)
 binary.write_bytes(b'\x7fELF Electron com.canonical.AppMenu.Registrar libdbusmenu-glib.so.4')
 (bundle/'resources/app.asar').unlink();(bundle/'resources/app').mkdir();(bundle/'resources/app/package.json').write_text('{}')
 assert m.electron_menu_capable(root)
 override=root/'override';override.write_text('[Context]\nsockets=wayland;\n')
 assert m.explicit_electron_backend(override,False)
 assert not m.explicit_electron_backend(override,True)
 override.write_text('[Environment]\nELECTRON_OZONE_PLATFORM_HINT=auto\n')
 assert m.explicit_electron_backend(override,False)
 override.write_text('[Context]\nfilesystems=~/.themes:ro;\n')
 assert not m.explicit_electron_backend(override,False)
print('Electron capability: package payload, exporter, library and explicit backend guards PASS')
with tempfile.TemporaryDirectory() as tmp:
 old_home,old_state=m.HOME,m.STATE;m.HOME=Path(tmp);m.STATE=m.HOME/'state'
 app='com.example.ElectronEditor'
 source=m.HOME/'.local/share/flatpak/exports/share/applications'/(app+'.desktop')
 source.parent.mkdir(parents=True)
 text='[Desktop Entry]\nExec=/usr/bin/flatpak run --command=editor --file-forwarding '+app+' @@ %F @@\n[Desktop Action new]\nExec=/usr/bin/flatpak run '+app+' --new-window @@u %U @@\n'
 source.write_text(text)
 m.prepare_electron_launcher(app)
 dest=m.HOME/'.local/share/applications'/(app+'.desktop');installed=dest.read_text()
 assert installed.count('--ozone-platform=x11')==2 and '@@ %F @@' in installed and '@@u %U @@' in installed
 before=dest.stat().st_mtime_ns;m.prepare_electron_launcher(app);assert dest.stat().st_mtime_ns==before
 dest.write_text(installed+'# user change\n')
 try:m.prepare_electron_launcher(app)
 except ValueError:pass
 else:raise AssertionError('User-owned launcher overwritten')
 for command in [text.replace('@@ %F @@','--ozone-platform=wayland @@ %F @@'), '[Desktop Entry]\nExec=other\n']:
  try:m.electron_launcher_text(command,app)
  except ValueError:pass
  else:raise AssertionError('Explicit or unknown launcher accepted')
 m.HOME,m.STATE=old_home,old_state
print('Electron launchers: app argv, actions/field codes, idempotence and user guards PASS')
