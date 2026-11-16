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
                        if (accepted) imports.dbusUtils.RemoteFileOperations.TrashURIsRemote(files);
                    } catch (error) {
                        // Unsupported/unloaded Shell bridge: leave files untouched.
                        log(`FamiliarMac dock trash unavailable: ${error.message}`);
                    }
                });
            return false;
        });
