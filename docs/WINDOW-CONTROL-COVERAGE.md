# Window control coverage

Research and implementation audit: 2026-11-17. A framework being detected is not proof that every application built with it adopts native controls. Never replace arbitrary application binaries to force the theme.

| Family / examples | Handling | Validation / limits |
|---|---|---|
| Native GTK3/GTK4 and libadwaita | Existing shared theme/header controls | Existing application audit; custom in-app controls can differ |
| Native Qt Widgets, e.g. CoolerControl, LibreCAD | Detect direct Qt dependency + installed XCB plugin; generate guarded user launcher | CoolerControl 5.1.2 visually verified; LibreCAD next-launch visual check pending |
| Qt Quick and simple `env KEY=value app` launchers | Same capability detection; arguments/actions preserved | Automated detection tests; no new Qt Quick application visually verified on reference machine; frameless QML remains app-owned |
| Qt Flatpaks | Existing runtime/library detection and X11 permission | Existing audit; custom window content not rewritten |
| VS Code, VS Code Insiders, VS Code Flatpak | Documented `window.titleBarStyle: native`; preserve JSONC comments and unrelated settings | Config transformation tested; not installed on reference machine, so visual check pending; restart required |
| Chrome/Chromium-family Flatpaks | Existing profile adapter, stopped-profile guard and launch wrapper | Existing audit; not a universal Electron solution |
| ChatGPT | Existing version-guarded adapter | Separate from generic Electron; unsupported builds must fail closed |
| Logseq | Upstream provides `window/native-titlebar?` in Electron configs.edn | Installed package found; not auto-edited: version-specific EDN profile and lifecycle need validation first |
| JetBrains IDEs | Upstream documents custom decorations and version-specific options | Tracked as review required; no global Java VM flags or guessed profile modifications |
| Zed | Upstream `window_decorations: server` option | Explicitly not auto-enabled on GNOME Wayland: upstream says server-side decoration is unsupported there |
| Arbitrary Electron/Tauri/frameless applications | Application must expose a supported native-frame option | Do not treat GTK theme access or XCB alone as sufficient |
| Snap/AppImage, Python Qt wrappers, custom user launchers and D-Bus activation | Review required unless a dedicated adapter already handles them | No arbitrary script execution, guessed binary patching, sandbox weakening or replacement of user platform choices |

## Automatic refresh and rollback

Both new adapters are installed with the existing event-driven application integration service. Package/launcher updates trigger detection; no periodic application launches. Native Qt managed outputs are excluded from inventory fingerprints to avoid feedback loops. Source launcher arguments and desktop actions survive refresh. Explicit platform selections, D-Bus activation and user-owned launchers are preserved. Later edits to managed files stop automatic overwrite/restore.

The editor adapter handles ordinary installed profiles, not portable/custom `--user-data-dir` profiles. Profiles or settings introduced after install need a refresh; editing user settings is not itself a watched event. JSONC parsing rejects malformed or ambiguous input instead of replacing the file. Changes require restarting affected applications; no automatic logout or daemon restart.

Records: `~/.local/state/familiarmac/native-qt` and `editor-decorations`. `install-app-integrations.py --restore` reaches these adapters through toolkit restoration. For component-only rollback, invoke the corresponding adapter with `--restore`.

## Primary sources

- [Qt platform selection](https://doc.qt.io/qt-6/qpa.html): QPA environment/command-line selection and XCB.
- [VS Code layout settings](https://code.visualstudio.com/docs/configure/custom-layout): native title bar, restart requirement.
- [VS Code 1.98](https://code.visualstudio.com/updates/v1_98/): custom title bar became Linux default.
- [JetBrains window-control differences](https://support.jetbrains.com/hc/en-us/articles/40254552079634-Why-window-control-buttons-in-IDE-look-or-placed-differently-from-other-Linux-applications): custom decorations and version-specific remedies.
- [Zed window decorations](https://zed.dev/docs/reference/all-settings): explicit GNOME Wayland limitation.
- [Electron custom title bars](https://github.com/electron/electron/blob/main/docs/tutorial/custom-title-bar.md): application-owned window options.
- [Tauri window customization](https://tauri.app/learn/window-customization/): application-level decoration setting.
- [Logseq window implementation](https://github.com/logseq/logseq/blob/master/src/electron/electron/window.cljs) and [configuration location](https://github.com/logseq/logseq/blob/master/src/electron/electron/configs.cljs).

### Snap / Flutter: BlueBubbles

BlueBubbles Snap 2.1.6.0 uses its own Flutter title bar by default. Its supported
`titleBarStyle=0` preference selects the native GTK frame (upstream enum:
`native, custom, hidden`). This is an application capability, not a universal
Flutter switch. The adapter changes only that key while the app is stopped,
retains explicit hidden/unknown values, and restores only its own preference.
Message databases and connection settings are not modified or included in backups.

Snap's desktop launcher links the user's GTK CSS without copying its relative
`familiarmac-controls` SVG directory. `snap-appearance.py` supplies those assets
only to existing profiles whose CSS contains the shared controls marker. It
preserves unowned assets and tracks owned assets for updates/restoration.
The application watcher now includes `/var/lib/snapd/desktop/applications`.
The lifecycle timer discovers profiles created on first launch and retries deferred
preferences after the app exits. A stable profile is checked automatically within
approximately 15–35 seconds. The first Snap window can still use its original
frame; the next launch receives the prepared preference. This does not imply
that every custom Snap title bar is supported.

Source checked against installed release:
[BlueBubbles settings, v2.1.6+desktop.96](https://github.com/BlueBubblesApp/bluebubbles-app/blob/v2.1.6%2Bdesktop.96/lib/database/global/settings.dart).

Snap GTK3 frames also need the selected host theme itself. The adapter mirrors
that theme's GTK3 files into each existing Snap profile's `.themes` directory,
retaining the standard Snap theme link for rollback. Owned copies are refreshed;
user-modified copies are preserved. No `GTK_THEME` or forced dark-color override
is set. The lifecycle timer also notices a changed GTK theme name and prepares its
Snap copy after the application exits. BlueBubbles 2.1.6.0 was visually
verified with the dark WhiteSur frame and left-side traffic-light controls.
