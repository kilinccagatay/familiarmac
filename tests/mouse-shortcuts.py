import importlib.util,sys,types
class Codes:
 ABS_X=0;ABS_Y=1;ABS_MT_POSITION_X=53;ABS_MT_POSITION_Y=54
 REL_WHEEL=8;REL_HWHEEL=6;REL_HWHEEL_HI_RES=12;EV_KEY=1;EV_REL=2;EV_ABS=3;REL_X=0;REL_Y=1;BTN_LEFT=272;BTN_MIDDLE=274;BTN_SIDE=275;BTN_EXTRA=276;KEY_A=30;KEY_Z=44;KEY_SPACE=57;KEY_ENTER=28
sys.modules['evdev']=types.SimpleNamespace(InputDevice=None,UInput=None,list_devices=None,ecodes=Codes)
sys.modules['gi']=types.ModuleType('gi');sys.modules['gi.repository']=types.SimpleNamespace(Gio=None)
spec=importlib.util.spec_from_file_location('mouse','native/mouse-shortcuts/daemon.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
c={1:[272,274],2:[0,1]};props='E:ID_INPUT_MOUSE=1'
assert m.compatible(c,'USB mouse',274,props)
assert not m.compatible(c,'FamiliarMac mouse bridge USB mouse',274,props)
assert not m.compatible({**c,3:[0,1]},'Trackpad',274,props)
assert not m.compatible({**c,1:[272,274,30]},'Keyboard',274,props+'\nE:ID_INPUT_KEYBOARD=1')
assert not m.compatible(c,'USB mouse',275,props)
assert m.route(272,1,274,0)==(True,False,0)
assert m.route(274,1,274,0)==(False,False,274)
assert m.route(274,0,274,274)==(False,True,0)
assert m.route(274,0,274,0)==(False,False,0)
assert m.route(274,2,274,274)==(False,False,274)
print('Mouse bridge: keyboard/touchpad exclusion, original buttons and exactly-once release PASS')

assert m.parse_choice(b'1')==(1,False)
assert m.parse_choice(b'{"mouse":0,"magic":true}')==(0,True)
for value in (b'true',b'{"mouse":true,"magic":false}',b'{"mouse":0,"magic":1}',b'{"mouse":4,"magic":false}',b'{"magic":true}',b'[]'):
 try:m.parse_choice(value)
 except ValueError:pass
 else:raise AssertionError(value)
print('Magic Mouse control protocol validates types and preserves old clients PASS')

options=m.MagicOptions(True,True,True,True,False)
assert m.parse_control(b'{"mouse":1,"magic":true,"pages":true,"spaces":true,"zoom":true,"natural":false}')==(1,options)
for field in ('pages','spaces','zoom','natural'):
 import json
 data=dict(mouse=1,magic=True,pages=True,spaces=True,zoom=True,natural=True);data[field]=1
 try:m.parse_control(json.dumps(data).encode())
 except ValueError:pass
 else:raise AssertionError(field)
reader=types.SimpleNamespace(last_contacts=1,last_contact_at=10)
assert m.suppress_wheel(Codes.REL_HWHEEL,options,reader,10)
assert not m.suppress_wheel(Codes.REL_WHEEL,options,reader,10)
reader.last_contacts=2
assert m.suppress_wheel(Codes.REL_WHEEL,options,reader,10.1)
assert not m.suppress_wheel(Codes.REL_WHEEL,options,reader,10.3)
assert not m.suppress_wheel(Codes.REL_HWHEEL,m.MagicOptions(),reader,10)
assert m.magic_pointer(c,props)
assert not m.magic_pointer(c,props+'\nE:ID_INPUT_KEYBOARD=1')
assert not m.magic_pointer(c,props+'\nE:ID_INPUT_TOUCHPAD=1')
print('Magic Mouse: strict opt-in protocol, horizontal arbitration, vertical scrolling and endpoint exclusions PASS')
from magic_mouse_support.gestures import Gesture
service=m.Service.__new__(m.Service);service.peer=b'\0familiarmac-swipe-test';service.options=m.MagicOptions(spaces=True);service.swipe=None;service.swipe_id=0
packets=[];service.send_swipe=lambda phase,dx=0:packets.append((phase,dx)) or True
assert service.stream_swipe('mouse',Gesture('swipe',2,'begin',-320,5))
assert service.stream_swipe('mouse',Gesture('swipe',2,'update',-700,5))
assert packets==[('begin',-320),('update',-700)]
assert service.stream_swipe('mouse',Gesture('swipe',2,'end',-700,5));assert service.swipe is None
service.stream_swipe('mouse',Gesture('swipe',2,'begin',0,500));assert service.swipe is None
service.peer=None;assert not service.stream_swipe('mouse',Gesture('swipe',2,'end',700,0))
print('Continuous transport: begin/update/end, vertical exclusion and legacy client fallback PASS')

service.peer=b'\0familiarmac-swipe-test';service.magic_devices={};service.magic_pointers={}
service.stream_swipe('mouse',Gesture('swipe',2,'begin',-320,5))
service.stream_swipe('mouse',Gesture('swipe',2,'update',-700,5))
service.drop_magic('other');assert service.swipe is not None
service.drop_magic('mouse');assert service.swipe is None;assert packets[-1][0]=='cancel'
count=len(packets);service.drop_magic('mouse');assert len(packets)==count
print('Disconnect cancels swipe before reader removal; unrelated devices and repeated cleanup safe PASS')

# A powered-off device may remain discoverable; repeated transport heartbeats
# must not keep its workspace gesture alive without fresh touch reports.
resets=[]
reader=types.SimpleNamespace(last_contact_at=10,recognizer=types.SimpleNamespace(reset=lambda:resets.append(True)))
service.magic_devices={'mouse':reader};service.swipe_sent=10
service.stream_swipe('mouse',Gesture('swipe',2,'begin',-320,5))
service.maintain_swipe(10.3);assert packets[-1][0]=='update'
service.swipe_sent=10.3
service.maintain_swipe(10.6);assert service.swipe is not None
service.maintain_swipe(11.01);assert service.swipe is None and packets[-1][0]=='cancel' and resets==[True]
count=len(packets);service.maintain_swipe(12);assert len(packets)==count
service.stream_swipe('mouse',Gesture('swipe',2,'begin',-320,5))
reader.last_contact_at=20
service.maintain_swipe(20.5);assert service.swipe is not None
service.magic_devices={};service.maintain_swipe(20.6);assert service.swipe is None
print('Stale physical touch cancels despite live heartbeat/discoverable device; fresh input and missing reader PASS')

# Discovery must never open keyboards, touchpads or already bridged mice.
import tempfile
from pathlib import Path as RealPath
with tempfile.TemporaryDirectory() as tmp:
 root=RealPath(tmp);(root/'dev/input').mkdir(parents=True)
 for name in ('event0','event1','event2','event3','event4'):(root/'dev/input'/name).touch()
 metadata={
  'event0':'E:ID_INPUT_KEYBOARD=1',
  'event1':'E:ID_INPUT_MOUSE=1\nE:ID_INPUT_TOUCHPAD=1',
  'event2':'E:ID_INPUT_MOUSE=1',
  'event3':'E:ID_INPUT_MOUSE=1',
  'event4':'E:ID_INPUT_MOUSE=1',
 }
 # Each fake node needs its own udev property path despite regular-file st_rdev.
 class Node:
  def __init__(self,name):self.name=name
  def __str__(self):return '/dev/input/'+self.name
  def stat(self):return types.SimpleNamespace(st_ino=1,st_rdev=int(self.name[-1])+1)
 class InputDir:
  def glob(self,pattern):return [Node(n) for n in metadata]
 for name,props in metadata.items():
  target=root/'run/udev/data'/('c0:'+str(int(name[-1])+1));target.parent.mkdir(parents=True,exist_ok=True);target.write_text(props)
 original_path=m.Path
 m.Path=lambda p:InputDir() if p=='/dev/input' else root/str(p).lstrip('/')
 opened=[];closed=[]
 class Device:
  def __init__(self,path):self.name='USB Mouse';self.info=types.SimpleNamespace(vendor=1,product=1);opened.append(path);self.path=path
  def capabilities(self,absinfo=False):return c if self.path.endswith('2') else {1:[272],2:[0,1]}
  def active_keys(self):return []
  def close(self):closed.append(self.path)
 original_input=m.InputDevice;original_bridge=m.Bridge
 m.InputDevice=Device;m.Bridge=lambda d:types.SimpleNamespace(device=d)
 probe=m.Service.__new__(m.Service);probe.magic=True;probe.devices={};probe.magic_pointers={'/dev/input/event4':object()}
 probe.scan(274);probe.scan(274)
 assert opened==['/dev/input/event2','/dev/input/event3'],opened
 assert closed==['/dev/input/event3'],closed
 # Changing the requested button rechecks a previously unsupported device.
 probe.scan(275);assert opened[-1]=='/dev/input/event3' and len(opened)==3
 m.Path=original_path;m.InputDevice=original_input;m.Bridge=original_bridge
print('Discovery: keyboard/touchpad exclusion before open, existing bridge skip, unsupported-device cache and choice change PASS')

# Changing gesture mode releases only the old Magic Mouse bridge, and only
# after its current physical click has completed. Ordinary mice stay grabbed.
import socket,struct,json
closed=[];held=[272]
magic_device=types.SimpleNamespace(info=types.SimpleNamespace(vendor=0x05ac,product=0x030d),active_keys=lambda:list(held))
ordinary_device=types.SimpleNamespace(info=types.SimpleNamespace(vendor=0x046d,product=1),active_keys=lambda:[])
magic_bridge=types.SimpleNamespace(device=magic_device,close=lambda:closed.append('magic'))
ordinary_bridge=types.SimpleNamespace(device=ordinary_device,close=lambda:closed.append('ordinary'))
probe=m.Service.__new__(m.Service)
probe.owner=1000;probe.choice=1;probe.options=m.MagicOptions();probe.magic=False;probe.peer=None;probe.swipe=None
probe.devices={'/dev/input/event16':magic_bridge,'/dev/input/event20':ordinary_bridge}
probe.magic_pointers={};probe.magic_devices={}
control=dict(mouse=1,magic=False,pages=True,spaces=False,zoom=False,natural=True)
probe.socket=types.SimpleNamespace(recvmsg=lambda *_:(json.dumps(control).encode(),[(socket.SOL_SOCKET,socket.SCM_CREDENTIALS,struct.pack('3i',123,1000,1000))],0,''))
probe.receive(1000)
probe.reconcile_magic_ownership()
assert not closed and len(probe.devices)==2, 'Do not split a held click'
# The HID path must not even open a reader while the conventional bridge owns it.
old_discover,old_reader=m.discover,m.Reader
class Entry:
 def __truediv__(self,_):return self
 def glob(self,_):return [types.SimpleNamespace(name='event16')]
m.discover=lambda:iter([('/dev/hidraw2',(0x05ac,0x030d),Entry())])
m.Reader=lambda *_:(_ for _ in ()).throw(AssertionError('Reader opened before ownership handoff'))
probe.magic_errors={};probe.scan_magic()
m.discover,m.Reader=old_discover,old_reader
held.clear();probe.reconcile_magic_ownership()
assert closed==['magic'] and list(probe.devices)==['/dev/input/event20']
# Turning gestures off releases their bridge; the conventional scan can then
# acquire Magic Mouse again without releasing the Logitech bridge.
probe.magic_pointers={'/dev/input/event16':magic_bridge}
probe.magic_devices={'/dev/hidraw2':types.SimpleNamespace(close=lambda:closed.append('reader'))}
control['pages']=False;probe.receive(1000)
assert not probe.magic_pointers and not probe.magic_devices and not probe.magic
assert list(probe.devices)==['/dev/input/event20'] and 'ordinary' not in closed
print('Ownership: mode change, held-click deferral, no duplicate grab and ordinary-mouse preservation PASS')
