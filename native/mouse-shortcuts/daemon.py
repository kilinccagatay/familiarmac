#!/usr/bin/python3
"""Seat-local optional mouse shortcuts. No keyboard/absolute-device grabs."""
import os, socket, struct, time, select, signal, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "vendor/familiarmac-magic-mouse"))
from magic_mouse_support.devices import Reader, discover
sys.path.insert(0, str(Path(__file__).resolve().parent))
from gesture_actions import MagicOptions, action_for
from seat_state import SeatState
from evdev import InputDevice, UInput, ecodes as E
from gi.repository import Gio

SOCKET='/run/familiarmac-mouse/control.sock'
BUTTONS={1:E.BTN_MIDDLE,2:E.BTN_SIDE,3:E.BTN_EXTRA}
PREFIX='FamiliarMac mouse bridge'

def is_magic_device(device):
    return device.info.vendor in (0x05ac,0x004c) and device.info.product in (0x030d,0x0269,0x0323)

def compatible(caps, name, button, properties):
    keys=caps.get(E.EV_KEY,[]);rel=caps.get(E.EV_REL,[])
    return ('E:ID_INPUT_MOUSE=1' in properties and 'E:ID_INPUT_KEYBOARD=1' not in properties and 'E:ID_INPUT_TOUCHPAD=1' not in properties and not name.startswith(PREFIX) and not any(axis in caps.get(E.EV_ABS,[]) for axis in (E.ABS_X,E.ABS_Y,E.ABS_MT_POSITION_X,E.ABS_MT_POSITION_Y))
        and E.REL_X in rel and E.REL_Y in rel and E.BTN_LEFT in keys
        and button in keys)

def route(code,value,selected,armed):
    if code!=selected:return True,False,armed
    if value==1:return False,False,code
    if value==0:return False,armed==code,0
    return False,False,armed

def parse_control(data):
    value=json.loads(data.decode('ascii'))
    if type(value) is int:
        choice,options=value,MagicOptions()
    elif isinstance(value,dict) and set(value)=={'mouse','magic'}:
        choice=value['mouse']
        if type(value['magic']) is not bool:raise ValueError('Invalid magic value')
        options=MagicOptions(mission=value['magic'])
    elif isinstance(value,dict) and set(value) in ({'mouse','magic','pages','spaces','zoom','natural'}, {'mouse','magic','pages','spaces','zoom','natural','page_stream'}):
        choice=value['mouse']
        if any(type(value[k]) is not bool for k in ('magic','pages','spaces','zoom','natural')):
            raise ValueError('Invalid gesture values')
        if type(value.get('page_stream',False)) is not bool:raise ValueError('Invalid streaming capability')
        options=MagicOptions(value['magic'],value['pages'],value['spaces'],value['zoom'],value['natural'],value.get('page_stream',False))
    else:raise ValueError('Invalid control packet')
    if type(choice) is not int or choice not in (0,1,2,3):raise ValueError('Invalid mouse value')
    return choice,options

def parse_choice(data):
    choice,options=parse_control(data)
    return choice,options.mission

def magic_pointer(caps, props):
    # Only the relative mouse endpoint of an already hardware-identified Magic Mouse.
    return ('E:ID_INPUT_MOUSE=1' in props and 'E:ID_INPUT_KEYBOARD=1' not in props
            and 'E:ID_INPUT_TOUCHPAD=1' not in props and E.BTN_LEFT in caps.get(E.EV_KEY,[])
            and all(axis in caps.get(E.EV_REL,[]) for axis in (E.REL_X,E.REL_Y)))

def suppress_wheel(code, options, reader, now):
    horizontal=code in (E.REL_HWHEEL,getattr(E,'REL_HWHEEL_HI_RES',12))
    if options.pages and horizontal:return True
    # Keep the last contact count briefly through the release packet.
    return options.spaces and reader.last_contacts==2 and now-reader.last_contact_at<.15


class Bridge:
    def __init__(self,device,magic=False):
        self.device=device;self.armed=0;self.magic=magic
        caps={k:v for k,v in device.capabilities().items() if k in (E.EV_KEY,E.EV_REL,E.EV_MSC,E.EV_ABS)}
        if magic:caps.pop(E.EV_ABS,None)
        self.output=UInput(caps,name=PREFIX+' '+device.name,phys='familiarmac/mouse',
            vendor=device.info.vendor,product=device.info.product,version=device.info.version,bustype=device.info.bustype)
        try:device.grab()
        except Exception:self.output.close();raise
    def close(self):
        try:self.device.ungrab()
        except OSError:pass
        self.device.close();self.output.close()

