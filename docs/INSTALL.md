# Installation and recovery

## Supported baseline

Start inside your normal **Zorin OS 18.x / GNOME 46 Wayland** user session, not a root shell, SSH-only session or a different desktop. Full mode requires **MacBookPro10,1**. Other models/distributions need a new profile and testing; there is no `--force` switch.

Install Git from the distro if needed (`sudo apt install git`), clone this repository, and inspect:

```bash
./install.sh --check
./install.sh --full --dry-run
```

`--check` reports OS, Shell version, session, model and missing tools. It does not alter settings. `--dry-run` prints the planned commands; it does not execute package managers, installers, or preference writes. It is a plan, not proof of machine compatibility; actual installs run strict preflight and checksum validation.

## Desktop-only installation on other Intel Macs

Run `./install.sh --prepare-desktop` from the supported desktop session to install dependencies, shared WhiteSur theme/icon assets and wallpaper, then `./install.sh --desktop`. Both support `--dry-run`. Preparation may request sudo for packages/assets; it does not install keyd, GPU/Wi-Fi repairs, GDM overlays or boot changes. No serial number is needed for the About image. See [portability](PORTABILITY.md).

## Fresh installation

```bash
./install.sh --full
```

Full mode installs distro dependencies, builds pinned keyd, installs the hardware profile, WhiteSur theme/icons, boot resources, GDM styling/layout, user settings, Shell extensions and the rounding override. It preserves existing touchpad preferences unless explicitly requested. It does not repair Wi-Fi or install applications automatically. It does configure supported installed applications through the shared menu adapters and watches later application installations; see [application integration](APP-INTEGRATIONS.md).

System dependencies come from your configured distro repositories: build-essential, Python GI, nodejs, gjs, Dbusmenu GI, GLib tools, sassc, XML tools, gnome-screenshot, xclip, desktop-file-utils and unzip. Initial network access is needed. All upstream theme/extension source archives used by the installer are included and checksummed.

Do not disable an existing third-party keyd setup to bypass the installer guard. Merge profiles deliberately instead. keyd access is granted to your user and starts on the next boot; the session needs reopening to pick up group membership.

## Options

| Option | Effect | Activation |
|---|---|---|
| `--desktop` | Reapply user profile/extensions and rounding. Requires `--prepare-desktop` or an earlier full setup. Changes desktop shortcuts/theme/dock, not boot or GDM. | Reopen session |
| `--full` | Full supported hardware profile including keyboard, theme, boot/login and desktop | Reboot manually |
| `--input-preset` | Opt into initial reference natural scroll, click/tap and gesture preferences. Previously recorded input preferences are not repeatedly reset. | Session/device dependent |
| `--brightness` | gmux brightness-down reaches hardware zero; native brightness-up remains unchanged. Custom down shortcut applies to the unlocked user session. | Immediately / session keybinding refresh |
| `--scroll` | Pinned WSF 1.0.4 + Touchpad Speed Control 5, 25% both axes; responsive app settings; remove only verified old FamiliarMac scaler | Reopen session |
| `--smooth` | Legacy option name: responsive Firefox/ChatGPT settings; migrate prior managed Chromium launch flags | Fully reopen those apps |
| `--brave` | Launch Brave using X11 to obtain its exported global menu | Fully reopen Brave |
| `--chatgpt` | Native frame + actual Electron menu bridge + duplicate renderer menu removal; requires `--full`, installed app and matching source | Fully reopen app |
| `--wifi` | BCM4360-specific DKMS driver repair; requires `--full`. Can disconnect networking. It is not needed if Wi-Fi already works. | Driver reload/reboot |

Examples:

```bash
./install.sh --full --scroll --brave --brightness
./install.sh --desktop --dry-run
```

The optional ChatGPT scripts use exact source/hash guards and checked backups. An application update may invalidate a patch; stop on the error and inspect, rather than bypassing the guard. No proprietary application binaries are bundled.

## After installation

Save your work, then reboot manually for the full profile. Check that you can log in before making further customizations. Verify Command+C/V, terminal Ctrl+C, dock space, application menus, screenshot shortcuts and Wi-Fi. Open a text editor and a browser to compare scrolling. The login layer leaves authentication to GDM; a changed GNOME library hash makes its source overlay fall back to upstream.

Keep the repository at the same revision while applying/restoring related layers. The legacy `macbook-zorin` paths and extension identifiers remain intentionally stable; do not rename them by hand.

## Reinstall after formatting

1. Back up personal files, browser profiles and any settings you want to retain. This project is not a personal-data backup.
2. Record your working FamiliarMac commit (`git rev-parse HEAD`) and installation flags.
3. Save a copy of the repository outside the disk you will format.
4. Install supported Zorin, update normally and log into Wayland.
5. Clone/check out that recorded revision, run `--check`, inspect `--dry-run`, then run your chosen command.
6. Reapply your personal input preferences in Settings; default installation leaves them alone.

For an exact personal touchpad preference record (keep it privately, not in a public issue):

```bash
dconf dump /org/gnome/desktop/peripherals/touchpad/ > touchpad-settings.ini
# Later, on your own fresh installation:
dconf load /org/gnome/desktop/peripherals/touchpad/ < touchpad-settings.ini
```

## Rollback

```bash
./restore.sh             # user components in reverse layering order
./restore.sh --system    # additionally managed login/system/application layers
```

Backups live under `~/.local/state/macbook-zorin` and `/var/lib/macbook-zorin`. Do not delete them before rollback. User settings are restored from their original recorded values, so later intentional edits to those same keys can be replaced. Application binary and launcher restoration uses mismatch guards; if a file changed, it stops instead of overwriting the newer content.

