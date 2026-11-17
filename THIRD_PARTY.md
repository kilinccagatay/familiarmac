# Sources, licenses and modifications

FamiliarMac-authored integration code is GPL-3.0-or-later. Third-party files remain under their original licenses. Copyright notices and licenses are retained inside the archives and/or adjacent license files; the top-level license does not relicense trademarks or third-party assets.

| Source | Pinned version / revision | License / location | Use and local changes |
|---|---|---|---|
| [keyd](https://github.com/rvaiya/keyd) | 2.6.0, `7c0aecb8bfd34dc8642bf4eefd2e59c89e61cec3` | MIT/X, archive `LICENSE` | Source unchanged; Apple device profile, app-specific mappings and GNOME integration installation |
| [WhiteSur GTK](https://github.com/vinceliuice/WhiteSur-gtk-theme) | `d5782652d412137e26fb8ff55b55a5572e4c6995` | MIT, archive `COPYING` | Source unchanged; local Shell/GDM/headerbar CSS layered over generated theme; bundled upstream background used |
| [WhiteSur icons](https://github.com/vinceliuice/WhiteSur-icon-theme) | `73d8040da51a9ed74e47c7366e7e9ff437601a5c` | GPL-3.0, archive `COPYING` | Source unchanged, installed as a separately named theme |
| [AppMenu](https://github.com/ChathurangaBW/AppMenu) | 5.7.1, upstream `edd9373261995f64d5f7e82a0c3eb74a63768a18` | GPL-3.0, archive `LICENSE` | Modified source archive: real menu registration, fallback handling, desktop actions, app actions, focus debounce, shortcut dispatch, lifecycle and compact menu CSS |
| [Rounded Window Corners](https://github.com/flexagoon/rounded-window-corners) | EGO extension 7048, version 13 | GPL-3.0, `vendor/rounded-window-corners-LICENSE` | Pinned extension plus readable overrides in `overrides/rounded-window-corners`: outer actor bounds, maximized inset, signal lifetime cleanup |
| [Touchpad Gesture Customization](https://github.com/HieuTNg/touchpad-gesture-customization) | version 27, EGO download 76688 | GPL-3.0, `vendor/touchpad-gestures-LICENSE` | Pinned extension; reference preferences opt-in, no local gesture engine fork |
| [Magic Lamp](https://github.com/hermes83/compiz-alike-magic-lamp-effect) | EGO version 25 | GPL-3.0, zip `LICENSE` | Unmodified extension, 400ms profile |
| [Devicon Apple SVG](https://github.com/devicons/devicon/blob/master/icons/apple/apple-original.svg) | local vendored SVG; content identified by manifest hash | MIT, `assets/DEVICON-LICENSE` | White variant and multiple raster sizes derived locally; icon marks retain trademark restrictions |
| [GNOME Shell](https://gitlab.gnome.org/GNOME/gnome-shell) | installed distro GNOME 46 source | GNOME's original GPL terms | Login builder extracts local `loginDialog.js`, guards exact replacements and library hash; no authentication replacement |
| [Wayland Scroll Factor](https://github.com/daniel-g-carrasco/wayland-scroll-factor) | 1.0.4, `883c700502f5975a6078763b7cc889096f6644ae` | MIT, `vendor/wayland-scroll-factor-1.0.4/LICENSE` | Unmodified CLI/library sources and ABI checker; local build/install integration, no GUI |
| [Touchpad Speed Control](https://github.com/ritesh-777/touchpad-speed-control) | EGO version 5 | GPL-3.0, `vendor/touchpad-speed-control-v5/LICENSE` | Unmodified source; schemas compiled at installation |
| [libinput](https://gitlab.freedesktop.org/libinput/libinput) | ABI reference 1.25.0 | MIT upstream; not bundled | ABI checked for upstream WSF; former custom scaler removed |
| [Plymouth](https://gitlab.freedesktop.org/plymouth/plymouth) | distro package | upstream license; not bundled | Original script theme, boot progress and prompt callbacks |
| Distro packages: GTK, GDM, Dbusmenu, Broadcom STA | configured Zorin repositories | respective package copyright/license files | Installed via package manager, not redistributed in this repository |

## Reproducible source record

`vendor/SHA256SUMS` covers the exact shipped upstream archives and logo assets. `vendor/manifest.json` lists their hashes and sizes. AppMenu's archive is the **modified** source, not an unmodified upstream release; it can be inspected without installing:

```bash
mkdir -p /tmp/familiarmac-appmenu
 tar -xzf vendor/appmenu-5.7.1.tar.gz -C /tmp/familiarmac-appmenu
```

No proprietary ChatGPT/macOS binaries are distributed. Optional ChatGPT patches operate only on an already-installed, matching local application and retain its original backup. Project changes to upstream-derived files are described in `docs/CHANGES.md` and Git history. The bundled archive license text is authoritative where a short label above omits upstream details.

Apple, macOS, MacBook and the Apple logo are trademarks of Apple Inc. Brave, ChatGPT and other referenced product names belong to their respective owners. FamiliarMac is independent. The software licenses do not grant rights to imply endorsement or ownership of those marks.

Brightness behavior reference: [GNOME 46 gsd-backlight.c](https://github.com/GNOME/gnome-settings-daemon/blob/gnome-46/plugins/power/gsd-backlight.c) clamps this device's minimum above zero. FamiliarMac uses the existing active-session logind `SetBrightness` API for an opt-in zero-capable down key, without copying or patching the daemon. The gmux hardware test reached `actual_brightness=0` and native GNOME `StepUp` restored light.

### Desktop-to-dock trash integration
The installer patches a user-local copy of the system-installed `zorin-desktop-icons@zorinos.com` (Zorin's Desktop Icons NG fork). Original source headers credit Sergio Costas, Sundeep Mediratta and Carlos Soriano; GPL-3.0. The installed extension's source/license headers are preserved. The user-local copy uses the distinct `familiarmac-desktop-icons@local` UUID, with the original extension disabled while it is selected; it must not shadow Zorin's session-mode UUID. Only our insertion patch is shipped in this repository. Dock target detection uses Zorin Dash's existing location-app interface (`locations.js`). No upstream desktop-extension code is bundled by this addition.

`overrides/appmenu/searchDialog.js` derives from the pinned AppMenu search dialog above; retains its upstream license. Local changes: compact empty state, bounded results, fixed top anchor and outside-click dismissal. `overrides/appmenu/search.css` contains the accompanying FamiliarMac styling.

### Apps and Downloads behavior references
- [Apple: View and open apps](https://support.apple.com/en-ie/guide/mac-help/mh35840/27/mac/27): floating Apps search, categories and Grid/List behavior.
- [Apple: Use folders in the Dock](https://support.apple.com/en-mide/guide/mac-help/mchl231f08fb/mac): folder-stack Fan/Grid/List and open/collapse behavior.
- Evaluated [Dock Stacks](https://github.com/dragosol/dock-stacks): current metadata supports GNOME 49/50, not this GNOME 46 target.
- Evaluated [Dash2Dock Lite](https://github.com/icedman/dash2dock-lite/tree/98ef2ae08dfc0210f71767e4a1b6a10cdb06d6d8): its Downloads fan is coupled to that replacement dock’s renderer/animation engine.
Neither evaluated dock is installed or vendored. `appsBrowser.js` and `downloadsStack.js` are FamiliarMac implementations using the installed GNOME Shell widgets and Gio file APIs; no code from those candidate docks was copied.

### Control Center and menu ordering
- [Apple Control Center reference](https://support.apple.com/en-gb/guide/mac-help/mchlc9d0e1f2/27/mac/27). FamiliarMac's two-toggle SVG is original; no Apple artwork or control implementation is bundled. Native GNOME Shell 46 Quick Settings supplies the controls and system state.
- `overrides/appmenu/menuManager.js` derives from the pinned AppMenu archive documented above, retaining its license. The local change moves Help behind Window/custom menus without replacing actions.

Session confirmation reference: [Apple WWDC 2017 What's New in Cocoa](https://devstreaming-cdn.apple.com/videos/wwdc/2017/207mg6u1b7mfd02n/207/207_whats_new_in_cocoa.pdf) shows a restart question with a seconds countdown. Current GNOME Shell 46 endSessionDialog.js was inspected locally: its presentation rounds to 10-second intervals until the last 10 seconds. FamiliarMac wraps the display update; it does not replace or copy the session manager timer implementation.

### Toolkit-wide menu integration
`overrides/appmenu/realMenuManager.js` derives from pinned AppMenu 5.7.1 (GPL-3.0). `gtkMenuModel.js` is a FamiliarMac implementation using [Gio DBusMenuModel](https://docs.gtk.org/gio/class.DBusMenuModel.html) and [DBusActionGroup](https://docs.gtk.org/gio/class.DBusActionGroup.html). Native GTK exporter packages are supplied by [Vala Panel Appmenu](https://gitlab.com/vala-panel-project/vala-panel-appmenu); distro copyright notices remain in /usr/share/doc/appmenu-gtk*-module. They are not vendored here. Qt uses its native Canonical registrar protocol; Flatpak permissions follow the [Flatpak documentation](https://docs.flatpak.org/en/latest/sandbox-permissions.html).

### Optional Kepler video firmware repair
The targeted installer follows [Nouveau's video firmware guide](https://nouveau.freedesktop.org/VideoAcceleration.html). Extraction uses [envytools/firmware](https://github.com/envytools/firmware/tree/a0b9f9be0efad90cc84b8b2eaf587c3d7d350ea9) (MIT, Ilia Mirkin) and NVIDIA's official 325.15 driver archive. Neither extractor nor proprietary firmware binaries are redistributed here; source URLs and input/output hashes are documented in [GPU diagnostics](docs/GPU-DIAGNOSTICS.md). The NVIDIA archive is only extracted, never installed as a driver.

### Native Trash drop receiver and status menu activation
Original FamiliarMac code uses the installed GTK3/GIO APIs; no upstream source is bundled for this receiver. References: [GTK3 drag destination](https://docs.gtk.org/gtk3/method.Widget.drag_dest_set.html), [GIO asynchronous trash](https://docs.gtk.org/gio/method.File.trash_async.html), and [Mutter 46.2 Xwayland DND bridge](https://github.com/GNOME/mutter/blob/46.2/src/wayland/meta-xwayland-dnd.c). The bridge advertises a suggested Xdnd action; the receiver accepts COPY/MOVE but reports MOVE for trash, without requesting a second deletion by the source. Status-menu activation and keyboard-brightness adapters use installed GNOME Shell 46 popup and backlight controls.

### Shared Flatpak appearance and Chromium
Original FamiliarMac adapters use the [Flatpak sandbox permissions interface](https://docs.flatpak.org/en/latest/sandbox-permissions.html) and GTK user CSS. Chromium's [`browser.custom_chrome_frame` preference](https://chromium.googlesource.com/chromium/src/+/74cc2ff30c06738d09db97f9e7aba3e8ce3b308d/chrome/common/pref_names.cc) controls native system decoration; [`SystemTheme::kGtk`](https://chromium.googlesource.com/chromium/src/+/16fa99bb585526f1a4c56c467993f464bb732cd9%5E%21/) is its GTK appearance mode. No Chromium source is redistributed. Theme mirrors retain the installed themes' existing licenses.


The Flatpak GTK3 helper copies the installed distro `libappmenu-gtk-module.so`,
`libappmenu-gtk3-parser.so.0` and `org.appmenu.gtk-module` schema into a user-owned
runtime bridge directory. These remain Vala Panel Appmenu components; no GTK/GLib
system library is copied, and no binary is added to this repository. See the
[upstream module documentation](https://github.com/rilian-la-te/vala-panel-appmenu/blob/master/subprojects/appmenu-gtk-module/README.md).
Electron accelerator metadata follows [Electron MenuItem](https://www.electronjs.org/docs/latest/api/menu-item);
role defaults come from Electron, not a label-based shortcut database.

GIMP shortcut-file interpretation follows its own
[`shortcuts-rc.c` serializer](https://github.com/GNOME/gimp/blob/master/app/menus/shortcuts-rc.c):
default accelerators are written as commented action records. The local reader is
read-only and retains explicit user overrides; no GIMP source or default key table
is copied into the repository.

Evolution native menu profile: [upstream shell settings schema](https://github.com/GNOME/evolution/blob/master/data/org.gnome.evolution.shell.gschema.xml.in) documents `menubar-visible` and `menubar-visible-sub`. The integration uses these existing settings; no Evolution source code is copied.
