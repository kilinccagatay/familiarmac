# Finder and fullscreen spaces

Finder uses a unified toolbar: navigation stays beside the window controls,
the main menu is on the right, and one search icon expands into the search field.
There is no additional search row. A scope control inside the field switches
between This Mac and the folder where the search began. The existing filters,
search engine, results and file operations are retained.

Finder → Settings/Preferences → Advanced → **When performing a search** selects
Search This Mac, Search the Current Folder, or Use the Previous Search Scope.
This Mac uses Nautilus/Tracker's existing indexed search scope; it does not imply
that every mounted drive or unindexed folder is searched. Preferences persist in
`org.familiarmac.finder`, separately from native Nautilus preferences.

The normal installer includes `install-finder-search.py`. It currently supports
Nautilus 46, preserves all bound template objects, and uses user-local resource
overlays plus a public GTK/GObject helper. No package binary is modified. A binary
hash guard falls back to native Nautilus after an application update until the
adapter is rebuilt. Unsupported versions are left unchanged. Child applications
do not inherit the helper preload. `--restore` restores owned launchers while
preserving user edits; a native-launch shim remains if an edited launcher needs it.

Mission Control starts with compact desktop labels and expands previews on hover.
Window previews preserve their native corners. A blue hover outline follows the
scaled window with a two-logical-pixel gap and four-logical-pixel stroke.
The foreground window is re-evaluated on each entry; other windows are smaller.
Launching or activating an app from the Dock leaves Mission Control. Entry/exit
animations never display that outline; a pointer movement after entry enables it.
Typing does not start hidden overview search. The Apps search remains available.
The top panel and notification banners are hidden during this view; queued
notifications can appear after returning to the desktop.

The native green button requests fullscreen directly, before GTK can also issue
a maximize request. Alt-click retains the native maximize/unmaximize action.

The fullscreen space uses an inward-arrow exit control, not a close cross;
Alt reveals it alongside the desktop controls. It exits fullscreen without
closing the application.

New fullscreen windows get an owned workspace and return to their previous
workspace on exit. The fullscreen resize and workspace transition do not run
competing animations, and workspace removal waits for the resize to finish.
System animation preferences remain authoritative.

The top edge reveals the panel and window controls on the primary monitor.
Finder advertises a native reveal capability so its own toolbar and buttons remain
usable below the panel; other apps use compositor controls. Open panel menus and
native Finder popovers hold the reveal. Escape in Finder first dismisses native
menus/search, then exits fullscreen. Custom toolkit title bars and secondary
monitor behavior are not claimed to match Finder without separate verification.

Reference behavior:
[Finder settings](https://support.apple.com/guide/mac-help/change-finder-settings-on-mac-mchlp2803/mac),
[fullscreen apps](https://support.apple.com/guide/mac-help/use-apps-in-full-screen-mchl9c21d2be/mac).

## Remmina fullscreen

The green button delegates to Remmina’s native fullscreen toggle through a local GTK3 adapter. It never sends a shortcut into the remote session. Remmina keeps its own window lifecycle instead of a separate FamiliarMac fullscreen Space. The adapter is installed for the standard packaged Remmina desktop launcher; fully quit and reopen Remmina after updating. Flatpak and Snap builds are not covered.
