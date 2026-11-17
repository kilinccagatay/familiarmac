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

## Installation boundary

WSF and the extension are presently a manual experiment, not vendored or installed by FamiliarMac. Follow their upstream build/install instructions, inspect licenses, and use the versions above to reproduce this test. `install.sh --scroll` still installs the legacy fixed 50% preload. `--smooth` enables Chromium animation. Do not run those legacy options over this setup.

Disable the legacy `90-macbook-scroll.conf` user Shell drop-in before activating WSF, retaining a backup. Keep only one scroll preload. The reference system's `/usr/local/libexec/macbook-gdm-shell` wrapper caused WSF to remove itself from the environment before reaching GNOME Shell. A user-only `95-wsf.conf` drop-in under `~/.config/systemd/user/org.gnome.Shell@wayland.service.d/` bypassed that wrapper:

```ini
[Service]
ExecStart=
ExecStart=/usr/bin/env LD_PRELOAD=/ABSOLUTE/HOME/.local/lib/wayland-scroll-factor/libwsf_preload.so /usr/bin/gnome-shell
```

Replace `/ABSOLUTE/HOME` with the real home path. This is specific to the inspected user service: inspect existing ExecStart and other preload requirements before adapting it. Do not change the system/GDM service. Reload user units and log out/in normally after saving work; never restart Shell underneath an active Wayland session.

Verify `wsf status`: enabled, library mapped, runtime reload active. Configure both `global-factor` and `h-global-factor` in schema `org.gnome.shell.extensions.touchpad-speed-control` to 0.25, then `wsf set --scroll-vertical 0.25 --scroll-horizontal 0.25`. Keep `app-factors` and `h-app-factors` empty unless intentionally tuning an app; the extension can overwrite CLI-only changes when focus changes.

## Browser response and testing

Firefox: preserve the existing profile's `user.js` and add `user_pref("general.smoothScroll", false);`. This takes effect after fully quitting and reopening Firefox. Do not overwrite a running profile's `prefs.js`. For ChatGPT, preserve the user desktop launcher and replace only the existing smooth-scrolling flag on its Exec line; fully reopen the application before judging the result. These are toolkit-specific settings, not a system-wide smoothing switch. Existing launcher migration scripts may need reconciliation before rerunning them.

Compare the same slow finger movement, stop while maintaining contact, then separately test lifting fingers. Check a static long browser page and a scrollable file list. Synthetic wheel events do not reliably reproduce this physical input path. Keep distance and trailing animation observations separate.

## Rollback

Reference backups are in `~/.local/state/familiarmac/scroll-migration-20261117` and `~/.local/state/familiarmac/scroll-response-20261117`; these local files are not published. Inspect differences before restoring, preserving later edits.

To undo WSF, use `wsf disable`, disable Touchpad Speed Control, remove only its user `95-wsf.conf`, restore the previously backed-up legacy drop-in if wanted, reload user units and log out/in. Do not restore both preload layers. To undo the browser experiment, restore the backed-up launcher/user.js and remove or restore `general.smoothScroll` in Firefox about:config as well: removing user.js alone does not reset a preference already saved to prefs.js. Fully reopen each affected app. FamiliarMac's general restore script does not yet manage this manual experiment.
