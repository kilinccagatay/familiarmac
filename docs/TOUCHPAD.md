# Responsive touchpad scrolling

## Reference test, 2026-11-17

GNOME 46 / Wayland on the reference MacBook. This is touchpad finger scrolling, not a change to mouse wheel speed or pointer acceleration.

- [Wayland Scroll Factor](https://github.com/daniel-g-carrasco/wayland-scroll-factor) 1.0.4, commit `883c700502f5975a6078763b7cc889096f6644ae`.
- [Touchpad Speed Control](https://extensions.gnome.org/extension/10008/touchpad-speed-control/) version 5 (GNOME 46 approved archive SHA256 `c3d9700b53588f68aaf79906a3c6fe697e05abefafa58f2a744ba7f36ea556a7`).
- Vertical/horizontal factors 0.25; pinch zoom/rotation 1.0. Application-specific factor dictionaries empty so they inherit the global value.
- WSF mapped in the compositor, extension ACTIVE, old `scroll-scale.so` absent from compositor mappings.
- Finder: user confirmed content stops when fingers stop while still touching the pad.
- Firefox: user confirmed the same behavior in a separate test profile with `general.smoothScroll=false`. Normal profiles have the preference saved for the next full browser launch; that normal-profile restart is not yet verified.
- ChatGPT: replaced our `--enable-smooth-scrolling` launcher flag with `--disable-smooth-scrolling` for the next full launch. Physical result pending. The running conversation was not closed.

Reducing the factor to 0.21 did not address the reported problem: it was delayed trailing movement, not excessive distance. Restored 0.25. These tests do not prove identical macOS momentum or universal behavior across applications. No Wi-Fi, GPU, boot or authentication configuration was changed.

## Automatic installation

```bash
./install.sh --desktop --scroll --dry-run
./install.sh --desktop --scroll
```

The scroll component builds the pinned vendored WSF CLI/library with GCC, checks source hashes and the six exported libinput symbols, installs the pinned GNOME extension, and sets the global factors to 0.25. Dependencies: GNOME 46 Wayland, Python3/GObject, GCC, binutils/readelf, glib-compile-schemas and a user systemd session. No network download or sudo is needed by this component. Existing unrelated preloads and unrecognized Shell launch commands are refused.

Only our hash-recognized `~/.local/lib/macbook-zorin/scroll-scale.so` and exact historical `90-macbook-scroll.conf` are removed. Unknown/edited files stop installation. The old source and build/test path have been removed from this repository; no system libinput, Mutter, kernel or touchpad driver files are removed. Restore does not resurrect the old scaler.

The installer uses a user-only `95-wsf.conf` to inject WSF immediately before `/usr/bin/gnome-shell`, bypassing our known user-session wrapper which otherwise clears the preload too early. GDM's system service is unchanged. Save work and log out/in manually for first activation; the installer never restarts Shell. On the reference machine WSF was already loaded, so migration did not require interrupting the session.

`wsf status` must report library mapped and runtime reload active. The installer also sets extension global factors and clears per-app overrides on first installation. Subsequent installs retain tuning and refuse changed managed files rather than silently overwriting them. The CLI alone is insufficient for tuning while the extension is active: update its vertical/horizontal global factors too.

`--scroll` includes responsive app settings. `--smooth` remains a backwards-compatible name for just those settings, and no longer enables animation. Native/Flatpak Firefox profiles are discovered via profiles.ini; the installer preserves existing user.js content. ChatGPT gets the disable flag, and previously managed Brave launchers migrate away from our old enable flag. Other applications are not blindly rewritten. Profiles created after this installation require rerunning this optional installer; this is not a background watcher.

## Browser response and testing

Firefox: preserve the existing profile's `user.js` and add `user_pref("general.smoothScroll", false);`. This takes effect after fully quitting and reopening Firefox. Do not overwrite a running profile's `prefs.js`. For ChatGPT, preserve the user desktop launcher and replace only the existing smooth-scrolling flag on its Exec line; fully reopen the application before judging the result. These are toolkit-specific settings, not a system-wide smoothing switch. Existing launcher migration scripts may need reconciliation before rerunning them.

Compare the same slow finger movement, stop while maintaining contact, then separately test lifting fingers. Check a static long browser page and a scrollable file list. Synthetic wheel events do not reliably reproduce this physical input path. Keep distance and trailing animation observations separate.

## Rollback

```bash
python3 scripts/install-smooth-scrolling.py --restore
bash scripts/install-scroll-speed.sh --restore
```

These components are also included in `restore.sh`. Managed originals and installed hashes/content are recorded in `~/.local/state/macbook-zorin/wsf.json` and `responsive-scrolling.json`; local state is not published. Edited managed files cause restoration to stop for manual inspection. WSF restore removes its preload/drop-in, restores saved files/settings, and never restores the removed legacy scaler. Log out/in manually after removing a loaded preload.

After restoring Firefox user.js, also reset/restore `general.smoothScroll` in about:config if Firefox already consumed the setting: removing user.js does not reset a preference persisted in prefs.js. Fully reopen affected apps. Existing pre-migration backups in `~/.local/state/familiarmac` are retained for inspection, not automatically replayed.

## Verification scope

The new installer was run on the existing reference system, followed by a repeat installation. Source checks, ABI checks, pure configuration/legacy protection tests and the repository test suite passed. This is not yet a clean-machine end-to-end test. Firefox's isolated-profile physical result is confirmed; ChatGPT and the normal Firefox profile still require their next-launch physical checks.
