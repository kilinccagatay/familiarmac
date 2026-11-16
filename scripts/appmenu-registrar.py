#!/usr/bin/python3
"""Session-local Canonical AppMenu registrar for real application menus."""
from gi.repository import Gio, GLib
xml='''<node><interface name="com.canonical.AppMenu.Registrar"><method name="RegisterWindow"><arg type="u" direction="in"/><arg type="o" direction="in"/></method><method name="UnregisterWindow"><arg type="u" direction="in"/></method><method name="GetMenuForWindow"><arg type="u" direction="in"/><arg type="s" direction="out"/><arg type="o" direction="out"/></method><method name="GetMenus"><arg type="a(uso)" direction="out"/></method><signal name="WindowRegistered"><arg type="u"/><arg type="s"/><arg type="o"/></signal><signal name="WindowUnregistered"><arg type="u"/></signal></interface></node>'''
menus={}
iface=Gio.DBusNodeInfo.new_for_xml(xml).interfaces[0]
def method(conn,sender,path,interface,name,params,inv):
 args=params.unpack()
 if name=='RegisterWindow':
  wid, obj=args;menus[wid]=(sender,obj); None
  conn.emit_signal(None,path,interface,'WindowRegistered',GLib.Variant('(uso)',(wid,sender,obj)))
  inv.return_value(None)
 elif name=='UnregisterWindow':
  menus.pop(args[0],None);inv.return_value(None)
  conn.emit_signal(None,path,interface,'WindowUnregistered',GLib.Variant('(u)',args))
 elif name=='GetMenuForWindow': inv.return_value(GLib.Variant('(so)',menus.get(args[0],('', '/'))))
 elif name=='GetMenus': inv.return_value(GLib.Variant('(a(uso))',([(wid,*info) for wid,info in menus.items()],)))
def owner_changed(conn, sender, path, interface, signal, params, user_data=None):
 name, old, new = params.unpack()
 if new: return
 for wid, info in list(menus.items()):
  if info[0] == name:
   menus.pop(wid, None)
   conn.emit_signal(None, '/com/canonical/AppMenu/Registrar', 'com.canonical.AppMenu.Registrar', 'WindowUnregistered', GLib.Variant('(u)', (wid,)))
def acquired(conn,name):
 conn.register_object('/com/canonical/AppMenu/Registrar',iface,method,None,None)
 conn.signal_subscribe('org.freedesktop.DBus','org.freedesktop.DBus','NameOwnerChanged','/org/freedesktop/DBus',None,Gio.DBusSignalFlags.NONE,owner_changed)
loop = GLib.MainLoop()
Gio.bus_own_name(Gio.BusType.SESSION,'com.canonical.AppMenu.Registrar',Gio.BusNameOwnerFlags.NONE,acquired,None,lambda conn,name: loop.quit())
loop.run()
