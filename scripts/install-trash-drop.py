#!/usr/bin/python3
"""Install a separate desktop extension; never shadow a Zorin mode extension."""
from pathlib import Path
import hashlib
import json
import shutil
import sys

SOURCE_UUID = 'zorin-desktop-icons@zorinos.com'
UUID = 'familiarmac-desktop-icons@local'


def hashes(root):
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in root.rglob('*') if p.is_file()}


def prepare(source, destination, patch):
    text = (source / 'app/desktopIconItem.js').read_text()
    anchor = "        this.connectSignal(widget, 'drag-end', (w, context) => {"
    if text.count(anchor) != 1:
        raise RuntimeError('Unsupported desktop drag source version; no files changed.')
    shutil.copytree(source, destination)
    (destination / 'app/desktopIconItem.js').write_text(text.replace(anchor, patch + anchor))
    metadata = json.loads((destination / 'metadata.json').read_text())
    metadata['uuid'] = UUID
    metadata['name'] = 'FamiliarMac Desktop Icons'
    (destination / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')


def main():
    from gi.repository import Gio
    repo = Path(__file__).resolve().parents[1]
    extensions = Path.home() / '.local/share/gnome-shell/extensions'
    target = extensions / UUID
    legacy = extensions / SOURCE_UUID
    state = Path.home() / '.local/state/macbook-zorin/trash-drop.json'
    saved = json.loads(state.read_text()) if state.exists() else None
    managed = target if saved and saved.get('uuid') == UUID else legacy
    if saved and hashes(managed) != saved['installed']:
        raise SystemExit('Desktop extension changed since installation; refusing overwrite/removal.')
    if not saved and (target.exists() or legacy.exists()):
        raise SystemExit('Existing user desktop extension is not managed by FamiliarMac.')
    if saved and managed != target and target.exists():
        raise SystemExit('Destination desktop extension already exists; refusing migration.')
    settings = Gio.Settings.new('org.gnome.shell')
    enabled = list(settings.get_strv('enabled-extensions'))
    disabled = list(settings.get_strv('disabled-extensions'))
    if '--restore' in sys.argv:
        if not saved:
            print('No managed desktop trash integration.'); return
        settings.set_strv('enabled-extensions', [x for x in enabled if x != UUID])
        settings.set_strv('disabled-extensions', [x for x in disabled if x != UUID and
                          (x != SOURCE_UUID or saved.get('source_disabled', False))])
        Gio.Settings.sync()
        shutil.rmtree(managed)
        state.unlink()
        print('System desktop extension restored; log in again to complete the change.')
        return
    import tempfile
    source = Path('/usr/share/gnome-shell/extensions') / SOURCE_UUID
    extensions.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='fm-desktop-') as temp:
        staged = Path(temp) / UUID
        prepare(source, staged, (repo / 'patches/desktop-trash-drop.js').read_text())
        source_disabled = saved.get('source_disabled', False) if saved else SOURCE_UUID in disabled
        if saved:
            # Keep a recovery copy outside GNOME's extension discovery directory.
            backup = state.parent / 'desktop-extension-backup'
            if backup.exists():
                shutil.rmtree(backup)
            shutil.copytree(managed, backup)
            shutil.rmtree(managed)
        shutil.copytree(staged, target)
    state.parent.mkdir(parents=True, exist_ok=True)
    state.write_text(json.dumps({'uuid': UUID, 'source_disabled': source_disabled,
                                'installed': hashes(target)}, indent=2))
    state.chmod(0o600)
    # One desktop owner at a time. The original system package is untouched.
    settings.set_strv('disabled-extensions', [x for x in disabled if x != UUID] +
                      ([] if SOURCE_UUID in disabled else [SOURCE_UUID]))
    settings.set_strv('enabled-extensions', enabled + ([] if UUID in enabled else [UUID]))
    Gio.Settings.sync()
    print('Separate FamiliarMac desktop extension installed; log in again to complete migration.')


if __name__ == '__main__':
    main()
