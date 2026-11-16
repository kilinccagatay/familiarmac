#!/usr/bin/python3
"""User-local, version-guarded desktop source integration; system package untouched."""
from pathlib import Path
import hashlib,json,shutil,sys
repo=Path(__file__).resolve().parents[1]
uuid='zorin-desktop-icons@zorinos.com'
source=Path('/usr/share/gnome-shell/extensions')/uuid
target=Path.home()/'.local/share/gnome-shell/extensions'/uuid
state=Path.home()/'.local/state/macbook-zorin/trash-drop.json'
def hashes(root):
    return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}
if state.exists():
    if hashes(target)!=json.loads(state.read_text())['installed']:
        raise SystemExit('Desktop extension changed since installation; refusing overwrite/removal.')
    if '--restore' in sys.argv:
        shutil.rmtree(target);state.unlink();raise SystemExit('System desktop extension restored for next login.')
elif '--restore' in sys.argv:
    raise SystemExit('No managed desktop trash integration.')
elif target.exists():
    raise SystemExit('Existing user desktop extension is not managed by FamiliarMac.')
if not source.exists():raise SystemExit('Zorin desktop icons required for this integration.')
text=(source/'app/desktopIconItem.js').read_text()
anchor="        this.connectSignal(widget, 'drag-end', (w, context) => {"
if text.count(anchor)!=1:raise SystemExit('Unsupported desktop drag source version; no files changed.')
text=text.replace(anchor,(repo/'patches/desktop-trash-drop.js').read_text()+anchor)
shutil.copytree(source,target,dirs_exist_ok=True)
(target/'app/desktopIconItem.js').write_text(text)
state.parent.mkdir(parents=True,exist_ok=True)
state.write_text(json.dumps({'installed':hashes(target)},indent=2));state.chmod(0o600)
print('Desktop-to-dock trash integration installed; loads at next login.')
