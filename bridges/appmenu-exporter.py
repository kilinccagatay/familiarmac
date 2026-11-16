#!/usr/bin/python3
"""D-Bus adapter for actual Electron menu descriptors and activation IDs."""
import json, sys, gi
gi.require_version('Dbusmenu','0.4')
from gi.repository import Dbusmenu, Gio, GLib
server=Dbusmenu.Server.new('/com/macbook/AppMenu')
bus=Gio.bus_get_sync(Gio.BusType.SESSION,None)
registered=set()
loop=GLib.MainLoop()
def activate(item,timestamp,key):
    print(json.dumps({'activate':key}),flush=True)
def build(items):
    parent=Dbusmenu.Menuitem.new()
    for desc in items:
        item=Dbusmenu.Menuitem.new_with_id(desc['id'])
        item.property_set('label',desc.get('label') or '')
        item.property_set_bool('enabled',desc.get('enabled',True))
        item.property_set_bool('visible',desc.get('visible',True))
        shortcut=desc.get('shortcut',[])
        if isinstance(shortcut,list) and shortcut and all(isinstance(key,str) and key for key in shortcut):
            item.property_set_variant('shortcut',GLib.Variant('aas',[shortcut]))
        if desc.get('type')=='separator':item.property_set('type','separator')
        if desc.get('type') in ('checkbox','radio'):
            item.property_set('toggle-type','checkmark' if desc['type']=='checkbox' else 'radio')
            item.property_set_int('toggle-state',1 if desc.get('checked') else 0)
        children=desc.get('children',[])
        if children:
            item.property_set('children-display','submenu')
            for child in build(children).take_children():item.child_append(child)
        item.connect('item-activated',activate,desc['id'])
        parent.child_append(item)
    return parent
last={}
def register(force=False):
    if force: registered.clear()
    for wid in set(last.get('windows',[]))-registered:
        bus.call('com.canonical.AppMenu.Registrar','/com/canonical/AppMenu/Registrar',
            'com.canonical.AppMenu.Registrar','RegisterWindow',GLib.Variant('(uo)',(wid,'/com/macbook/AppMenu')),
            None,Gio.DBusCallFlags.NONE,-1,None,None)
        registered.add(wid)
def read_input(source,condition):
    global last
    line=sys.stdin.readline()
    if not line:loop.quit();return False
    try:
        data=json.loads(line)
        server.set_root(build(data['tree']))
        for wid in registered-set(data['windows']):
            bus.call('com.canonical.AppMenu.Registrar','/com/canonical/AppMenu/Registrar',
                'com.canonical.AppMenu.Registrar','UnregisterWindow',GLib.Variant('(u)',(wid,)),
                None,Gio.DBusCallFlags.NONE,-1,None,None)
        registered.intersection_update(data['windows'])
        last=data;register()
    except (ValueError,KeyError,TypeError) as e:
        print(str(e),file=sys.stderr)
    return True
Gio.bus_watch_name_on_connection(bus,'com.canonical.AppMenu.Registrar',Gio.BusNameWatcherFlags.NONE,
    lambda *_:register(True),lambda *_:registered.clear())
GLib.io_add_watch(sys.stdin,GLib.IO_IN|GLib.IO_HUP,read_input)
loop.run()
