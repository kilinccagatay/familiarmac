#!/usr/bin/python3
"""Nonblocking update UI; installation and logout require explicit user actions."""
import importlib.util
from pathlib import Path
import subprocess
import threading
import gi
gi.require_version('Gtk','3.0')
from gi.repository import Gtk, GLib
spec=importlib.util.spec_from_file_location('updater',Path(__file__).with_name('release-update.py'))
updater=importlib.util.module_from_spec(spec);spec.loader.exec_module(updater)

class Updates(Gtk.Window):
    def __init__(self):
        super().__init__(title='FamiliarMac Updates')
        self.set_default_size(470,260);self.set_border_width(24)
        self.connect('delete-event',self.close)
        self.busy=False;self.latest=None
        header=Gtk.HeaderBar(title='FamiliarMac',show_close_button=True)
        header.set_decoration_layout('close,minimize,maximize:');self.set_titlebar(header)
        box=Gtk.Box(orientation=Gtk.Orientation.VERTICAL,spacing=16);self.add(box)
        installed=updater.read(updater.STATE/'installed.json').get('version','Development build')
        title=Gtk.Label(label='FamiliarMac '+installed);title.get_style_context().add_class('title');box.pack_start(title,False,False,0)
        self.status=Gtk.Label(label='Checking for updates…',wrap=True);self.status.set_max_width_chars(55);box.pack_start(self.status,True,True,0)
        self.spinner=Gtk.Spinner();box.pack_start(self.spinner,False,False,0)
        buttons=Gtk.Box(spacing=12,halign=Gtk.Align.CENTER);box.pack_start(buttons,False,False,0)
        self.check=Gtk.Button(label='Check for Updates');self.check.connect('clicked',lambda _:self.check_now());buttons.add(self.check)
        self.install=Gtk.Button(label='Install Update');self.install.get_style_context().add_class('suggested-action');self.install.connect('clicked',self.confirm);buttons.add(self.install)
        self.install.set_no_show_all(True);self.install.hide()
        self.show_all();self.check_now()
    def close(self,*args):
        if self.busy:
            self.status.set_text('Please wait for the current operation to finish.');return True
        Gtk.main_quit();return False
    def work(self, function, done):
        self.busy=True;self.check.set_sensitive(False);self.install.set_sensitive(False);self.spinner.start()
        def worker():
            try: result=function();error=None
            except Exception as e: result=None;error=str(e)
            GLib.idle_add(finish,result,error)
        def finish(result,error):
            self.busy=False;self.check.set_sensitive(True);self.install.set_sensitive(True);self.spinner.stop()
            if error: self.status.set_text(error)
            else: done(result)
            return False
        threading.Thread(target=worker,daemon=True).start()
    def check_now(self):
        self.status.set_text('Checking for updates…');self.install.hide()
        self.work(lambda:updater.check(True),self.checked)
    def checked(self,result):
        self.status.set_text(result['message']);self.latest=result.get('latest')
        current=updater.read(updater.STATE/'installed.json').get('version')
        self.install.set_visible(bool(self.latest and (not current or updater.version(self.latest)>updater.version(current))))
    def confirm(self,*args):
        dialog=Gtk.MessageDialog(transient_for=self,modal=True,message_type=Gtk.MessageType.QUESTION,buttons=Gtk.ButtonsType.NONE,text=f'Install FamiliarMac {self.latest}?')
        dialog.format_secondary_text('Your desktop preferences will be preserved. Save your work before logging out after installation. Shared themes and dependencies require administrator authentication. Boot/login visuals update only if managed by the portable installer. Hardware fixes are excluded.')
        dialog.add_buttons('Cancel',Gtk.ResponseType.CANCEL,'Install',Gtk.ResponseType.OK);dialog.set_default_response(Gtk.ResponseType.OK)
        answer=dialog.run();dialog.destroy()
        if answer!=Gtk.ResponseType.OK:return
        self.status.set_text('Downloading, verifying and installing…');self.work(lambda:updater.install(self.latest),self.installed)
    def installed(self,message):
        self.install.hide();self.status.set_text(message)
        dialog=Gtk.MessageDialog(transient_for=self,modal=True,message_type=Gtk.MessageType.INFO,buttons=Gtk.ButtonsType.NONE,text='Update installed')
        dialog.format_secondary_text('Log out and back in to use the new desktop code. Save any open work first. You can also do this later.')
        dialog.add_buttons('Later',Gtk.ResponseType.CANCEL,'Log Out…',Gtk.ResponseType.OK);dialog.set_default_response(Gtk.ResponseType.CANCEL)
        answer=dialog.run();dialog.destroy()
        if answer==Gtk.ResponseType.OK:
            # Native logout confirmation still protects unsaved work; never force.
            subprocess.Popen(['gnome-session-quit','--logout'])
if __name__=='__main__':
    Updates();Gtk.main()
