# FamiliarMac

**A familiar Linux desktop for people who already know their Mac.**

[🇹🇷 Türkçe](docs/README.tr.md) · [Install](docs/INSTALL.md) · [All changes](docs/CHANGES.md) · [Sources & licenses](THIRD_PARTY.md) · [Known limitations](STATUS.md)

A Mac can remain useful long after its supported macOS releases stop arriving. Linux can extend its life, and I wanted the desktop to keep the routines its owner already knew.

This project began when I installed Linux on my father's MacBook. He was already comfortable with macOS, and I wanted him to keep using the computer in a familiar way rather than change his habits just because the operating system changed. FamiliarMac collects the themes, shortcuts and desktop integrations I assembled for that goal. It is also a reproducible record for reinstalling my own machine after a format.

FamiliarMac changes the **interface and interaction**, not the operating system into macOS. It combines credited upstream projects with integration code and fixes. It is not a new distribution, an Apple product, or a universal macOS compatibility layer.

## Screenshots

Feature close-ups cropped from the installed desktop. Click an image to open the full capture. Network and account names are redacted where needed.

[![Dock](docs/screenshots/details/dock.png)](docs/screenshots/apps.png)

| About this Mac | Applications |
| --- | --- |
| [![About this Mac](docs/screenshots/details/about.png)](docs/screenshots/about.png) | [![Applications](docs/screenshots/details/apps.png)](docs/screenshots/apps.png) |

| Spotlight search | Calculator |
| --- | --- |
| [![Spotlight search](docs/screenshots/details/spotlight-search.png)](docs/screenshots/spotlight-search.png) | [![Calculator](docs/screenshots/details/spotlight-calculator.png)](docs/screenshots/spotlight-calculator.png) |

| Control Center | Notification Center |
| --- | --- |
| [![Control Center](docs/screenshots/details/control-center.png)](docs/screenshots/control-center.png) | [![Notification Center](docs/screenshots/details/notifications.png)](docs/screenshots/notifications.png) |

| Wi-Fi | Sound |
| --- | --- |
| [![Wi-Fi](docs/screenshots/details/wifi.png)](docs/screenshots/wifi.png) | [![Sound](docs/screenshots/details/sound.png)](docs/screenshots/sound.png) |

| Display brightness | Volume indicator | Keyboard backlight |
| --- | --- | --- |
| [![Display brightness](docs/screenshots/details/brightness-osd.png)](docs/screenshots/brightness-osd.png) | [![Volume indicator](docs/screenshots/details/sound-osd.png)](docs/screenshots/sound-osd.png) | [![Keyboard backlight](docs/screenshots/details/keyboard-osd.png)](docs/screenshots/keyboard-osd.png) |

| System and power menu | Restart confirmation |
| --- | --- |
| [![System and power menu](docs/screenshots/details/power-menu.png)](docs/screenshots/power-menu.png) | [![Restart confirmation](docs/screenshots/details/restart-dialog.png)](docs/screenshots/restart-dialog.png) |

**Application menus in the top bar**

The menu bar follows the active application. Firefox and Files (shown as Finder) are captured below with their File menus open.

| Firefox | Finder |
| --- | --- |
| [![Firefox](docs/screenshots/details/firefox-global-menu.png)](docs/screenshots/firefox-global-menu.png) | [![Finder](docs/screenshots/details/finder-global-menu.png)](docs/screenshots/finder-global-menu.png) |

**Login screen**

[![Login screen](docs/screenshots/login.png)](docs/screenshots/login.png)

**Keyboard brightness menu**

[![Keyboard brightness](docs/screenshots/details/keyboard.png)](docs/screenshots/keyboard.png)

[All screenshots and capture notes](docs/SCREENSHOTS.md)

## What it includes

- A single Apple-style system menu, application menus where apps export them, and Finder-like desktop actions.
- A fixed bottom dock that reserves window space, native running dots, and separate close/quit shortcuts.
- Left-side window controls, rounded outer corners, compact menus and optional minimize animation.
- Command-key shortcuts and screenshot shortcuts that also work over supported Shell menus/dialogs.
- A vector-derived boot logo with a progress indicator; a separate, version-guarded login layout.
- Optional touchpad scroll scaling; see the [tested responsive-scrolling setup](docs/TOUCHPAD.md) for WSF, Firefox and application-specific validation.
- Pinned upstream source archives, local backups, rollback commands, checksums and tests.

See [the complete change inventory](docs/CHANGES.md) for scope and file locations. Some features remain experimental; [STATUS.md](STATUS.md) distinguishes tested code from visually verified behavior.

## Automatic application adaptation

An event-driven service checks application installations and updates, including
Flatpak runtime updates. It detects supported toolkits and applies shared menu,
window-control and theme integrations; it does not keep launching apps in the
background. Package changes trigger a check; unchanged inventories skip repeated work.

GTK3 Flatpaks, including wxGTK applications such as Audacity, receive the menu
exporter only after its dependencies and schema are checked inside their runtime.
Existing library paths and GTK modules are preserved. GTK4 and Qt retain their
separate integration paths. Electron menus now retain the application's actual
shortcut metadata, displayed as muted Apple-style hints.

[![Audacity: exported menus and shortcuts](docs/screenshots/details/audacity-global-menu.png)](docs/screenshots/audacity-global-menu.png)

This is toolkit detection plus explicit compatibility adapters, **not a guarantee
for every Linux app**. Open applications may need a normal restart. See the
[application audit](docs/APPLICATION-AUDIT.md) and [automation details](docs/APPLICATION-INTEGRATION.md)
for verified results, unsupported cases and troubleshooting.

## Updating menus and shared themes

