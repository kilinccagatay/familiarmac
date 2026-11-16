import GLib from 'gi://GLib';
import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';

// A real AppIcon is required by GNOME Dash.getAppFromSource(). Both launchers
// use this adapter so the dock owns insertion, reordering and deduplication.
export function launcherAppButton(app, dialog, properties) {
    const button = new AppDisplay.AppIcon(app, {expandTitleOnHover: false});
    button.set(properties);
    // Retain the native icon subtree for theme/state notifications and tear it
    // down with the button when a launcher supplies its own compact content.
    const nativeContent = button.get_child();
    button.connect('destroy', () => {
        if (!nativeContent.get_parent()) nativeContent.destroy();
    });
    button._setPopupTimeout = () => {}; // Holding begins a drag, not an app menu.
    button.activate = () => {
        if (button._dragging) return;
        dialog.close();
        app.activate();
    };
    let settle = 0;
    button._draggable.connect('drag-begin', () => {
        for (const key of ['_timeoutId', '_timer']) {
            if (dialog[key]) GLib.source_remove(dialog[key]);
            dialog[key] = 0;
        }
        // Keep the source alive until DND finishes, but release the modal grab
        // and remove its full-screen actor from picking so the dock receives drops.
        dialog.popModal();
        dialog.hide();
    });
    button._draggable.connect('drag-end', (_draggable, _time, accepted) => {
        // DND emits drag-end BEFORE releasing its own grab and source references.
        settle = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            settle = 0;
            if (accepted) dialog.close();
            else {
                dialog.show();
                if (!dialog.pushModal()) dialog.close();
            }
            return GLib.SOURCE_REMOVE;
        });
    });
    button.connect('destroy', () => { if (settle) GLib.source_remove(settle); settle = 0; });
    return button;
}
