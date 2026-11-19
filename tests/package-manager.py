#!/usr/bin/python3
import importlib.util
import io
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import patch
root=Path(__file__).resolve().parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
m=load('pm',root/'scripts/package-manager.py')
# Real POSIX lock, owned by another process. Never use host package locks.
with tempfile.TemporaryDirectory() as d:
 p=Path(d)/'lock';p.touch();ino=p.stat().st_ino
 with subprocess.Popen(['python3','-c','import fcntl,sys;f=open(sys.argv[1],"r+");fcntl.lockf(f,fcntl.LOCK_EX);print("ready",flush=True);sys.stdin.read()',str(p)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True) as child:
  assert child.stdout.readline().strip()=='ready';assert m.busy([p])
  child.stdin.close();child.wait()
 assert not m.busy([p]);assert p.stat().st_ino==ino
 assert not m.busy([Path(d)/'missing'])
class Process:
 def __init__(self,lines,code):self.stdout=io.StringIO(lines);self.code=code
 def __enter__(self):return self
 def __exit__(self,*a):pass
 def wait(self):return self.code
with patch.object(m,'busy',side_effect=[True,True,False,False]),patch.object(m.time,'sleep'),patch.object(m,'status') as state,patch.object(m.subprocess,'Popen',side_effect=[Process('E: Could not get lock /var/lib/dpkg/lock-frontend. It is held by process 123 (apt-get)\n',100),Process('Done\n',0)]) as popen:
 assert m.run(['install','-y','example'])==0
 assert popen.call_count==2
 assert state.call_args_list[0].args==(m.WAIT,)
with patch.object(m,'busy',return_value=False),patch.object(m,'status'),patch.object(m.subprocess,'Popen',return_value=Process('E: Unable to locate package example\n',100)) as p:
 assert m.run(['install','example'])==100;assert p.call_count==1
u=load('update',root/'scripts/release-update.py');events=[];log=io.StringIO()
with patch.object(u.subprocess,'Popen',return_value=Process('ordinary apt output\nFAMILIARMAC_STATUS\t'+m.WAIT+'\nFAMILIARMAC_STATUS\t'+m.RUN+'\n',0)):
 u.run_system_update(['test'],log,lambda f,s:events.append((f,s)))
assert events==[(.75,m.WAIT),(.75,m.RUN)];assert 'ordinary apt output' in log.getvalue()
with patch.object(u.subprocess,'Popen',return_value=Process('failure\n',100)):
 try:u.run_system_update(['test'],log,lambda *a:None);raise AssertionError('failure swallowed')
 except subprocess.CalledProcessError:pass
print('Package manager: real lock wait, release, race retry, real failure and UI progress forwarding PASS')
