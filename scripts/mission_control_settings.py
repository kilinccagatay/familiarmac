"""Mission Control input preferences; only explicit user choices are written."""
from pathlib import Path
import gi
gi.require_version('Gtk','4.0')
gi.require_version('Adw','1')
from gi.repository import Adw, Gtk, Gio, Gdk, GLib

def local_settings(uuid,schema):
    directory=Path.home()/'.local/share/gnome-shell/extensions'/uuid/'schemas'
    source=Gio.SettingsSchemaSource.new_from_directory(str(directory),Gio.SettingsSchemaSource.get_default(),False)
    return Gio.Settings.new_full(source.lookup(schema,True),None,None)

def conflicting_shortcut(accelerator):
    if not accelerator:return None
    wanted=Gtk.accelerator_parse(accelerator)[1:]
    if any(Gtk.accelerator_parse(key)[1:]==wanted for key in ('F4','XF86LaunchB','XF86Search')):
        return 'F4 Apps / Spotlight'
    for name in ('org.gnome.desktop.wm.keybindings','org.gnome.shell.keybindings','org.gnome.settings-daemon.plugins.media-keys'):
        schema=Gio.SettingsSchemaSource.get_default().lookup(name,True)
        if not schema:continue
        settings=Gio.Settings.new(name)
        for key in schema.list_keys():
            if name=='org.gnome.shell.keybindings' and key=='toggle-overview':continue
            value=settings.get_value(key).unpack()
            entries=value if isinstance(value,list) else [value] if isinstance(value,str) else []
            if any(entry and Gtk.accelerator_parse(entry)[1:]==wanted for entry in entries):
                return key.replace('-',' ')
    return None

def run():
    GLib.set_application_name('Keyboard Shortcuts')
    app=Adw.Application(application_id='org.familiarmac.MissionControlSettings')
    def activate(app):
        if app.get_active_window():app.get_active_window().present();return
        window=Adw.PreferencesWindow(application=app,title='Keyboard & Trackpad',default_width=600,default_height=520,search_enabled=False)
        page=Adw.PreferencesPage();window.add(page)
        group=Adw.PreferencesGroup(title='Keyboard Shortcuts',description='Choose how to open Mission Control, Apps and Spotlight.');page.add(group)
        shell=Gio.Settings.new('org.gnome.shell.keybindings')
        current=shell.get_strv('toggle-overview')
        labels=[Gtk.accelerator_get_label(*Gtk.accelerator_parse(v)[1:]) for v in current]
        row=Adw.ActionRow(title='Mission Control',subtitle=', '.join(labels) or 'Off');group.add(row)
        record=Gtk.Button(label='Change…',valign=Gtk.Align.CENTER);row.add_suffix(record)
        error=Adw.ActionRow(title='');error.set_visible(False);group.add(error)
        def record_key(_button):
            capture=Adw.Window(transient_for=window,modal=True,title='Keyboard shortcut',default_width=390,default_height=180)
            box=Gtk.Box(orientation=Gtk.Orientation.VERTICAL,spacing=16,margin_top=20,margin_bottom=20,margin_start=20,margin_end=20)
            box.append(Gtk.Label(label='Press the new shortcut',wrap=True));box.append(Gtk.Label(label='Escape cancels. Backspace turns the shortcut off.',wrap=True))
            capture.set_content(box)
            controller=Gtk.EventControllerKey.new()
            def pressed(_controller,keyval,_keycode,state):
                if keyval==Gdk.KEY_Escape:capture.close();return True
                if keyval in (Gdk.KEY_Shift_L,Gdk.KEY_Shift_R,Gdk.KEY_Control_L,Gdk.KEY_Control_R,Gdk.KEY_Alt_L,Gdk.KEY_Alt_R,Gdk.KEY_Super_L,Gdk.KEY_Super_R):return True
                mods=state & Gtk.accelerator_get_default_mod_mask()
                accelerator='' if keyval==Gdk.KEY_BackSpace and not mods else Gtk.accelerator_name(keyval,mods)
                hardware=(Gdk.keyval_name(keyval) or '').startswith('XF86')
                if accelerator and not mods and not hardware and not Gdk.KEY_F1<=keyval<=Gdk.KEY_F35:
                    error.set_title('Use a modifier key or a function key.');error.set_visible(True);capture.close();return True
                conflict=conflicting_shortcut(accelerator)
                if conflict:error.set_title('Already used by '+conflict+'. Choose another shortcut.');error.set_visible(True)
                else:
                    shell.set_strv('toggle-overview',[accelerator] if accelerator else [])
                    row.set_subtitle(Gtk.accelerator_get_label(keyval,mods) if accelerator else 'Off');error.set_visible(False)
                capture.close();return True
            controller.connect('key-pressed',pressed);capture.add_controller(controller);capture.present()
        record.connect('clicked',record_key)
        genie=local_settings('familiarmac-genie@local','org.gnome.shell.extensions.familiarmac-genie')
        launcher=Adw.ComboRow(title='F4 key',subtitle='Apple Launchpad / Search key',model=Gtk.StringList.new(['Apps','Spotlight']))
        launcher.set_selected(0 if genie.get_string('launcher-key-action')=='apps' else 1);group.add(launcher)
        launcher.connect('notify::selected',lambda row,_:genie.set_string('launcher-key-action','apps' if row.get_selected()==0 else 'spotlight'))
        touch=Adw.PreferencesGroup(title='Trackpad',description='Use the existing system gesture engine. Other gestures are preserved.');page.add(touch)
        try:
            gesture=local_settings('touchpad-gesture-customization@coooolapps.com','org.gnome.shell.extensions.touchpad-gesture-customization')
            for fingers in (3,4):
                key=f'vertical-swipe-{fingers}-fingers-gesture'
                switch=Adw.SwitchRow(title=f'Swipe up with {fingers} fingers',active=gesture.get_string(key)=='OVERVIEW_NAVIGATION')
                touch.add(switch)
                def changed(row,_,key=key):
                    gesture.set_string(key,'OVERVIEW_NAVIGATION' if row.get_active() else 'NONE')
                    if row.get_active():gesture.set_string('overview-navigation-states','WINDOW_PICKER_ONLY')
                switch.connect('notify::active',changed)
        except Exception:
            touch.add(Adw.ActionRow(title='Trackpad gestures unavailable',subtitle='The supported gesture extension is not installed.'))
        devices=Adw.PreferencesGroup();page.add(devices)
        mouse_link=Adw.ActionRow(title='Mouse &amp; Touchpad',subtitle='Mouse buttons and Magic Mouse gestures',activatable=True)
        mouse_link.add_suffix(Gtk.Image.new_from_icon_name('go-next-symbolic'));devices.add(mouse_link)
        mouse_link.connect('activated',lambda *_:Gio.Subprocess.new([str(Path.home()/'.local/bin/familiarmac-settings'),'mouse'],Gio.SubprocessFlags.NONE))
        window.present()
    app.connect('activate',activate)
    return app.run([])
