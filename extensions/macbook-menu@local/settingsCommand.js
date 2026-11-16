import GLib from 'gi://GLib';

export function settingsCommand() {
    const wrapper = GLib.build_filenamev([GLib.get_home_dir(), '.local/bin/familiarmac-settings']);
    return GLib.file_test(wrapper, GLib.FileTest.IS_EXECUTABLE) ? wrapper : 'gnome-control-center';
}
