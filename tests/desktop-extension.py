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
    original += '        this._iconContainer.pack_start(this._icon, true, true, 0);\n        this._label = new Gtk.Label();\n'
    (source/'app/desktopIconItem.js').write_text(original)
    focus="                    if (checkWorkspace) {\n        this._idMap = global.window_manager.connect_after('map',\n        this._waylandClient = client;\n        for (let window of this._windowList)\n        // disconnect signals\n"
    (source/'emulateX11WindowType.js').write_text(focus)
    manager='    onKeyPress() {\n        const selection = this.getCurrentSelection(false);\n    }\n'
    manager += '        this._cssProviderSelection.load_from_data(style);\n'
    (source/'app/desktopManager.js').write_text(manager)
    (source/'app/stylesheet.css').write_text('/* upstream */\n')
    target=base/m.UUID
    m.prepare(source,target,'// hook\n')
    assert json.loads((target/'metadata.json').read_text())['uuid']==m.UUID
    assert (source/'app/stylesheet.css').read_text()=='/* upstream */\n'
    assert '.file-item.desktop-icons-selected .fm-desktop-icon-frame' in (target/'app/stylesheet.css').read_text()
    assert m.UUID!=m.SOURCE_UUID  # Never enter Zorin's skipped-mode-extension branch.
    assert (source/'app/desktopIconItem.js').read_text()==original
    assert (target/'app/desktopIconItem.js').read_text().startswith('// hook\n')
    assert 'fm-desktop-icon-frame' in (target/'app/desktopIconItem.js').read_text()
    assert 'fm-desktop-caption' in (target/'app/desktopIconItem.js').read_text()
    assert len(m.hashes(target))==6
    assert (source/'app/desktopManager.js').read_text()==manager
    assert 'style += ' in (target/'app/desktopManager.js').read_text()
    assert '.file-item-hover' in (target/'app/desktopManager.js').read_text()
    assert 'this.doTrash();' in (target/'app/desktopManager.js').read_text()
    assert (source/'emulateX11WindowType.js').read_text()==focus
    assert 'checkWorkspace && !Main.overview.visible' in (target/'emulateX11WindowType.js').read_text()
    (source/'app/desktopIconItem.js').write_text('unsupported')
    try: m.prepare(source,base/'invalid','// hook\n')
    except RuntimeError: pass
    else: raise AssertionError('Unsupported upstream source accepted')
    assert not (base/'invalid').exists()
print('Desktop extension identity, source preservation and version guard passed')
