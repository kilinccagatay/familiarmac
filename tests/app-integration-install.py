#!/usr/bin/python3
"""Exercise the real installer in an empty home; no host services are invoked."""
from pathlib import Path
import json
import runpy
import tempfile
from unittest.mock import patch
from types import SimpleNamespace
ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    home = Path(tmp)
    calls = []
    def run(command, **kwargs):
        calls.append(command)
        return SimpleNamespace(returncode=1 if 'is-enabled' in command else 0)
    with patch('pathlib.Path.home', return_value=home), patch('subprocess.run', side_effect=run), patch('sys.argv', ['installer']):
        runpy.run_path(str(ROOT/'scripts/install-app-integrations.py'))
        dest = home/'.local/lib/familiarmac'
        for name in ('app-lifecycle.py', 'app-integrations.py', 'toolkit-integrations.py', 'chromium-integrations.py', 'flatpak-appearance.py', 'portal-owners.py'):
            assert (dest/name).read_bytes() == (ROOT/'scripts'/name).read_bytes()
        assert (dest/'appearance-config/fixed-traffic-lights.css').is_file()
        assert len(list((dest/'appearance-config/familiarmac-controls').glob('*.svg'))) == 4
        assert '/home/cagatay' not in (home/'.config/systemd/user/familiarmac-app-integrations.path').read_text()
        assert 'OnUnitInactiveSec=15' in (home/'.config/systemd/user/familiarmac-app-lifecycle.timer').read_text()
        assert 'familiarmac-app-lifecycle.timer' in calls[-3]
        snapshot = {p.relative_to(home): p.read_bytes() for p in home.rglob('*') if p.is_file()}
        runpy.run_path(str(ROOT/'scripts/install-app-integrations.py'))
        assert snapshot == {p.relative_to(home): p.read_bytes() for p in home.rglob('*') if p.is_file()}
    calls.clear()
    with patch('pathlib.Path.home', return_value=home), patch('subprocess.run', side_effect=run), patch('sys.argv', ['installer', '--restore']):
        try: runpy.run_path(str(ROOT/'scripts/install-app-integrations.py'))
        except SystemExit: pass
    assert calls[0][:4] == ['systemctl', '--user', 'disable', '--now'], calls
    assert 'familiarmac-app-integrations.path' in calls[0]
    assert 'familiarmac-portal-owners.service' in calls[1]
    assert 'chromium-integrations.py' in calls[2][1]
print('Fresh-home installation, repeat installation and watcher-first restore PASS')
