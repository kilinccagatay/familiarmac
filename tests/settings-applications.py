#!/usr/bin/python3
"""Inventory escaping, truthful statuses and selected-app rediscovery persistence."""
import importlib.util,json,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('settings_apps',root/'scripts/settings-applications.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class App:
    def get_id(self):return 'test.desktop'
    def get_display_name(self):return 'Test & <app>'
    def should_show(self):return True
with tempfile.TemporaryDirectory() as tmp:
    m.STATE=Path(tmp)/'menu-inspections'
    m.Gio.AppInfo.get_all=lambda:[App()]
    assert m.inventory()[0]['status'].startswith('Not checked')
    cfg=Path(tmp)/'toolkits';cfg.mkdir();(cfg/'applications.json').write_text(json.dumps([{'id':'test.desktop','needs_review':False}]))
    assert m.inventory()[0]['status'].startswith('Configured')
    response_status = 'adapted'
    class Bus:
        def call_sync(self,*args):
            assert args[4].unpack()==(('test.desktop', 'owned-token') if args[3]=='RecheckOwned' else ('test.desktop',))
            return m.GLib.Variant('(s)',(json.dumps({'status':response_status,'message':'Adapted — 2 menu items' if response_status == 'adapted' else 'Open the application' ,'checkedAt':'2026-11-17T12:00:00Z'}),))
    m.Gio.bus_get_sync=lambda *a:Bus()
    assert m.recheck('test.desktop').startswith('Adapted')
    assert m.recheck('test.desktop', ticket='owned-token').startswith('Adapted')
    response_status = 'not-running'
    assert m.recheck('test.desktop', ui=True).endswith('\nhide')
    assert m.inventory()[0]['adapted']
    (m.STATE/'test.desktop.json').unlink()
    assert m.recheck('test.desktop', ui=True).endswith('\nopen')
    response_status = 'adapted'
    assert m.recheck('test.desktop', ui=True).endswith('\nhide')
    assert 'Last checked:' in m.inventory()[0]['status']
    try:m.recheck('../../bad')
    except ValueError:pass
    else:raise AssertionError('Unknown IDs accepted')
    # User classification is explicit, persisted, reversible through a new check.
    response_status='not-exported'
    m.recheck('test.desktop')
    m.review('test.desktop','no-menu-needed')
    assert m.inventory()[0]['review']=='no-menu-needed'
    assert not m.inventory()[0]['adapted']
    saved=json.loads((m.STATE/'test.desktop.json').read_text())
    assert saved['reviewedBy']=='user' and saved['inspection']['status']=='not-exported'
    m.review('test.desktop','needs-support')
    assert m.inventory()[0]['review']=='needs-support'
    response_status='not-running'
    m.recheck('test.desktop')
    assert m.inventory()[0]['review']=='needs-support'
    response_status='adapted'
    m.recheck('test.desktop')
    assert m.inventory()[0]['adapted'] and not m.inventory()[0]['can_review']
    try: m.review('test.desktop','no-menu-needed')
    except ValueError: pass
    else: raise AssertionError('Successful detection overwritten as missing')
    (m.STATE/'test.desktop.json').unlink()
    response_status='not-running'
    m.recheck('test.desktop')
    m.review('test.desktop','no-menu-needed')
    assert m.inventory()[0]['review']=='no-menu-needed'  # transient Apps window
    m.inventory=lambda: (_ for _ in ()).throw(AssertionError('Settings page must not enumerate apps'))
    m.generate(Path(tmp)/'page.ui')
    xml=(Path(tmp)/'page.ui').read_text();assert 'Configure Applications' in xml
    assert 'Test &amp; &lt;app&gt;' not in xml
    assert 'fm-configure-apps' in xml
    assert 'fm-recheck:' not in xml
    assert 'AdwSwitchRow" id="reduce_motion"' not in xml
source=(root/'native/settings-panel.c').read_text()
assert 'g_settings_bind(s->desktop' not in source
assert 'g_settings_get_boolean(s->desktop,"enable-animations")' in source
assert 'if(!strcmp(response,"enable"))' in source
print('Settings application inventory, per-app requests, persistence and system-motion consent guards PASS')
