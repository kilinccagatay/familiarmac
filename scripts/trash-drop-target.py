#!/usr/bin/env python3
"""Real GTK drop destination for Shell chrome; no pointer-release heuristics."""
import os
os.environ['GDK_BACKEND'] = 'x11'
os.environ['GDK_SCALE'] = '1'
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, Gio, GLib

BUS = 'org.familiarmac.TrashTarget'
PATH = '/org/familiarmac/TrashTarget'
XML = '''<node><interface name="org.familiarmac.TrashTarget">
<method name="Show"><arg type="i" direction="in"/><arg type="i" direction="in"/><arg type="i" direction="in"/><arg type="i" direction="in"/></method>
<method name="Hide"/><method name="Shutdown"/></interface></node>'''


def file_uris(text):
    if len(text) > 1024 * 1024:
        raise ValueError('Drop is too large')
    uris = list(dict.fromkeys(line.strip() for line in text.splitlines()
                             if line.strip() and not line.startswith('#')))
    if not uris or len(uris) > 1000:
        raise ValueError('Invalid file count')
    for uri in uris:
        file = Gio.File.new_for_uri(uri)
        if not file.is_native() or not file.get_path() or file.get_path() == '/':
            raise ValueError('Only local file drops are supported')
    return uris


class Target:
    def __init__(self):
        self.window = Gtk.Window(type=Gtk.WindowType.POPUP)
        self.window.set_title('FamiliarMac Trash Drop Target')
        self.window.set_accept_focus(False)
        self.window.set_focus_on_map(False)
        self.window.set_skip_taskbar_hint(True)
        self.window.set_skip_pager_hint(True)
        self.window.set_app_paintable(True)
        visual = self.window.get_screen().get_rgba_visual()
        if visual:
            self.window.set_visual(visual)
        self.window.connect('draw', self.draw)
        # Accept COPY as well: some file-manager/Xwayland sources offer only
        # COPY. We perform GIO trash ourselves and never request source deletion.
        entries = [Gtk.TargetEntry.new('text/uri-list', 0, 0)]
        self.window.drag_dest_set(Gtk.DestDefaults.HIGHLIGHT,
                          entries, Gdk.DragAction.COPY | Gdk.DragAction.MOVE)
        self.window.connect('drag-motion', self.motion)
        self.window.connect('drag-drop', self.drop)
        self.window.connect('drag-data-received', self.received)
        self.window.connect('drag-leave', lambda *_: self.window.queue_draw())
        self.pending = None
        self.active_moves = 0
        self.stopping = False
        self.owner = Gio.bus_own_name(Gio.BusType.SESSION, BUS, Gio.BusNameOwnerFlags.NONE,
                                      self.bus_acquired, None, lambda *_: Gtk.main_quit())

    def draw(self, _window, cr):
        import cairo
        cr.set_operator(cairo.OPERATOR_SOURCE)
        cr.set_source_rgba(0, 0, 0, 0)
        cr.paint()
        return True

    def bus_acquired(self, connection, _name):
        self.connection = connection
        Gio.bus_watch_name_on_connection(connection, 'org.gnome.Shell', Gio.BusNameWatcherFlags.NONE,
            None, lambda *_: (self.hide(), Gtk.main_quit()))
        self.registration = connection.register_object(PATH,
            Gio.DBusNodeInfo.new_for_xml(XML).interfaces[0], self.method, None, None)

    def method(self, _connection, _sender, _path, _interface, method, parameters, invocation):
        if method == 'Show':
            x, y, width, height = parameters.unpack()
            if width < 1 or height < 1 or width > 512 or height > 512:
                invocation.return_dbus_error(BUS + '.Bounds', 'Invalid target dimensions')
                return
            self.window.move(x, y)
            self.window.resize(width, height)
            self.window.show_all()
        elif method == 'Shutdown':
            self.stopping = True
            self.hide()
            if not self.active_moves:
                Gtk.main_quit()
        else:
            self.hide()
        invocation.return_value(None)

    def hide(self):
        self.window.hide()
        return GLib.SOURCE_REMOVE

    def motion(self, widget, context, _x, _y, time):
        target = widget.drag_dest_find_target(context, None)
        offered = context.get_actions()
        action = Gdk.DragAction(0)
        if target != Gdk.Atom.intern('NONE', False):
            if offered & (Gdk.DragAction.MOVE | Gdk.DragAction.COPY):
                action = Gdk.DragAction.MOVE
        # Mutter's Wayland -> Xdnd bridge advertises one suggested action,
        # preferring COPY, rather than the complete Wayland action set. Keep
        # COPY in the target's accepted actions but respond with the operation
        # we actually perform: MOVE. Restricting drag_dest_set to MOVE instead
        # rejects the bridge's suggested COPY before data can be delivered.
        # Source deletion remains disabled in drag_finish.
        Gdk.drag_status(context, action, time)
        state = (int(offered), int(action))
        if getattr(self, '_last_actions', None) != state:
            self._last_actions = state
            print(f'FamiliarMac Trash drag actions: offered={state[0]} selected={state[1]}', flush=True)
        return bool(action)

    def drop(self, widget, context, _x, _y, time):
        if self.pending is not None:
            return False
        target = widget.drag_dest_find_target(context, None)
        if target == Gdk.Atom.intern('NONE', False):
            return False
        self.pending = (context, time)
        widget.drag_get_data(context, target, time)
        return True

    def received(self, _widget, context, _x, _y, data, _info, time):
        if self.pending is None or context != self.pending[0]:
            return
        self.pending = None
        self.hide()
        try:
            uris = file_uris(bytes(data.get_data()).decode('utf-8'))
        except Exception as error:
            print(f'FamiliarMac Trash rejected drop: {error}', flush=True)
            Gtk.drag_finish(context, False, False, time)
            return
        # Transfer is accepted; we perform the move ourselves. Never ask the
        # source to delete originals (COPY/MOVE negotiation is not deletion).
        Gtk.drag_finish(context, True, False, time)
        self.move(uris)

    def move(self, uris):
        self.active_moves += 1
        remaining = iter(uris)
        failures = []
        def advance():
            uri = next(remaining, None)
            if uri is None:
                if not failures and GLib.find_program_in_path('canberra-gtk-play'):
                    Gio.Subprocess.new(['canberra-gtk-play', '--id=trash-empty',
                        '--description=Move to Trash'], Gio.SubprocessFlags.NONE)
                self.active_moves -= 1
                if self.stopping and not self.active_moves:
                    Gtk.main_quit()
                print(f'FamiliarMac Trash completed: {len(uris)-len(failures)}/{len(uris)}', flush=True)
                if failures:
                    dialog = Gtk.MessageDialog(message_type=Gtk.MessageType.ERROR,
                        buttons=Gtk.ButtonsType.CLOSE, text='Some files could not be moved to Trash.')
                    dialog.connect('response', lambda d, _r: d.destroy())
                    dialog.show()
                return
            file = Gio.File.new_for_uri(uri)
            def done(source, result):
                try:
                    if not source.trash_finish(result):
                        failures.append(uri)
                except GLib.Error:
                    failures.append(uri)
                advance()
            file.trash_async(GLib.PRIORITY_DEFAULT, None, done)
        advance()


if __name__ == '__main__':
    Target()
    Gtk.main()
