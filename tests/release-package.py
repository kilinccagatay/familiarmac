#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import subprocess
import tarfile
import tempfile
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('packager',root/'scripts/release-package.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
with tempfile.TemporaryDirectory() as tmp:
    dest=Path(tmp);p.build(dest)
    archive=next(dest.glob('*.tar.gz'))
    subprocess.run(['sha256sum','--check','SHA256SUMS'],cwd=dest,check=True)
    with tarfile.open(archive) as t:
        names=t.getnames()
        assert not {Path(n).name for n in names}&p.MANUAL
        assert not any('/.git/' in n or '/.state/' in n for n in names)
        for path in ('VERSION','RELEASE.json','extensions/macbook-menu@local/dockBounce.js','extensions/familiarmac-display-scale@local/extension.js','native/settings-panel.c','scripts/dock-window.ui','scripts/release-update.py'):
            assert any(n.endswith('/'+path) for n in names),path
        t.extractall(dest/'unpack',filter='data')
    package=next((dest/'unpack').iterdir())
    for args in (['--full'],['--desktop','--wifi'],['--desktop','--brightness']):
        r=subprocess.run(['bash','install.sh',*args,'--dry-run'],cwd=package,capture_output=True,text=True)
        assert r.returncode==2,(args,r.stdout,r.stderr)
    r=subprocess.run(['bash','install.sh','--all','--dry-run'],cwd=package,capture_output=True,text=True,check=True)
    assert 'scripts/system.sh' not in r.stdout and 'scripts/wifi.sh' not in r.stdout
print('Release package contents, checksum, portable install and hardware-mode refusal PASS')
