#!/usr/bin/python3
"""Read-only, in-memory ownership metadata for orphan FileChooser portals.
No file selections/options are retained; no request is changed or activated.
"""
import json
import os
import re
from gi.repository import Gio, GLib

BUS = 'org.familiarmac.PortalOwners'
PATH = '/org/familiarmac/PortalOwners'
PORTAL = 'org.freedesktop.portal.Desktop'
IFACE = 'org.freedesktop.impl.portal.FileChooser'
XML = '<node><interface name="'+BUS+'"><method name="GetState"><arg type="s" direction="out"/></method><signal name="Changed"/></interface></node>'


class Owners:
    def __init__(self): self.requests = {}
    def add(self, sender, trusted, serial, backend, pid, args, backend_class=None):
        if sender != trusted or len(args) < 4: return False
        handle, app, parent, title = args[:4]
        if not isinstance(app, str) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_.-]+', app): return False
        if not isinstance(handle, str) or not handle.startswith('/org/freedesktop/portal/desktop/request/'): return False
        if not isinstance(title, str) or not title or len(title) > 1024 or pid <= 0: return False
        self.requests[(backend, serial)] = dict(handle=handle, appId=app, title=title, pid=pid, backendClass=backend_class)
        return True
    def reply(self, backend, serial): return self.requests.pop((backend, serial), None) is not None
    def close(self, handle):
        keys = [k for k,v in self.requests.items() if v['handle'] == handle]
        for key in keys: del self.requests[key]
        return bool(keys)
    def state(self): return list(self.requests.values())


class Service:
    def __init__(self):
        self.state = Owners()
        self.bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        self.portal = self.owner(PORTAL)
        if not self.portal: raise RuntimeError('Portal service not running')
        self.loop = GLib.MainLoop()
        self.bus.register_object(PATH, Gio.DBusNodeInfo.new_for_xml(XML).interfaces[0], self.method, None, None)
        self.name = Gio.bus_own_name_on_connection(self.bus, BUS, Gio.BusNameOwnerFlags.NONE, None, lambda *_: self.loop.quit())
        self.bus.signal_subscribe('org.freedesktop.DBus','org.freedesktop.DBus','NameOwnerChanged',
            '/org/freedesktop/DBus',None,Gio.DBusSignalFlags.NONE,self.owner_changed)
        flags = Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT | Gio.DBusConnectionFlags.MESSAGE_BUS_CONNECTION
        self.monitor = Gio.DBusConnection.new_for_address_sync(os.environ['DBUS_SESSION_BUS_ADDRESS'], flags, None, None)
        self._monitoring = False
        self.monitor.add_filter(self.filter, None)
        self.monitor.connect('closed', lambda *_: self.loop.quit())
        rules = ["type='method_call',interface='"+IFACE+"',sender='"+self.portal+"'",
                 "type='method_call',interface='org.freedesktop.impl.portal.Request',member='Close',sender='"+self.portal+"'",
                 "type='method_return',destination='"+self.portal+"'",
                 "type='error',destination='"+self.portal+"'"]
        self.monitor.call_sync('org.freedesktop.DBus','/org/freedesktop/DBus','org.freedesktop.DBus.Monitoring',
            'BecomeMonitor',GLib.Variant('(asu)',(rules,0)),None,Gio.DBusCallFlags.NONE,3000,None)
        self._monitoring = True
    def owner(self, name):
        try:
            return self.bus.call_sync('org.freedesktop.DBus','/org/freedesktop/DBus','org.freedesktop.DBus',
                'GetNameOwner',GLib.Variant('(s)',(name,)),None,Gio.DBusCallFlags.NONE,1000,None).unpack()[0]
        except GLib.Error: return None
    def pid(self, name):
        try:
            return self.bus.call_sync('org.freedesktop.DBus','/org/freedesktop/DBus','org.freedesktop.DBus',
                'GetConnectionUnixProcessID',GLib.Variant('(s)',(name,)),None,Gio.DBusCallFlags.NONE,1000,None).unpack()[0]
        except GLib.Error: return 0
    def method(self, conn, sender, path, iface, method, params, invocation):
        if method == 'GetState': invocation.return_value(GLib.Variant('(s)',(json.dumps(self.state.state()),)))
    def changed(self): self.bus.emit_signal(None,PATH,BUS,'Changed',None)
    def owner_changed(self, conn, sender, path, iface, signal, params):
        name, old, new = params.unpack()
        if name == PORTAL and old != new:
            self.state.requests.clear();self.changed();self.loop.quit()
        elif name.startswith('org.freedesktop.impl.portal.desktop.') and old != new:
            self.state.requests.clear();self.changed()
    def filter(self, conn, msg, incoming, data):
        if not incoming or not self._monitoring: return msg
        kind=msg.get_message_type()
        if kind == Gio.DBusMessageType.METHOD_CALL and msg.get_interface() == IFACE:
            if msg.get_member() not in ('OpenFile','SaveFile','SaveFiles'): return None
            # Only copy the four identity fields; never retain options or selection data.
            body=msg.get_body()
            args=tuple(body.get_child_value(i).unpack() for i in range(min(4,body.n_children()))) if body else ()
            GLib.idle_add(self.request,msg.get_sender(),msg.get_serial(),msg.get_destination(),args)
        elif kind in (Gio.DBusMessageType.METHOD_RETURN,Gio.DBusMessageType.ERROR):
            GLib.idle_add(self.reply,msg.get_sender(),msg.get_reply_serial())
        elif kind == Gio.DBusMessageType.METHOD_CALL and msg.get_interface() == 'org.freedesktop.impl.portal.Request' and msg.get_sender() == self.portal:
            GLib.idle_add(self.close,msg.get_path())
        # Consume monitor traffic: GDBus must not auto-reply on this read-only connection.
        return None
    def request(self, sender, serial, backend, args):
        owner = self.owner(backend) if backend and not backend.startswith(':') else backend
        pid = self.pid(owner) if owner else 0
        try:
            backend_class = os.path.basename(os.readlink(f'/proc/{pid}/exe'))
        except OSError:
            backend_class = None
        if owner and self.state.add(sender,self.portal,serial,owner,pid,args,backend_class): self.changed()
        return GLib.SOURCE_REMOVE
    def reply(self, backend, serial):
        if self.state.reply(backend,serial): self.changed()
        return GLib.SOURCE_REMOVE
    def close(self, path):
        if self.state.close(path): self.changed()
        return GLib.SOURCE_REMOVE
    def run(self): self.loop.run()


if __name__ == '__main__': Service().run()
