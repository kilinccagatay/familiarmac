# Automatic application integration

Run as your desktop user:

    python3 scripts/install-app-integrations.py

Also included in the desktop installer. Dependencies are in bootstrap.sh.
The registry config/app-integrations.json selects explicit adapters. A user
systemd path unit watches native and Flatpak application export directories;
login also refreshes installed integrations. No polling or resident Python.
System and user launcher directories are watched. A fingerprint excludes generated launchers and skips unchanged inputs, preventing self-triggered write loops.
Toolkit capabilities are detected in addition to the explicit registry. Unknown/custom UI applications are left untouched. Native menu exporters are consumed by
the existing registrar automatically; unsupported applications need a tested
adapter or upstream menu-export support. This is not universal menu emulation.

## Tested adapters

- Firefox Flatpak: enable its real global menu, copy the two installed host
  libdbusmenu libraries into its private config directory, grant only access
  to com.canonical.AppMenu.Registrar, and use X11/XWayland for this GNOME menu
  bridge. browser.tabs.inTitlebar=0 selects the system-style titlebar. Profile
  user.js gets a marked block; other preferences remain. The launcher refreshes
  profiles and libraries on each launch. An empty first installation gets an initial profile before first launch. Additional profiles receive settings on the next launch after they are listed in profiles.ini.
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


## Shared toolkit support and limits

- Native GTK2/3: distro appmenu modules plus GNOME XSettings; the module is loaded on new processes. Existing processes are not killed. The session service preserves existing GTK modules.
- GTK GMenu: Shell reads the focused window's exported menu and action paths. Labels, sections, targets, toggle state and disabled actions come from the app. Dynamic updates are coalesced; no menu polling. Signal subscriptions are disconnected on focus/backend changes. A compatibility copy of the same top-level menu is suppressed.
- Qt Flatpaks: detect KDE runtime or bundled Qt Widgets/XCB support. Per-app overrides grant only the menu registrar D-Bus name and select X11/XWayland. Original overrides are backed up. Presence of Qt libraries is not proof an application actually exposes a menubar (Qt Quick and custom UI may not).
- Shared window decorations apply to server-decorated windows. Firefox's adapter requests those decorations explicitly. Arbitrary custom CSD, GTK4/Adwaita, Electron, Java and sandboxed GTK apps cannot all be restyled or made to export menus by one setting. Unsupported apps keep their own controls; no fake success claim or universal binary patch.

The local inventory is `~/.local/state/familiarmac/toolkits/applications.json`.
It distinguishes prepared toolkit access from a verified exported menu. On this machine the scan found 97 visible launchers: 36 Flatpaks (10 Qt candidates, Firefox, 25 without a verified adapter), and 61 other desktop launchers. These are detection counts, not 97 verified menus.

New-install verification: Mousepad was installed from the distro after the watcher was running. Its desktop-file event automatically ran preparation (inventory 96 → 97); no Mousepad-specific adapter was added. The new GMenu reader read File/Edit/Search/View/Document/Help and their actual actions from the running app. A session restart is required to load that new Shell module. VLC's live D-Bus menu exported Media/Playback/Audio/Video/Subtitle/Tools/View/Help, and the user confirmed it appeared in the panel.

`tests/gtk-menu-model.js` exports a real GMenu/GAction fixture on an isolated session bus, verifies target-bearing actions, disabled-state updates, deduplication, stable subscriptions and cleanup. No user applications are altered by this test.

### Fresh systems and recovery

The supported complete desktop baseline remains Zorin 18.x / GNOME 46 Wayland. A new install on that baseline runs bootstrap (including GTK menu modules), installs the Shell GMenu reader, configures current apps and enables future-install watchers. Other Linux desktop/Shell versions require a tested port; this is not a claim of distribution-independent compatibility.

To rerun detection deliberately:

    python3 ~/.local/lib/familiarmac/app-integrations.py --force

To restore shared toolkit/Firefox integration and stop watchers:

    python3 scripts/install-app-integrations.py --restore

