#!/usr/bin/python3
import importlib.util
import json
import tempfile
from pathlib import Path
root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('desktop_install', root/'scripts/install-trash-drop.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
    base=Path(tmp); source=base/'source'; (source/'app').mkdir(parents=True)
    (source/'metadata.json').write_text(json.dumps({'uuid':m.SOURCE_UUID,'shell-version':['46']}))
    original="        this.connectSignal(widget, 'drag-end', (w, context) => {\n"
    (source/'app/desktopIconItem.js').write_text(original)
    focus='                    if (checkWorkspace) {\n'
    (source/'emulateX11WindowType.js').write_text(focus)
    target=base/m.UUID
    m.prepare(source,target,'// hook\n')
    assert json.loads((target/'metadata.json').read_text())['uuid']==m.UUID
    assert m.UUID!=m.SOURCE_UUID  # Never enter Zorin's skipped-mode-extension branch.
    assert (source/'app/desktopIconItem.js').read_text()==original
    assert (target/'app/desktopIconItem.js').read_text()=='// hook\n'+original
    assert len(m.hashes(target))==3
    assert (source/'emulateX11WindowType.js').read_text()==focus
    assert 'checkWorkspace && !Main.overview.visible' in (target/'emulateX11WindowType.js').read_text()
    (source/'app/desktopIconItem.js').write_text('unsupported')
    try: m.prepare(source,base/'invalid','// hook\n')
    except RuntimeError: pass
    else: raise AssertionError('Unsupported upstream source accepted')
    assert not (base/'invalid').exists()
print('Desktop extension identity, source preservation and version guard passed')
