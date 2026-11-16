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
print('Toolkit detection: transitive GTK3, GTK4 exclusion, no wrapper execution PASS')