The public restore.sh also invokes that path. Toolkit overrides are restored only if their current content still matches the managed version. Backups are kept. Distro packages and personal Firefox profiles are not deleted. Brave launcher restore remains its separate reverse-layered step.

Additional sources (runtime dependencies are distro-provided, not copied into this repository):
- https://docs.gtk.org/gio/class.DBusMenuModel.html
- https://docs.gtk.org/gio/class.DBusActionGroup.html
- https://gitlab.com/vala-panel-project/vala-panel-appmenu
- https://docs.flatpak.org/en/latest/sandbox-permissions.html

The overridden realMenuManager.js derives from the pinned AppMenu source in vendor/appmenu-5.7.1.tar.gz; its upstream license/source attribution in THIRD_PARTY.md continues to apply.

## Shared Flatpak appearance and Chromium adapters

All installed Flatpaks receive the same managed GTK3/GTK4 control stylesheet, preserving existing application CSS. Controls paint a shared 14-logical-pixel SVG background (28 physical pixels at 2x), independent of headerbar/button allocations and icon theme sizes. This matches the existing system/ChatGPT controls. Native GTK themes are mirrored into the user theme directory and made available read-only to Flatpak, alongside the shared `com.canonical.AppMenu.Registrar` talk permission. No blanket session-bus or home-directory access is granted. Theme mirrors remain as a reusable cache after restoring permissions.

The event-driven inventory also prepares Chrome, Chromium, Brave and Ungoogled Chromium Flatpak launchers using one Chromium-family adapter. It preserves desktop actions and URL forwarding, selects X11 for native menu export, and sets system window decorations before starting an unlocked profile. Locked profiles are left unchanged. A fresh profile is prepared before first launch; existing unrelated preferences are preserved. Restore refuses to overwrite externally modified launchers.

Validated locally: Chrome system decorations, global menu and dark GTK theme; Blanket and Eyedropper GTK4 controls. The inventory currently contains 98 visible launchers, including 37 Flatpaks; every Flatpak receives the shared appearance configuration. This is not a claim that every application was opened or supports a traditional exported menu. Custom-rendered interfaces and applications without an exported menu remain toolkit-dependent. Restart an already-running application to load new sandbox permissions and CSS.

## Repeating installation and visual checks on another machine

Use the supported desktop baseline in [INSTALL.md](INSTALL.md). Run the public
installer as that machine's desktop user; do not copy another user's `.var/app`,
browser profiles, absolute home paths or Flatpak overrides. The installer copies
shared CSS/SVG assets, detects installed apps and enables the installation-event
watcher. It does not launch all applications during installation.

For an existing FamiliarMac setup, update these components with:

```bash
python3 scripts/install-app-integrations.py
```

Already-running apps must fully quit and reopen to load sandbox permissions and
GTK CSS. Closing the last browser window may leave its background process alive.
Do not terminate processes holding unsaved work. Future supported installations
are prepared through the same watcher; no per-machine app list is required.

The audit tool defaults to read-only inventory:

```bash
python3 scripts/audit-applications.py
python3 scripts/audit-applications.py --run
# Or inspect a small subset:
python3 scripts/audit-applications.py --run --app org.gnome.Calculator.desktop
```

The interactive audit launches only one selected application at a time, reserves
1800 MiB of available memory, and waits for normal closure before proceeding.
Skip existing work, installers and privileged tools. It never force-quits apps,
automatically accepts a dialog or alters system settings. Appearance and actual
menu export must be visually checked; a successful launch is not a pass.
Optional screenshots and results stay in `~/.local/state/familiarmac/audits/`.
Screenshots can contain personal information; review before publishing. The
operator confirms closure because GNOME Wayland does not offer this tool a
universal, reliable ownership-safe application shutdown API.

`tests/app-integration-install.py` runs the actual component installer in an empty
temporary home with service calls mocked, checks all runtime assets and repeated
installation, and verifies that restore stops the watcher before restoring
launchers. Together with Chromium/Firefox empty-profile and CSS-preservation
tests this checks reproducibility without changing host preferences. It does not
replace a full install test on a clean supported OS.
