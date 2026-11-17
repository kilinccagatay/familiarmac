# Portability and hardware boundaries

## Implemented plan

1. Separate clean desktop preparation from the reference MacBook’s system profile.
2. Keep GPU, wireless and boot troubleshooting explicit; never infer authorization from a model photo match.
3. Detect the hardware offline and choose an older-style computer illustration by category.
4. Preserve native About fields and its binary-hash compatibility guard.
5. Verify unsupported-device fallbacks, catalog integrity and installer boundaries without changing live hardware settings.

## What a new user experiences

`--all` combines preparation, the user desktop/app adapters and the portable visual boot/login layer in one command. It excludes the reference-machine hardware profile and rejects hardware-specific options. `restore.sh --all` restores those layers without the legacy hardware restore.

`--check` only reports compatibility/dependencies. The supported baseline remains Zorin OS 18.x, GNOME 46, x86_64 and Wayland; this is not a universal Linux/Apple Silicon installer. `--prepare-desktop` installs the prerequisites and shared theme assets, with sudo for those tasks. `--desktop` then installs the user profile, extensions and automatic app adapters. Apps may require reopening and Shell extensions require a new login. Unsupported app/toolkit behaviour remains subject to the integration coverage report; we do not promise every app has an exportable native menu.

The existing working machine does not need preparation or a full reinstall. This change only installs the selected About image here; no GPU, Wi-Fi, keyboard or boot configuration is reapplied.

| Path | Driver/firmware/boot changes | Scope |
|---|---|---|
| `--check` / `--dry-run` | None | Inspection |
| `--all` | Visual Plymouth/initramfs and GDM only; no driver/input profile | Combined preparation, desktop/app adaptation and portable boot/login |
| `--prepare-desktop` | None | Dependencies, shared themes/icons/wallpaper |
| `--desktop` | None | User theme, menus, integration and About image |
| `--system-appearance` | Plymouth assets/initramfs and GDM presentation only; no hardware profile | Explicit opt-in after preparation |
| `--full` | Plymouth/initramfs, login and keyboard profile; no GPU driver repair | Explicit MacBookPro10,1-only profile |
| `--wifi` | BCM4360 driver repair | Explicit flag requiring full mode |
| Early KMS, video firmware, kernel selection, GRUB experiments | Potential boot/driver changes | Separate manual scripts, not called by public installer |
| Mixxx software-rendering workaround | App-specific environment | Separate script, checks Nouveau GT650M PCI identity |

`apply.sh --gui` is the legacy alias for full mode, not the portable entry point. Archived diagnostic scripts are not a recommended installation sequence. Do not run all scripts in the scripts directory. A hardware profile must be reviewed and tested separately before it is offered for another model. Existing working Wi-Fi/graphics settings remain in place.

## About images

Fourteen transparent SVG category illustrations replace the per-model Apple photo catalog: laptop, MacBook Air, white MacBook, all-in-one desktop, tower, cylindrical Mac Pro, white iMac, white-top Mac mini, mini computer, 12-inch Retina MacBook, Retina Air, 2016–2020 Intel MacBook Pro, 2019 Mac Pro tower and generic rack. Older Mac families (including iBook/PowerBook) select a category; other devices use SMBIOS chassis type. Unknown devices fall back to a desktop tower. The artwork is representative, not a claim to show the exact machine or year. There are no current Apple-line product photos.

Selection is offline and never reads a serial number. Asset paths and SHA-256 hashes are in `assets/hardware/categories.json`. Original model-photo imports and unused cutout experiments were removed from the repository; they are not fetched during installation.

Settings retains its native hardware/OS fields and binary-hash-guarded user resource overlay. An incompatible update falls back to native About. Rollback restores the original desktop/D-Bus launchers.

## Validation limits

The subsequent [real installed VM validation](VM-VALIDATION.md) covers dependency
installation, live menus, deferred-profile scheduling and reboot persistence on
one Zorin 18.1 Pro guest, and records both fixes and remaining gaps. Core's missing
Dock dependency is handled, but a separate Core OS installation is not claimed.

Tests cover old Mac family selection, chassis fallbacks, asset hashes and repeated About installation/restoration in an isolated HOME. Portable installer dry runs exclude hardware and login repair commands. This is not a physical compatibility test on every category of computer.

## Isolated clean-user integration test (2026-11-17)

Run on the supported Zorin baseline, without sudo:

```sh
python3 tests/clean-desktop-sandbox.py --node /path/to/node
```

This opt-in test requires Bubblewrap and existing build dependencies. It creates
an empty HOME, theme/icon destinations and Flatpak repository; mounts the host
root read-only; hides the host home, runtime sockets and installed Flatpaks; uses
an independent D-Bus session and persistent keyfile GSettings backend; and reports
a foreign `PortableTestPC` model. Network and host process namespaces are isolated.
All generated state is removed afterward. Host system/user services are **not**
started: `systemctl` calls are recorded and checked for user scope, and `sudo`
is blocked. Dependency installation with apt is not executed.

Observed results:

- Real pinned GTK/icon theme build into empty destinations passed.
- Real `install.sh --desktop`, then a second install, passed with native adapters,
  Shell extension files, About overlay, shared GTK controls and watcher units.
- A deliberately missing favorite app no longer aborts Dock icon setup.
- `--full` rejected the foreign model before any privileged command.
- The installed lifecycle helper discovered a new supported editor fixture and
  configured its native frame; a new locked Chromium profile remained untouched.
  After lock removal, the helper applied the pending frame preference, retained
  unrelated JSON fields and avoided rewriting the unchanged profile.
- Readable host boot, module, initramfs and NetworkManager file hashes were
  unchanged. Existing full regression suite passed.

The test exposed and fixed two issues: missing favorite desktop entries caused
PyGObject's `DesktopAppInfo.new()` to raise, and the upstream theme installer tried
to install its unrelated theme-switcher application. Desktop preparation now skips
that pinned upstream call with a source guard and extracts without restoring
archive ownership.

**Limits:** this is an empty-user/install integration test on existing Zorin
libraries, not a fresh OS VM, physical GPU test, live Shell visual test or real
systemd timer scheduling test. Native system apps/libraries are read-only host
inputs. Supported app profiles are synthetic; existing unit tests additionally
cover process detection and retry logic. A new Zorin VM or spare computer is still
needed when repeating dependency installation, login, visible menus and automatic
service scheduling end to end; the later VM report above records that additional
test on one configuration. No claim of universal application or hardware
compatibility follows from these results.
