"""On-demand application picker and non-modal, keep-above menu inspector."""
import os
import sys
from pathlib import Path
_original_backend = os.environ.get('GDK_BACKEND')
os.environ['GDK_BACKEND'] = 'x11'
for _key in ('LD_PRELOAD', 'G_RESOURCE_OVERLAYS'):
    os.environ.pop(_key, None)
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gio, GLib, Gdk, Pango


def run(inventory, launch, review=None):
    # Only this utility uses XWayland for GTK3's supported keep-above hint.
    # Do not pass that backend or the Settings overlay into launched apps.
    previous = _original_backend
    os.environ['GDK_BACKEND'] = 'x11'
    for key in ('LD_PRELOAD', 'G_RESOURCE_OVERLAYS'):
        os.environ.pop(key, None)
    GLib.set_prgname('familiarmac-menu-setup')
    GLib.set_application_name('Configure Applications')
    Gtk.init([])
    if previous is None: os.environ.pop('GDK_BACKEND', None)
    else: os.environ['GDK_BACKEND'] = previous
    application = Gtk.Application(application_id='org.familiarmac.MenuSetup', flags=Gio.ApplicationFlags.FLAGS_NONE)

    class Setup(Gtk.ApplicationWindow):
        def __init__(self):
            super().__init__(application=application, title='Configure Applications')
            self.set_wmclass('familiarmac-menu-setup', 'FamiliarMacMenuSetup')
            self.set_default_size(520, 580)
            self.set_position(Gtk.WindowPosition.CENTER)
            self.busy = False
            self.closed = False
            self.selected = None
            self.ticket = None
            self.worker = None
            self.connect('destroy', self.destroyed)
            self.header = Gtk.HeaderBar(title='Configure Applications', show_close_button=True)
            self.header.set_decoration_layout('close,minimize,maximize:')
            self.set_titlebar(self.header)
            self.back = Gtk.Button.new_from_icon_name('go-previous-symbolic', Gtk.IconSize.BUTTON)
            self.back.set_tooltip_text('Choose another application')
            self.back.connect('clicked', lambda *_: self.show_picker())
            self.header.pack_start(self.back)
            self.stack = Gtk.Stack(transition_type=Gtk.StackTransitionType.NONE)
            self.add(self.stack)
            picker = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, margin=18)
            self.search = Gtk.SearchEntry(placeholder_text='Search applications')
            self.search.connect('search-changed', lambda *_: self.list.invalidate_filter())
            picker.pack_start(self.search, False, False, 0)
            intro = Gtk.Label(label='Choose an app to open it and check its menus.', xalign=0)
            intro.set_line_wrap(True)
            intro.get_style_context().add_class('dim-label')
            picker.pack_start(intro, False, False, 0)
            scroll = Gtk.ScrolledWindow(hscrollbar_policy=Gtk.PolicyType.NEVER)
            self.list = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE)
            self.list.set_filter_func(lambda row: self.search.get_text().casefold() in row.search_name)
            self.list.connect('row-activated', self.select_app)
            scroll.add(self.list)
            picker.pack_start(scroll, True, True, 0)
            self.stack.add_named(picker, 'picker')
            check = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16, margin=24)
            self.app_icon = Gtk.Image(pixel_size=48)
            check.pack_start(self.app_icon, False, False, 0)
            self.app_name = Gtk.Label()
            self.app_name.set_line_wrap(True)
            self.app_name.get_style_context().add_class('title')
            check.pack_start(self.app_name, False, False, 0)
            self.message = Gtk.Label(label='', xalign=0.5, justify=Gtk.Justification.CENTER)
            self.message.set_line_wrap(True)
            self.message.set_max_width_chars(44)
            self.message.set_selectable(True)
            check.pack_start(self.message, False, False, 0)
            self.spinner = Gtk.Spinner()
            check.pack_start(self.spinner, False, False, 0)
            buttons = Gtk.Box(spacing=12, halign=Gtk.Align.CENTER)
            self.open_button = Gtk.Button(label='Open app')
            self.open_button.connect('clicked', lambda *_: self.open_selected())
            buttons.add(self.open_button)
            self.check_button = Gtk.Button(label='Check menus')
            self.check_button.get_style_context().add_class('suggested-action')
            self.check_button.connect('clicked', self.check_menus)
            buttons.add(self.check_button)
            check.pack_start(buttons, False, False, 0)
            self.review_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
            explanation = Gtk.Label(label='No menu was detected, or the app closed. How should it be listed?', wrap=True)
            self.review_box.add(explanation)
            choices = Gtk.Box(spacing=8, halign=Gtk.Align.CENTER)
            for title, decision, tip in (
                ('No menu needed', 'no-menu-needed', 'This app has no menu that needs moving to the top panel.'),
                ('Needs support', 'needs-support', 'The app has menus, but they were not detected or transferred.')):
                choice = Gtk.Button(label=title)
                choice.set_tooltip_text(tip)
                choice.connect('clicked', lambda button, value=decision: self.review_app(value))
                choices.add(choice)
            self.review_box.add(choices)
            check.pack_start(self.review_box, False, False, 0)
            note = Gtk.Label(label='This window stays above apps while you check.\nYou can keep using the selected app.', justify=Gtk.Justification.CENTER)
            note.get_style_context().add_class('dim-label')
            check.pack_start(note, False, False, 0)
            self.stack.add_named(check, 'check')
            self.reload_apps()
            self.show_all()
            self.show_picker()

        def destroyed(self, *_):
            self.closed = True
            # A running read-only inspection may finish; do not kill its app.

        def reload_apps(self):
            for row in self.list.get_children(): self.list.remove(row)
            apps = {a.get_id(): a for a in Gio.AppInfo.get_all()}
            for info in inventory():
                if info['id'] == 'org.familiarmac.MenuSetup.desktop': continue
                row = Gtk.ListBoxRow()
                row.info = info
                row.search_name = info['name'].casefold()
                box = Gtk.Box(spacing=12, margin=10)
                app = apps.get(info['id'])
                image = Gtk.Image.new_from_gicon(app.get_icon(), Gtk.IconSize.DND) if app and app.get_icon() else Gtk.Image.new_from_icon_name('application-x-executable', Gtk.IconSize.DND)
                image.set_pixel_size(32)
                box.pack_start(image, False, False, 0)
                label = Gtk.Label(label=info['name'], xalign=0, ellipsize=Pango.EllipsizeMode.END)
                box.pack_start(label, True, True, 0)
                state = Gtk.Label(label={'adapted':'Adapted','no-menu-needed':'No menu needed','needs-support':'Needs support','not-exported':'Not detected'}.get(info.get('review'), 'Adapted' if info['adapted'] else ('Configured' if info['status'].startswith('Configured') else 'Not checked')))
                state.get_style_context().add_class('dim-label')
                box.pack_end(state, False, False, 0)
                row.add(box)
                row.set_tooltip_text(info['status'])
                self.list.add(row)
            self.list.show_all()

        def show_picker(self):
            if self.busy: return
            self.set_keep_above(False)
            self.stack.set_visible_child_name('picker')
            self.header.set_title('Configure Applications')
            self.back.hide()
            self.resize(520, 580)
            self.reload_apps()
            self.search.grab_focus()

        def select_app(self, _, row):
            self.selected = row.info
            self.ticket = None
            self.stack.set_visible_child_name('check')
            self.header.set_title('Check application menus')
            self.back.show()
            self.app_name.set_text(self.selected['name'])
            app = next((a for a in Gio.AppInfo.get_all() if a.get_id() == self.selected['id']), None)
            if app and app.get_icon(): self.app_icon.set_from_gicon(app.get_icon(), Gtk.IconSize.DIALOG)
            self.open_button.hide()
            self.review_box.hide()
            self.spinner.hide()
            self.set_keep_above(True)
            self.resize(460, 340)
            self.open_selected()

        def open_selected(self):
            try:
                self.ticket = launch(self.selected['id'])
                self.message.set_text('When the app’s main window is ready, choose Check menus. You can finish any welcome screen first.')
                self.open_button.hide()
            except (GLib.Error, ValueError) as error:
                self.message.set_text('Could not open the app: '+str(error))
                self.open_button.set_visible(not self.selected['adapted'])

        def check_menus(self, *_):
            if self.busy or not self.selected: return
            self.busy = True
            self.review_box.hide()
            self.check_button.set_sensitive(False)
            self.open_button.hide()
            self.back.set_sensitive(False)
            self.message.set_text('Checking menus and shortcut hints…')
            self.spinner.show(); self.spinner.start()
            argv = ['/usr/bin/python3', str(Path(__file__).with_name('settings-applications.py')), '--recheck', self.selected['id'], '--ui']
            if self.ticket: argv += ['--ticket', self.ticket]
            try:
                self.worker = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE)
                self.worker.communicate_utf8_async(None, None, self.checked)
            except GLib.Error as error:
                self.finish(str(error), False)

        def checked(self, process, result):
            try:
                _, output, _ = process.communicate_utf8_finish(result)
                success = process.get_successful()
            except GLib.Error as error:
                output, success = str(error), False
            if not self.closed: self.finish(output, success)

        def review_app(self, decision):
            if self.busy or review is None: return
            try:
                self.message.set_text(review(self.selected['id'], decision))
                self.selected = next(a for a in inventory() if a['id'] == self.selected['id'])
                self.review_box.hide()
            except (ValueError, OSError) as error:
                self.message.set_text(str(error))

        def finish(self, output, success):
            self.busy = False; self.worker = None
            self.spinner.stop(); self.spinner.hide()
            self.check_button.set_sensitive(True); self.back.set_sensitive(True)
            lines = output.strip().splitlines()
            self.message.set_text(lines[0] if lines else 'Check failed. Try again.')
            self.selected = next((a for a in inventory() if a['id'] == self.selected['id']), self.selected)
            if success and self.selected['adapted']: self.ticket = None
            self.review_box.set_visible(success and self.selected.get('can_review', False))
            self.open_button.set_visible(success and len(lines)>1 and lines[1]=='open' and not self.selected['adapted'])

    def activate(app):
        window = app.get_active_window()
        if window: window.present()
        else: Setup().present()
    application.connect('activate', activate)
    return application.run([sys.argv[0]])