The shared GTK header rules preserve traffic-light sizes and give controls and
search fields balanced vertical space. They are installed for native GTK apps
and supported Flatpaks, including through the installation/update watcher.
GTK menus use actual application/window actions; partial exports can be completed
with recognized exported commands. Shortcut hints come from exported metadata or
application-owned keymaps and explicit GtkBuilder action/accelerator pairs.
Portal file choosers retain their requesting application's identity when ownership
can be verified. These changes do not make unexported GTK4 widget actions available.

For an existing installation, run from your checkout as your desktop user:

```bash
git pull --ff-only
bash install.sh --check
bash install.sh --desktop --dry-run
bash install.sh --desktop
```

This reapplies the desktop profile and installs the menu extensions and shared
appearance adapters. It does not select the opt-in Wi-Fi or boot installation.
Save work before signing out and back in to load new Shell code. Fully quit and
reopen apps to load new GTK CSS; some apps keep a background process after their
last window closes. There is no automatic logout or reboot. See
[installation and rollback](docs/INSTALL.md), [integration details](docs/APPLICATION-INTEGRATION.md)
and the [audit's remaining limitations](docs/APPLICATION-AUDIT.md).

## Compatibility

| Component | Current supported baseline |
|---|---|
| Desktop integration | Zorin OS 18.x, GNOME Shell 46, Wayland; existing WhiteSur setup for desktop-only mode |
| Full hardware profile | Intel MacBookPro10,1 (15-inch Retina family); tested machine ran Zorin OS 18.1 |
| Other Macs / distributions | Not validated. Full installation intentionally refuses other hardware. Contributions for separate profiles are welcome. |
| App global menus | Apps exporting compatible D-Bus menus; not every Linux application |
| ChatGPT patches | Optional, exact-source guarded; unsupported app versions stop rather than patch blindly |

The project name is distribution-independent. The first implementation is not: it uses Zorin's dock, GDM theme packaging and GNOME 46 internals. Removing those checks does not make it portable.

## Start here

```bash
git clone https://github.com/kilinccagatay/familiarmac.git
cd familiarmac
./install.sh --check
./install.sh --full --dry-run
```

Read the [installation guide](docs/INSTALL.md), then on the supported machine:

```bash
./install.sh --full
```

No automatic logout or reboot. Full installation changes keyboard mapping, system themes, boot and login presentation and requires `sudo`. Touchpad preferences, Wi-Fi repair, scroll scaling and application patches are **opt-in**.

To add optional application integrations on a supported fresh install:

```bash
./install.sh --full --scroll --brave --brightness
```

Do not run a downloaded script through `curl | sudo bash`. Clone, inspect the plan, keep your backups and use the supported baseline. This installation path has preflight/unit/integration tests; a clean-OS end-to-end install has **not yet been independently verified**.

## Touchpad scrolling

On the reference MacBook, Wayland Scroll Factor **1.0.4** with Touchpad Speed Control **5** is active at **0.25** on both scroll axes; pinch factors remain **1.0**. Finder stops when the fingers stop. In an isolated Firefox test, disabling smooth scrolling removed the trailing movement while fingers remained on the touchpad. That preference is saved for the normal Firefox profile’s next launch. ChatGPT’s smooth-scrolling disable flag is staged for its next launch and **not yet physically verified**. This is not a claim of identical macOS momentum.

`--scroll` now installs pinned WSF + Touchpad Speed Control and the responsive application settings. Our old fixed scaler is removed, not layered underneath WSF. The legacy `--smooth` option now installs only the responsive app settings (it no longer enables animation). See [configuration, verification and rollback](docs/TOUCHPAD.md). Wi-Fi, boot and GPU settings are unchanged by this option.

## Reinstall and undo

Keep a copy of the repository/release and your own files outside the machine before formatting. The source archives in `vendor/` are pinned; distro packages still require network access. Local rollback backups are stored under `~/.local/state/macbook-zorin` and `/var/lib/macbook-zorin`, not in GitHub. Those names are retained for compatibility with existing installs.

```bash
./restore.sh             # user profile and optional user components
./restore.sh --system    # also restore managed boot/login/keyboard/app patches
```

Read [rollback details and limitations](docs/INSTALL.md#rollback) first. Rollback retains installed packages and extension source files; it is not an OS snapshot or an uninstaller for third-party software.

## Development

```bash
NODE=node bash tests/run.sh
```

The tests run without changing your desktop. D-Bus integration and GDM-source tests are documented separately in [DEVELOPMENT.md](docs/DEVELOPMENT.md). Please include your GNOME version, session type, hardware model and the affected component when reporting a bug; do not upload account tokens or personal logs unredacted.

## Credits and licensing

Built on keyd, WhiteSur, AppMenu, Rounded Window Corners, Touchpad Gesture Customization, Magic Lamp, GNOME and libinput. See [THIRD_PARTY.md](THIRD_PARTY.md) for exact versions, licenses, source URLs and our modifications; checksums are in [vendor/SHA256SUMS](vendor/SHA256SUMS).

Project-authored integration code is GPL-3.0-or-later. Third-party code/assets retain their original licenses and notices; see [LICENSE](LICENSE). Apple, macOS, MacBook and the Apple logo are Apple trademarks. Names and visual references describe the compatibility goal and do not imply affiliation or endorsement. No macOS system binaries, account credentials or user photos are included.

Window controls: [automatic coverage and known exceptions](docs/WINDOW-CONTROL-COVERAGE.md) documents native Qt, Qt Quick, VS Code and application-owned title bars.

Snap integration now detects desktop installation/update events and supplies
missing shared GTK control assets. BlueBubbles has a supported native-frame
adapter; custom Flutter controls are not universally themeable. See
[window-control coverage](docs/WINDOW-CONTROL-COVERAGE.md#snap--flutter-bluebubbles)
for restart requirements and current limits.
