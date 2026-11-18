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