class Service:
    def __init__(self):
        self.bus=Gio.bus_get_sync(Gio.BusType.SYSTEM,None)
        self.socket=socket.socket(socket.AF_UNIX,socket.SOCK_DGRAM)
        self.socket.setsockopt(socket.SOL_SOCKET,socket.SO_PASSCRED,1)
        try:os.unlink(SOCKET)
        except FileNotFoundError:pass
        self.socket.bind(SOCKET);os.chmod(SOCKET,0o666);self.socket.setblocking(False)
        self.keyboard=UInput({E.EV_KEY:[E.KEY_F18,E.KEY_F14,E.KEY_F15,E.KEY_F16,E.KEY_BACK,E.KEY_FORWARD]},name=PREFIX+' action',phys='familiarmac/action')
        self.peer=None;self.swipe=None;self.swipe_id=0;self.swipe_sent=0;self.magic_devices={};self.magic=False;self.options=MagicOptions();self.magic_pointers={};self.last_gesture=None;self.magic_actions=0;self.magic_errors={};self.devices={};self.owner=None;self.choice=0;self.last=0;self.running=True;self.presses=0;self.actions=0;self.last_status=None;self.status_at=0
    def property(self,path,interface,key):
        from gi.repository import GLib
        return self.bus.call_sync('org.freedesktop.login1',path,'org.freedesktop.DBus.Properties','Get',GLib.Variant('(ss)',(interface,key)),None,0,1000,None).unpack()[0]
    def active_user(self):
        try:
            _,path=self.property('/org/freedesktop/login1/seat/seat0','org.freedesktop.login1.Seat','ActiveSession')
            if path=='/':return None
            if self.property(path,'org.freedesktop.login1.Session','LockedHint'):return None
            return self.property(path,'org.freedesktop.login1.Session','User')[0]
        except Exception:return None
    def receive(self,uid):
        data,anc,flags,peer=self.socket.recvmsg(256,socket.CMSG_SPACE(12))
        if flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC):return
        credentials=next((struct.unpack('3i',v[:12]) for level,kind,v in anc if level==socket.SOL_SOCKET and kind==socket.SCM_CREDENTIALS),None)
        if not credentials or credentials[1]!=uid:return
        try:
            choice,options=parse_control(data)
            magic=options.enabled
        except (ValueError,UnicodeError,TypeError):return
        if self.owner!=uid:self.release()
        if self.choice!=choice:self.release_pointer()
        if self.options!=options:self.release_magic()
        if peer!=self.peer:self.cancel_swipe()
        self.peer=peer if isinstance(peer,bytes) and peer.startswith(b'\0familiarmac-swipe-') else None
        self.owner=uid;self.last=time.monotonic();self.choice=choice;self.magic=magic;self.options=options
    def status(self):
        now=time.monotonic()
        if now<self.status_at:return
        self.status_at=now+1
        state={"choice":self.choice,"devices":[b.device.name for b in self.devices.values()],"presses":self.presses,"actions":self.actions,"magic_enabled":self.magic,"magic_options":vars(self.options),"last_gesture":self.last_gesture,"magic_pointer_devices":[b.device.name for b in self.magic_pointers.values()],"magic_actions":self.magic_actions,
               "magic_devices":[{"path":r.path,"product":f"{r.product:04x}","frames":r.frames,"invalid":r.invalid} for r in self.magic_devices.values()],"magic_errors":self.magic_errors}
        if state!=self.last_status:
            with open("/run/familiarmac-mouse/status.json.tmp","w") as f:json.dump(state,f)
            os.replace("/run/familiarmac-mouse/status.json.tmp","/run/familiarmac-mouse/status.json")
            self.last_status=state
    def release(self):
        self.release_pointer();self.release_magic()
    def release_pointer(self):
        for bridge in self.devices.values():bridge.close()
        self.devices.clear()
    def release_magic(self):
        self.cancel_swipe()
        for bridge in self.magic_pointers.values():bridge.close()
        self.magic_pointers.clear()
        for reader in self.magic_devices.values():reader.close()
        self.magic_devices.clear()
    def scan(self,button):
        # evdev.list_devices() opens/closes EVERY input device to enumerate it.
        # Some kernel close paths wait tens of milliseconds. Never put that
        # enumeration in the grabbed-pointer forwarding loop.
        ignored=getattr(self,'_scan_ignored',{})
        present=set()
        for node in Path('/dev/input').glob('event*'):
            path=str(node);present.add(path)
            if path in self.devices or path in self.magic_pointers:continue
            device=None
            try:
                info=node.stat();dev=info.st_rdev
                identity=(info.st_ino,dev,button,self.magic)
                if ignored.get(path)==identity:continue
                props=Path('/run/udev/data/c%d:%d'%(os.major(dev),os.minor(dev)))
                # Missing udev metadata is retried after device initialization.
                if not props.exists():continue
                text=props.read_text()
                seat=next((line[10:] for line in text.splitlines() if line.startswith('E:ID_SEAT=')),'seat0')
                if (seat!='seat0' or 'E:ID_INPUT_MOUSE=1' not in text
                    or 'E:ID_INPUT_KEYBOARD=1' in text or 'E:ID_INPUT_TOUCHPAD=1' in text):continue
                name=Path('/sys/class/input')/node.name/'device/name'
                if name.exists() and name.read_text().startswith(PREFIX):continue
                device=InputDevice(path)
                if (self.magic and is_magic_device(device)
                    or not compatible(device.capabilities(absinfo=False),device.name,button,text)):
                    ignored[path]=identity;continue
                if any(k>=E.BTN_MOUSE for k in device.active_keys()):continue
                self.devices[path]=Bridge(device);device=None
            except OSError:pass
            finally:
                if device:device.close()
        self._scan_ignored={p:key for p,key in ignored.items() if p in present}
    def reconcile_magic_ownership(self):
        # A mode change must hand over an existing conventional bridge before
        # the HID gesture path tries EVIOCGRAB. Complete any held click first.
        for path,bridge in list(self.devices.items()):
            if not is_magic_device(bridge.device):continue
            try:
                if bridge.device.active_keys():continue
            except OSError:pass
            bridge.close();self.devices.pop(path,None)

    def scan_magic(self):
        self.reconcile_magic_ownership()
        found=set()
        for path,(_,product),entry in discover():
            found.add(path)
            if path in self.magic_devices:continue
            # Both hidraw and its associated input nodes must belong to seat0.
            paths=[Path(path)]+[Path('/dev/input')/p.name for p in (entry/'device').glob('input/input*/event*')]
            if any(str(node) in self.devices for node in paths[1:]):continue
            try:
                allowed=True
                for node in paths:
                    dev=node.stat().st_rdev
                    prop=Path('/run/udev/data/c%d:%d'%(os.major(dev),os.minor(dev)))
                    text=prop.read_text() if prop.exists() else ''
                    seat=next((line.split('=',1)[1] for line in text.splitlines() if line.startswith('E:ID_SEAT=')),'seat0')
                    if seat!='seat0':allowed=False
                if not allowed:continue
                reader=Reader(path,product)
                try:
                    if self.options.pages or self.options.spaces:
                        for node in paths[1:]:
                            device=InputDevice(str(node))
                            try:
                                dev=node.stat().st_rdev
                                props=Path('/run/udev/data/c%d:%d'%(os.major(dev),os.minor(dev)))
                                text=props.read_text() if props.exists() else ''
                                if not magic_pointer(device.capabilities(absinfo=False),text):continue
                                if device.active_keys():raise OSError('Waiting for mouse buttons to be released')
                                bridge=Bridge(device,magic=True);bridge.reader=reader
                                self.magic_pointers[str(node)]=bridge;device=None
                            finally:
                                if device:device.close()
                        if not any(b.reader is reader for b in self.magic_pointers.values()):
                            raise OSError('Magic Mouse pointer endpoint unavailable; gestures left inactive')
                    self.magic_devices[path]=reader
                except Exception:
                    for node,bridge in list(self.magic_pointers.items()):
                        if bridge.reader is reader:bridge.close();self.magic_pointers.pop(node)
                    reader.close()
                    raise
                self.magic_errors.pop(path,None)
            except OSError as error:
                self.magic_errors[path]=str(error)
        for path in set(self.magic_devices)-found:
            self.drop_magic(path)
        self.magic_errors={p:e for p,e in self.magic_errors.items() if p in found}

    def drop_magic(self,path):
        # All disconnect paths (hidraw, evdev and discovery) must end the
        # transport session before removing the reader. Otherwise heartbeat
        # packets keep a half-finished Shell transition alive indefinitely.
        if self.swipe and self.swipe[0]==path:self.cancel_swipe()
        reader=self.magic_devices.pop(path,None)
        if reader:
            for node,bridge in list(self.magic_pointers.items()):
                if bridge.reader is reader:bridge.close();self.magic_pointers.pop(node)
            reader.close()

    def send_swipe(self,phase,dx=0):
        if not self.peer:return False
        packet=dict(type=getattr(self,'swipe_type','workspace-swipe'),phase=phase,dx=dx,natural=self.options.natural,id=self.swipe_id)
        try:self.socket.sendto(json.dumps(packet).encode(),self.peer)
        except OSError:return False
        self.swipe_sent=time.monotonic()
        return True
    def cancel_swipe(self):
        if self.swipe:self.send_swipe('cancel')
        self.swipe=None
    def maintain_swipe(self,now):
        if not self.swipe:return
        reader=self.magic_devices.get(self.swipe[0])
        # A transport heartbeat is not evidence of a live touch surface.
        # Bluetooth can retain hidraw/evdev nodes after the physical power switch.
        if reader is None or now-reader.last_contact_at > 1.0:
            self.cancel_swipe()
            if reader is not None:reader.recognizer.reset()
            return
        if now-self.swipe_sent > .25:self.send_swipe('update',self.swipe[1])

    def stream_swipe(self,path,gesture):
        if not self.peer or gesture.kind!='swipe':return False
        page=gesture.fingers==1 and self.options.pages and self.options.page_stream
        space=gesture.fingers==2 and self.options.spaces
        if not (page or space):return False
        if gesture.phase=='begin':
            if abs(gesture.dx)<=abs(gesture.dy)*1.5:return True
            self.cancel_swipe();self.swipe_id+=1;self.swipe=(path,gesture.dx)
            self.swipe_type='page-swipe' if page else 'workspace-swipe'
            self.send_swipe('begin',gesture.dx)
        elif self.swipe and self.swipe[0]==path:
            self.send_swipe(gesture.phase,gesture.dx)
            self.swipe=(path,gesture.dx) if gesture.phase=='update' else None
        return True  # Never also emit an end-only keyboard action.

    def trigger(self,action='mission'):
        code={'mission':E.KEY_F18,'previous-space':E.KEY_F14,'next-space':E.KEY_F15,
              'zoom':E.KEY_F16,'back':E.KEY_BACK,'forward':E.KEY_FORWARD}[action]
        self.keyboard.write(E.EV_KEY,code,1);self.keyboard.syn()
        self.keyboard.write(E.EV_KEY,code,0);self.keyboard.syn()

    def run(self):
        scan_at=0
        seat=SeatState(self.active_user)
        try:
            seat.start()
            while self.running:
                now=time.monotonic()
                uid=seat.current()
                readers=[self.socket]+[b.device.fd for b in self.devices.values()]+[r.fd for r in self.magic_devices.values()]+[b.device.fd for b in self.magic_pointers.values()]
                ready,_,_=select.select(readers,[],[],.05)
                if self.socket in ready:
                    try:self.receive(uid)
                    except BlockingIOError:pass
                self.status()
                enabled=(self.choice in BUTTONS or self.magic) and self.owner==uid and now-self.last<3
                if not enabled:
                    self.release();continue
                self.maintain_swipe(now)
                button=BUTTONS.get(self.choice)
                if now>=scan_at:
                    if button:self.scan(button)
                    if self.magic:self.scan_magic()
                    scan_at=now+1
                for path,reader in list(self.magic_devices.items()):
                    if reader.fd not in ready:continue
                    try:
                        for _ in range(128):
                            for gesture in reader.read(time.monotonic()):
                                if self.stream_swipe(path,gesture):continue
                                action=action_for(gesture,self.options)
                                if action:
                                    self.magic_actions+=1;self.last_gesture=action;self.trigger(action)
                            if self.swipe and self.swipe[0]==path:
                                session=reader.recognizer.session
                                if session is None or session.get('blocked'):self.cancel_swipe()
                    except BlockingIOError:pass
                    except OSError:
                        if self.swipe and self.swipe[0]==path:self.cancel_swipe()
                        self.drop_magic(path)
                for path,b in list(self.magic_pointers.items()):
                    if b.device.fd not in ready:continue
                    try:
                        for event in b.device.read():
                            if event.type==E.EV_SYN and event.code==E.SYN_DROPPED:
                                raise OSError('Magic pointer queue lost synchronization')
                            if event.type==E.EV_ABS:continue
                            if event.type==E.EV_REL and event.code in (E.REL_WHEEL,E.REL_HWHEEL,11,12):
                                if suppress_wheel(event.code,self.options,b.reader,time.monotonic()):continue
                            b.output.write_event(event)
                    except BlockingIOError:pass
                    except OSError:self.drop_magic(b.reader.path)
                for path,b in list(self.devices.items()):
                    if b.device.fd not in ready:continue
                    try:
                        for event in b.device.read():
                            if event.type==E.EV_SYN and event.code==E.SYN_DROPPED:
                                raise OSError("Input queue lost synchronization; release physical mouse")
                            forward,trigger=True,False
                            if event.type==E.EV_KEY:
                                if event.code==button and event.value==1:self.presses+=1
                                forward,trigger,b.armed=route(event.code,event.value,button,b.armed)
                            if forward:b.output.write_event(event)
                            if trigger:
                                self.actions+=1
                                self.trigger()
                    except BlockingIOError:pass
                    except OSError:b.close();self.devices.pop(path,None)
        finally:
            seat.close()
            self.release();self.keyboard.close();self.socket.close()
            try:os.unlink(SOCKET)
            except FileNotFoundError:pass

if __name__=='__main__':
    service=Service()
    def stop(*_):service.running=False
    signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
    service.run()
