# Automatic application integration

Run as your desktop user:

    python3 scripts/install-app-integrations.py

Also included in the desktop installer. Dependencies are in bootstrap.sh.
The registry config/app-integrations.json selects explicit adapters. A user
systemd path unit watches native and Flatpak application export directories;
login also refreshes installed integrations. No polling or resident Python.
Our own launcher output directory is deliberately not watched, avoiding loops.
Unknown applications are left untouched. Native menu exporters are consumed by
the existing registrar automatically; unsupported applications need a tested
adapter or upstream menu-export support. This is not universal menu emulation.

## Tested adapters

- Firefox Flatpak: enable its real global menu, copy the two installed host
  libdbusmenu libraries into its private config directory, grant only access
  to com.canonical.AppMenu.Registrar, and use X11/XWayland for this GNOME menu
  bridge. browser.tabs.inTitlebar=0 selects the system-style titlebar. Profile
  user.js gets a marked block; other preferences remain. The launcher refreshes
  profiles and libraries on each launch. New profiles receive settings on the
  next launch after they are listed in profiles.ini.
- Native Brave: preserve the existing X11 native-menu launcher adapter.

Installation/update events reapply these supported profiles. Vendor files and
browser binaries are not patched. Desktop actions/URL forwarding are retained.
Flatpak permission changes require restarting the browser. A login is not
required. Unknown future library/runtime ABI changes may need adapter updates.

## Verification

Firefox 160 Flatpak on this host was tested with a separate blank profile.
The real registrar exposed File, Edit, View, History, Bookmarks, Tools, Help.
Both dbusmenu libraries loaded within the sandbox. The user confirmed Firefox
was fixed. Repeated preparation leaves one preference block; the shared event
service completed for both Firefox and Brave. Original user browser was not
terminated; only isolated test windows were closed.

## Restore/disable

To stop automated reapplication first:

    systemctl --user disable --now familiarmac-app-integrations.path familiarmac-app-integrations.service
    python3 scripts/firefox-global-menu.py --restore
    python3 scripts/install-brave-global-menu.py --restore

Firefox restore checks that managed launcher/permissions were not externally
edited before restoring their saved originals. It removes only its marked
profile block. Backups remain in ~/.local/state/familiarmac/firefox-menu.
The copied libraries are package-provided files, not redistributed in this repo;
keep the system libdbusmenu packages updated. Their copyright/license notices
are under /usr/share/doc/libdbusmenu-glib4 and libdbusmenu-gtk3-4.

Sources:
- https://bugzilla.mozilla.org/show_bug.cgi?id=1419151
- https://github.com/mozilla-firefox/firefox/blob/main/widget/gtk/NativeMenuGtk.cpp
- https://github.com/mozilla-firefox/firefox/blob/main/widget/gtk/DBusMenu.cpp
