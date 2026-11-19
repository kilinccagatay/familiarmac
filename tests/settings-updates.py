#!/usr/bin/env python3
"""Run native update controls against fake processes; no installation or network."""
from pathlib import Path
import os,subprocess,tempfile
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    tmp=Path(tmp);worker=tmp/'worker.py';log=tmp/'calls'
    worker.write_text('''import os,sys
from pathlib import Path
with open(os.environ['FM_TEST_CALLS'],'a') as f:f.write(' '.join(sys.argv[1:])+'\\n')
if '--install' in sys.argv:
 print('-1\\tRelease changed; check for updates again',flush=True);sys.exit(1)
assert '--force' in sys.argv
if os.environ.get('FM_TEST_CHECK_FAIL'):sys.exit(1)
print('FamiliarMac 1.2.5\\nUpdate available: 1.2.8\\n1.2.8')
''')
    binary=tmp/'test'
    subprocess.run(['cc','-O0','-Wall','-Wextra',str(root/'tests/settings-updates.c'),'-o',str(binary),'-ldl','-lm','-Wl,-l:libcairo.so.2','-Wl,-l:libgtk-4.so.1','-Wl,-l:libadwaita-1.so.0','-Wl,-l:libgio-2.0.so.0','-Wl,-l:libgobject-2.0.so.0','-Wl,-l:libglib-2.0.so.0'],check=True)
    subprocess.run([str(binary)],check=True,timeout=30,env=dict(os.environ,FAMILIARMAC_UPDATER=str(worker),FM_TEST_CALLS=str(log)))
    calls=log.read_text().splitlines()
    assert len(calls)==5,calls
    assert calls.count('--check --panel --force')==4,calls
    assert '--install 1.2.8 --progress' in calls
