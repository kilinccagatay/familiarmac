        // FamiliarMac: GTK reports NO_TARGET when releasing over Shell chrome.
        // Ask the compositor whether that exact drag ended over the dock trash.
        // Cancellation, timeouts and failed transfers must never trash anything.
        this.connectSignal(widget, 'drag-failed', (w, context, result) => {
            if (result !== Gtk.DragResult.NO_TARGET) return false;
            const files = this._desktopManager._fileList
                .filter(item => (item.isSelected || item.isKeyboardSelected) && !item.isSpecial)
                .map(item => item.file.get_uri());
            if (!files.length) return false;
            Gio.DBus.session.call('org.gnome.Shell', '/org/familiarmac/TrashDrop',
                'org.familiarmac.TrashDrop', 'ConsumeDrop', null,
                new GLib.VariantType('(b)'), Gio.DBusCallFlags.NONE, 700, null,
                (connection, response) => {
                    try {
                        const [accepted] = connection.call_finish(response).deep_unpack();
                        if (!accepted) return;
                        // Gio completion means the move finished, unlike a file
                        // manager D-Bus acknowledgement that can just queue it.
                        let index = 0, failed = false;
                        const next = () => {
                            if (index === files.length) {
                                if (!failed && GLib.find_program_in_path('canberra-gtk-play')) {
                                    try {
                                        GLib.spawn_async(null, ['canberra-gtk-play', '--id=trash-empty',
                                            '--description=Move to Trash'], null, GLib.SpawnFlags.SEARCH_PATH, null);
                                    } catch (error) { log(`Trash sound unavailable: ${error.message}`); }
                                }
                                return;
                            }
                            const file = Gio.File.new_for_uri(files[index++]);
                            file.trash_async(GLib.PRIORITY_DEFAULT, null, (source, result) => {
                                try { if (!source.trash_finish(result)) failed = true; }
                                catch (error) { failed = true; log(`Move to Trash failed: ${error.message}`); }
                                next();
                            });
                        };
                        next();
                    } catch (error) {
                        // Unsupported/unloaded Shell bridge: leave files untouched.
                        log(`FamiliarMac dock trash unavailable: ${error.message}`);
                    }
                });
            return false;
        });
