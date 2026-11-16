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
| [libinput](https://gitlab.freedesktop.org/libinput/libinput) | ABI reference 1.25.0 | MIT upstream; not bundled | Small original scroll-value interposer; no libinput code copy or device setter |
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
