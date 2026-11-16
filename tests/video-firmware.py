#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import tempfile
spec=importlib.util.spec_from_file_location('fw',Path(__file__).resolve().parents[1]/'scripts/install-nve7-video-firmware.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
assert set(m.EXPECTED)=={'nve7_fuc084','nve7_fuc085','nve7_fuc086','vuc-h264-0','vuc-mpeg12-0','vuc-mpeg4-0','vuc-mpeg4-1','vuc-vc1-0','vuc-vc1-1','vuc-vc1-2'}
with tempfile.TemporaryDirectory() as d:
 p=Path(d);m.EXPECTED={'video':m.digest(b'verified')}
 (p/'video').write_bytes(b'corrupt')
 try:m.verified_payload(p)
 except ValueError:pass
 else:raise AssertionError('corrupt source accepted')
 (p/'video').write_bytes(b'verified');payload=m.verified_payload(p)
 m.check_targets(p,payload)
 (p/'video').write_bytes(b'package-managed')
 try:m.check_targets(p,payload)
 except ValueError:pass
 else:raise AssertionError('existing differing firmware accepted')
 (p/'video').unlink();(p/'video').symlink_to(p/'missing')
 try:m.check_targets(p,payload)
 except ValueError:pass
 else:raise AssertionError('destination symlink accepted')
print('Video firmware: strict scope, corrupt-source refusal, existing-file and symlink protection PASS')
