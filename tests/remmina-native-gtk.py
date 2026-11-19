import ctypes,gi,pathlib,subprocess,tempfile
gi.require_version('Gtk','3.0')
from gi.repository import Gtk,GLib,Gio
ctypes.CDLL('libgtk-3.so.0',mode=ctypes.RTLD_GLOBAL)
temp=tempfile.TemporaryDirectory()
module=pathlib.Path(temp.name)/'adapter.so'
subprocess.run(['cc','-shared','-fPIC','-O2','-Wall','-Wextra','-Werror',str(pathlib.Path(__file__).resolve().parent.parent/'native/remmina-fullscreen.c'),'-o',str(module)],check=True)
lib=ctypes.CDLL(str(module))
lib.fm_remmina_set_fullscreen.argtypes=[ctypes.c_char_p,ctypes.c_int]
class Connection(Gtk.Window):
 __gtype_name__='RemminaConnectionWindow'
GLib.set_prgname('org.remmina.Remmina')
lib.gtk_module_init(None,None)
w=Connection(title='FamiliarMac fullscreen adapter test');bar=Gtk.Toolbar();button=Gtk.ToggleToolButton();button.set_icon_name('org.remmina.Remmina-fullscreen-symbolic');bar.insert(button,-1);w.add(bar);w.show_all()
clicks=[]
button.connect('clicked',lambda b:clicks.append(b.get_active()))
def drain():
 while GLib.MainContext.default().pending():GLib.MainContext.default().iteration(False)
assert lib.fm_remmina_set_fullscreen(b'wrong title',1)==0
assert lib.fm_remmina_set_fullscreen(b'FamiliarMac fullscreen adapter test',1)==1
drain()
assert button.get_active() and clicks==[True],clicks
assert lib.fm_remmina_set_fullscreen(b'FamiliarMac fullscreen adapter test',1)==1
drain();assert clicks==[True]
assert lib.fm_remmina_set_fullscreen(b'FamiliarMac fullscreen adapter test',0)==1
drain();assert clicks==[True,False],clicks
duplicate=Connection(title=w.get_title());duplicate.show_all()
assert lib.fm_remmina_set_fullscreen(b'FamiliarMac fullscreen adapter test',1)==0
duplicate.destroy()
import os,time
bus=Gio.bus_get_sync(Gio.BusType.SESSION,None)
owned=False
for _ in range(50):
 drain()
 owned=bus.call_sync('org.freedesktop.DBus','/org/freedesktop/DBus','org.freedesktop.DBus','NameHasOwner',GLib.Variant('(s)',('org.familiarmac.Remmina.p'+str(os.getpid()),)),None,0,1000,None).unpack()[0]
 if owned:break
 time.sleep(.01)
assert owned,'GTK module must publish the control endpoint with Remmina application ID'
w.destroy();print('Native GTK toggle: enter, idempotence, exit, exact targeting PASS')
