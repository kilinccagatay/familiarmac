# MacBookPro10,1 — machine-specific Plex playback record

November 19, 2026. **FamiliarMac installation and updates do not apply these settings.** This is an optional manual reinstallation record, not a general default. It contains no account data, server addresses or personal playback logs.

## Observations and scope

Tested with the `tv.plex.PlexDesktop` Flatpak on a MacBookPro10,1 running Zorin OS / GNOME 46 in a Wayland session, with Intel HD Graphics 4000 and NVIDIA GT 650M (Nouveau).

The latest NVIDIA run logged renderer `NVE7`; dropped frames rose from 2 to 148 in roughly ten seconds despite a full buffer. With the Intel/X11/synchronization settings below, the user confirmed smooth windowed playback first with corner effects disabled and then enabled. Plex's `OpenGL VENDOR` / `GL_RENDERER` log entries confirmed Intel rendering.

This records the successful combination, not proof that any single option caused the improvement. The corners-enabled comparison used a local experimental Mutter rounding implementation; this document does not install it or guarantee equivalent results on other systems. The final confirmation is user-observed; no independent long-duration frame-delivery/tearing measurement was completed for this final combination. Rendering on Intel does not guarantee hardware decoding for every codec: the test video fell back to software decoding.

## Reapply manually

Fully quit Plex. Verify the Intel GPU PCI address with `lspci -nn`; the address below belongs to this machine. Record existing overrides:

```bash
flatpak override --user --show tv.plex.PlexDesktop
```

Also back up `~/.local/share/flatpak/overrides/tv.plex.PlexDesktop` if it exists. Apply only to Plex:

```bash
flatpak override --user \
  --env=DRI_PRIME=pci-0000_00_02_0 \
  --env=QT_QPA_PLATFORM=xcb \
  --env=vblank_mode=0 \
  tv.plex.PlexDesktop
```

- `DRI_PRIME` selects Intel.
- `QT_QPA_PLATFORM=xcb` runs Plex through X11/XWayland in the Wayland desktop session.
- `vblank_mode=0` disables Mesa's vertical synchronization wait; check tearing and power consumption on your own machine.

Launch Plex from its normal icon. The user override applies to subsequent launches without a custom launcher. This does not change Chrome profiles or overrides, system-wide GPU/power settings, or Plex's `mpv.conf`.

## Verify

```bash
flatpak override --user --show tv.plex.PlexDesktop
flatpak run --command=sh tv.plex.PlexDesktop -c 'printf "DRI_PRIME=%s\nQT_QPA_PLATFORM=%s\nvblank_mode=%s\n" "$DRI_PRIME" "$QT_QPA_PLATFORM" "$vblank_mode"'
```

After launching Plex normally, check the newest `OpenGL VENDOR` / `GL_RENDERER` entries in `~/.var/app/tv.plex.PlexDesktop/data/plex/Logs/Plex.log` for `Intel` and `HD Graphics 4000`. Environment variables alone do not prove the chosen renderer. Compare the same video at the same window size, then fullscreen.

## Roll back

This machine previously had no user Plex override. Fully quit Plex and remove only the added keys:

```bash
flatpak override --user \
  --unset-env=DRI_PRIME \
  --unset-env=QT_QPA_PLATFORM \
  --unset-env=vblank_mode \
  tv.plex.PlexDesktop
```

If these keys had existing values on your machine, restore those values from your backup instead. Do not reset all Flatpak permissions. Relaunch Plex to use the previous startup conditions.

[Türkçe](macbookpro10-1-plex.tr.md) · [Machine-specific records](README.md)
