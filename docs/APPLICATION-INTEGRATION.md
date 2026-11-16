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
