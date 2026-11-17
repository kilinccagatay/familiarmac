# Automatic application integration

FamiliarMac combines toolkit detection with a small explicit adapter catalog
(`config/app-integrations.json`). The application audit is an evidence log, not a
hard-coded list of all supported applications.

## When checks run

`scripts/install-app-integrations.py` installs a systemd user path unit and oneshot
service. Launcher changes, `/var/lib/dpkg/status` and the system/user Flatpak
`.changed` markers trigger the dispatcher. The fingerprint includes these markers,
launcher deployment paths, integration code and appearance files. An unchanged
fingerprint skips work. There is no periodic background app launch or polling loop.

A check inspects installed metadata and ELF dependencies; literal `exec binary "$@"`
wrappers are resolved without executing the wrapper. Dynamic shell launchers are
not evaluated. GTK4 is excluded from the GTK3 adapter; Qt retains its native export
path. Unknown/custom toolkits are recorded without claiming successful menu export.

## GTK3 Flatpak menus

The helper copies only the distro menu exporter, its parser and its GSettings
schema under `~/.local/share/familiarmac/gtk3-menu`. Before saving per-application
overrides it resolves library symbols and checks the schema inside the runtime.
Incompatible runtimes are recorded as errors; new module overrides are not applied.
The directory is exposed read-only. Existing `GTK_MODULES`, `LD_LIBRARY_PATH` and
`XDG_DATA_DIRS` entries are retained; host GTK/GLib libraries and a global preload
are not injected. This also supports wxGTK applications such as Audacity.

These checks establish load compatibility, not complete functional correctness.
Menu actions and visual behavior still need testing. Audacity's real menus and
shortcut hints were verified after a normal launch on the supported machine.
Ardour's bundled YTK remains a deferred exception. A fresh OS installation has not
been independently verified end to end.

## Existing installations

After updating the repository, refresh the user automation:

```bash
python3 scripts/install-app-integrations.py
```

For an already installed Electron bridge, update its two files with backups:

```bash
sudo bash scripts/update-electron-menu-bridge.sh
```

Restart affected applications normally to load environment/module changes. Shell
JavaScript changes need a normal logout/login. Neither command logs you out or
restarts running applications. Full installation already includes these components.

Inspect the watcher and per-application report:

```bash
systemctl --user status familiarmac-app-integrations.path
journalctl --user -u familiarmac-app-integrations.service
cat ~/.local/state/familiarmac/toolkits/applications.json
```

Rollback uses saved per-application overrides and refuses to overwrite later
external changes. Use the documented project restore path rather than resetting all
Flatpak permissions. The helper libraries may remain on disk after rollback but
are no longer referenced by restored overrides.

## Validation

Tests cover detection through ELF dependencies and literal wrappers, GTK4 exclusion,
environment preservation, repeat installation, restore ordering, Electron metadata
and D-Bus activation. On the development machine a temporary hidden launcher
triggered the path unit and completed the oneshot integration run; the test launcher
was removed. This checks event delivery, not a newly downloaded app end to end.

## Application-owned shortcut files

When an exported GMenu omits accelerators, the read-only fallback can read Inkscape
key XML and GIMP 3 `shortcutsrc` version 1. GIMP serializes unchanged defaults as
commented action records; explicit user records (including unbindings) take
precedence. These are matched by action ID, not by translated menu label. The
reader never edits shortcuts. Saved file changes are monitored; unsaved in-app
changes may not appear until GIMP writes its file. Ambiguous multiple GIMP 3
profiles are left unlabelled rather than selecting another version's bindings.

### Audited native menu profiles

`native-menu-integrations.py` reads the same application catalog as the event dispatcher. Evolution needs both its own menubar enabled and an X11 launch for GTK3 module export. The profile preserves all desktop actions, arguments and field codes, disables D-Bus activation only in the generated user launcher, and backs up the two menu settings. Restore guards externally edited launchers and preserves later user setting choices. This is an audited opt-in profile, not a blanket X11 override for every application. Package update events regenerate it from the current vendor launcher.

### Seahorse 43 narrow-window workaround

The split header/content leaflets repeatedly changed allocation at the original
600 logical-pixel default: the sidebar alternated between 252 and 344 pixels,
with absent window controls. The issue also reproduced with Adwaita and with
`UBUNTU_MENUPROXY=0`. Widening stopped it. The audited profile applies a GLib
resource overlay changing only the default width (810) and minimum width request
(740); no credential, keyring, action or authentication code changes.

The adapter requires version 43.0 and the expected UI structure. A binary hash
check skips the overlay immediately after a package upgrade until the existing
event watcher validates/rebuilds it. Other versions are left unchanged. Restore
removes the generated launcher only if it has not been edited externally.
This is a constrained workaround with a wider minimum window, not an upstream
libhandy fix or a claim about every screen/text scale. Normal relaunch and 200
AT-SPI geometry samples remained stable on the audited machine.

