#!/usr/bin/python3
"""Exercise deferred transitions without launching apps or touching real profiles."""
import importlib.util
import tempfile
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
def load(name):
    spec=importlib.util.spec_from_file_location(name, ROOT/'scripts'/f'{name}.py')
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
m=load('app-lifecycle')
with tempfile.TemporaryDirectory() as temp:
    profile=Path(temp)/'settings.json';busy=[True];calls=[]
    def probe():return m.signature([profile]),busy[0]
    def apply():calls.append(1);profile.write_text('configured');return 'configured'
    jobs=[('test',probe,apply)]
    state=m.reconcile({},jobs);assert state['test']['status']=='waiting-for-exit' and not calls
    profile.write_text('first-launch');state=m.reconcile(state,jobs);assert not calls
    busy[0]=False;state=m.reconcile(state,jobs);assert len(calls)==1
    for _ in range(5):state=m.reconcile(state,jobs)
    assert len(calls)==1
    profile.write_text('changed-on-update');state=m.reconcile(state,jobs)
    assert len(calls)==1 and state['test']['status']=='waiting-for-stable-profile'
    state=m.reconcile(state,jobs);assert len(calls)==2
    # A running process that restarts before the retry must remain untouched.
    profile.write_text('changed');state=m.reconcile(state,jobs);busy[0]=True
    state=m.reconcile(state,jobs);assert len(calls)==2
    def fail():raise ValueError('private content must not enter status')
    state=m.reconcile({'bad':{'observed':'x'}},[('bad',lambda:('x',False),fail),*jobs])
    assert state['bad']=={'status':'retry-needed','error':'ValueError'} and 'test' in state
    # Editor guard also applies when invoked directly by package installation.
    ed=load('editor-decorations');ed.HOME=Path(temp);ed.STATE=Path(temp)/'state'
    desktop=ed.HOME/'.local/share/applications/code.desktop';desktop.parent.mkdir(parents=True);desktop.touch()
    with patch.object(ed,'running',return_value=True),patch.dict('os.environ',{'XDG_CONFIG_HOME':str(Path(temp)/'config')}):
        assert 'deferred' in ed.apply()[0]['status']
        assert not (Path(temp)/'config/Code/User/settings.json').exists()
    # Flatpak executable paths exist only inside the process mount namespace.
    # Resolving /proc/PID/exe with strict=True incorrectly loses these processes.
    proc=Path(temp)/'1234';proc.mkdir();(proc/'exe').symlink_to('/app/extra/vscode/code')
    (proc/'root').mkdir();(proc/'root/.flatpak-info').write_text('[Application]\nname=com.visualstudio.code\n')
    glob=Path.glob
    def proc_glob(path, pattern):
        return iter([proc]) if path==Path('/proc') else glob(path,pattern)
    with patch.object(Path,'glob',proc_glob):
        assert ed.running(Path(temp)/'config/Code','com.visualstudio.code','com.visualstudio.code.desktop')
        executables,flatpaks=m.active_processes()
        assert '/app/extra/vscode/code' in executables and 'com.visualstudio.code' in flatpaks
    lock=Path(temp)/'SingletonLock';lock.symlink_to('missing-target')
    assert ed.running(Path(temp),None,'code.desktop')
print('Lifecycle: first profile, running guard, stable retry, idle no-op, rapid restart and error isolation PASS')