Legacy Brave launcher backups made before the public installer lack a recorded installed hash/content. Automated restoration deliberately refuses them; compare `brave-launcher.json` with the current launcher and restore its `original` manually. If another layer changed the launcher, restore smooth-scroll first, then Brave.

Full rollback restores the selected original boot/GDM resources and keyboard configuration. It **does not** uninstall distro packages, keyd binaries, themes or extension source files. Wi-Fi driver repair is not rolled back automatically. Rounding is disabled and its previous preferences are restored; source files remain. Current processes are not restarted. A reboot may be needed.

### Login recovery

If login presentation fails, use a text console (Ctrl+Alt+F3; Fn may be needed) and log in:

```bash
cd /path/to/familiarmac
sudo bash scripts/install-login-layout.sh --restore
sudo bash scripts/visual-system.sh restore
sudo reboot
```

This restores managed presentation, not user accounts/passwords. A GNOME package update normally disables the overlay automatically via the version hash guard. Test upgrades before rebuilding an overlay.

## Individual components

Installers under `scripts/` are available for targeted work, but many have prerequisites and historical names. Prefer `install.sh`. `finish-v3.sh` and `fix-touchpad.sh` are historical repair utilities, **not** fresh-install entry points. `install-chromium-corners.py` is an unsuccessful experimental workaround retained as history; the public installer does not apply it.

## Dock icon alignment
The installer generates a user-local inherited icon theme from installed favorite application icons. It measures alpha bounds and normalizes the longest visible dimension to 84/96, centering artwork without stretching. It does not bundle proprietary app artwork. The FamiliarMac Icon Alignment extension reacts to favorite/application installation changes, debounces them and runs a cached helper outside the Shell process; there is no polling or per-frame image processing. A newly installed extension loads at the next login. You can also rerun `python3 scripts/install-dock-icons.py`. Other icons inherit the original theme. Restore with `python3 scripts/install-dock-icons.py --restore`. Application-supplied absolute icons are skipped.

## Desktop files dropped on dock Trash
`python3 scripts/install-trash-drop.py` creates a guarded user-local copy of the installed Zorin Desktop Icons extension. The drag source confirms a real failed-target release; a Shell bridge validates that the pointer is still on dock Trash before the existing Nautilus trash operation runs. Escape/cancellation does nothing; files are moved to Trash, never permanently deleted. Multiple selected ordinary files are supported. This integration targets desktop-origin drags, not arbitrary file-manager windows.

Log out/in after installation. The user copy shadows the distribution extension; rerun this installer after distribution desktop-icon updates to refresh it. Modified user copies are not overwritten automatically. Restore using `python3 scripts/install-trash-drop.py --restore`, then log out/in. Physical drag validation is still required after loading the new code.

## Finding and launching applications
Use **Command+Space** for floating app/settings/recent-file search; type a name, select with arrow keys and launch with Enter. Escape closes search. This uses AppMenu's existing search dialog, not Apple's Spotlight service or a full-disk index.

The movable **Apps** launcher is initially placed immediately after Finder. Finder remains first; Trash remains last with its own separator. Drag the other dock applications (including Apps) to reorder them. Drag a favorite upward away from the dock and release to unpin it; running apps stay running and can remain visible until quit. Later installer runs preserve their order. Apps opens a floating application browser with search, categories and Grid/List views; click outside or press Escape to dismiss it. Command+1 from the floating search opens this browser. New applications are discovered on each opening through GNOME’s application registry.

Install via `python3 scripts/install-apps.py` (included in `install.sh`). New Shell code needs a logout/login; until then Apps falls back to GNOME’s existing app grid. Live visual/drag verification remains pending after that login. This is a Linux implementation inspired by the current macOS Apps browser, not Apple’s implementation.

## Downloads folder stack
After loading the new Shell code, Downloads appears immediately left of Trash in the separate folder section. Click or right-click it, right-click for separate **Sort by**, **Display as** and **View content as** sections. Choose Fan/Grid/List/Automatic and Folder/Stack. **Options** sets a fan maximum of 5/7/10/12 files (default 7; reduced to fit short screens). Click a file to open it, or **Open in Files** for the complete folder. Uses your XDG Downloads folder, including localized folder paths. The popup counts all visible folder entries asynchronously, retains at most 200 for rendering and omits hidden files. Fan shows its remaining count at the top as **N More in Finder**, which opens the Downloads folder. Use the file manager for the complete folder. Date Added is disabled because Linux does not reliably expose the time a file entered this folder; Date Created sorts by birth time where available, with undated files last. Stack preferences are kept in `~/.config/familiarmac-stacks.json`. Disabling the FamiliarMac menu extension removes the stack UI, leaving Downloads files untouched.

## Reproducible application appearance checks

The application integration installer supplies shared control assets and
installation-event detection for the current user. Use the
[repeatable application audit](APP-INTEGRATIONS.md#repeating-installation-and-visual-checks-on-another-machine)
to review installed apps one at a time after installation. The default command
only lists applications; `--run` explicitly starts an interactive visual review.
No applications are launched automatically by `install.sh`.

### Responsive touchpad setup

`--scroll` installs the new pinned WSF method on GNOME 46 Wayland. It does not change distro packages, Wi-Fi, GPU or boot settings. `--smooth` is retained as an app-settings-only option; it no longer enables smooth scrolling. See [TOUCHPAD.md](TOUCHPAD.md) for validation status, prerequisites and rollback. Clean-OS installation remains unverified; local install and repeat-install passed.