### Shared menu completion (2026-11-17)

The panel now probes actual GTK application **and focused-window** action
addresses even when an app advertises an empty GMenu. A nonempty native menu or
D-BusMenu remains authoritative. The fallback groups window commands alongside
application commands and listens for action-state changes. Unclassified commands
remain available under More instead of disappearing from the application menu. It never guesses a
window number, starts an application while probing, or redirects a stale menu
callback into a newly focused document. Parameterized commands without a known
target remain excluded rather than being invoked with guessed arguments.

Dialog, modal-dialog and utility windows retain application identity. Portal
windows can inherit identity through their transient parent; action lookup still
uses the focused dialog, so a modal dialog does not expose the blocked parent's
document actions. Desktop and dock windows keep their existing treatment.

When native menu metadata lacks accelerators, the shared read-only reader also
supports GTK `accels`, `accels.scm` and `accelmap` files within that application's
profile (including Flatpak profiles). Only exact `app.`/`win.` detailed action
IDs are accepted. Saved defaults, user overrides, explicit unbindings, targets
and collisions are handled without assigning keys. Native exported accelerator
metadata takes precedence. Apps that neither export accelerators nor save a
supported binding file still cannot supply reliable hints; none are invented.
A saved accelmap may not exist until an application first writes its profile.

Verified against live Mousepad GMenu (Open accelerator), Rhythmbox empty-menu
fallback (Settings), and Apostrophe window Open/Save/Find actions including Find
activation and state-change notification. Unit tests cover late/stale responses,
D-BusMenu priority, real GMenu priority, exact window routing, subscription
cleanup, dialog/portal ownership and accelmap overrides. Shell JS changes take
effect on the next normal login; no session is forcibly restarted by installation.

### Python/GTK startup accelerator metadata

The shared reader also inspects an installed application's own `application.py`
when it directly declares a Gtk/Adw.Application subclass. It parses Python AST;
it never imports or executes application code. Only literal action IDs and
literal accelerator lists directly in `do_startup` are supported. Conditional,
loop-based, dynamic or later setter calls, ambiguous classes/packages, large
sources and other package modules setting accelerators cause this fallback to
be declined. Conflicting bindings are omitted. The selected Flatpak deployment
is resolved through `flatpak info --show-location`; native package discovery is
bounded to the matching application's package. No app-name binding table exists.

An existing user GTK accelerator map (even empty or explicitly unbound) takes
priority; exported menu accelerators remain authoritative. The reader cannot
prove arbitrary plugin/runtime behavior and does not claim support for those
cases. Applications using other startup structures still need another actual
metadata source. Updates are read on a fresh lookup, with source-file monitoring
for changes in the selected installation.

Apostrophe's installed startup declarations produced 14 bindings. A live model
check matched Open, Save, Save As, Find, Find Replace and Quit to the actual
exported actions. Exact underscore-containing action IDs are preserved instead
of being rejected by the stricter GAction detailed-name validator. Full panel
visual verification of these IDs is pending the next normal login.

### Orphan Portal chooser ownership

Some clients send `parent_window=x11:0` to FileChooser. In that case there is no
usable transient owner for the panel to follow. The per-user
`familiarmac-portal-owners.service` reads the actual backend FileChooser request
metadata on a dedicated read-only D-Bus monitoring connection. Only requests from
the current owner of org.freedesktop.portal.Desktop are accepted. No method is
rewritten or activated. File choices/options are not stored or logged.

In-memory records contain request handle, app ID, title and backend connection
PID and executable basename. Replies, errors and cancellation remove records; portal/backend restarts
clear state. The panel resolves an otherwise ownerless chooser only when its
PID and exact title match one outstanding request. GNOME sometimes lends its
Wayland socket to the backend, making Meta report the compositor PID instead.
For that case only, the panel requires the compositor PID, an exact portal
backend executable/window-class match, exactly one matching window, and exactly
one outstanding request with the same title. Ambiguity, missing IDs or
unavailable monitoring leave the existing identity unchanged. Real transient
parents and existing exported menus retain precedence. There is no VLC-specific
rule, previous-focus heuristic, Qt override or sandbox-permission change.

The installer installs/enables the user service; restore disables it after the
application watcher. Service failure is isolated from Shell; unavailable metadata
never blocks rendering. Live verification matched the real VLC chooser process
and title to org.videolan.VLC.desktop, then verified removal after cancellation.
The post-login visual test exposed the compositor/backend PID mismatch. After
correcting that resolver, the open chooser visibly displayed “VLC media player”.
Cancellation cleared the ownership state, and VLC’s native Media menu and
shortcut hints were visually rechecked. The same resolver was loaded live and
installed for subsequent logins; no logout was needed for this verification.
