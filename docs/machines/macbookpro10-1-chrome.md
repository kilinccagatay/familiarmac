# MacBookPro10,1 — local Chrome playback configuration

Recorded 19 November 2026. **Opt-in, machine-specific documentation only.** FamiliarMac's installer and updater do not change Chrome to these settings. This is also the owner's recovery record; it is not a universal performance fix.

## Machine and observations

- MacBookPro10,1, Intel HD 4000 plus NVIDIA GeForce GT 650M (Nouveau).
- Zorin OS / GNOME 46, Chrome Flatpak `com.google.Chrome`, tested Chrome 158.0.8127.36; X11 browser window within a Wayland desktop.
- YouTube dropped many frames despite a healthy network buffer. Intel selection alone did not resolve it. Software compositing worked on small local fixtures but remained slow on the full YouTube page.
- In temporary-profile traces, Intel ANGLE OpenGL with `vblank_mode=0` substantially reduced EGL swap wait times. Adding `--disable-gpu-vsync` improved the subsequent playback test. These were sequential experiments, not a controlled cross-device benchmark.
- The owner reported smooth playback in that separate profile. The old profile, including its incognito window, still stuttered with the same graphics options. **The remaining old-profile cause was not established.** Do not conclude that an extension or a specific preference was responsible.
- The working profile was moved out of cache into persistent configuration storage and selected as the default. The owner then signed into Chrome Sync and reported that their data returned. Sync does not carry the Flatpak environment settings below.
- Independent sustained 1080p/fullscreen and tearing measurements after the final profile move were not completed. Multiple simultaneous test players raised CPU temperature to 98°C, so that comparison was not treated as reliable.

## Recorded final configuration

The existing FamiliarMac launcher and its `--ozone-platform=x11` argument are retained. No global GPU, power or fan settings are changed.

Only this Flatpak application receives:

```text
DRI_PRIME=pci-0000_00_02_0
vblank_mode=0
```

`~/.var/app/com.google.Chrome/config/chrome-flags.conf` contains the following, with the actual absolute home-directory path in place of `/home/YOUR_USER` (do not expect shell expansion inside the flags file):

```text
--use-gl=angle
--use-angle=gl
--disable-gpu-vsync
--user-data-dir=/home/YOUR_USER/.var/app/com.google.Chrome/config/google-chrome-smooth
```

The old `.../config/google-chrome` profile is retained separately. No passwords, cookies, history, Sync secrets or profile files are published here. `--disable-frame-rate-limit` is deliberately absent: it reduced the dropped-frame counter while producing poor actual presentation cadence. Autoplay and tracing flags used during diagnosis are not part of the final configuration.

## Optional manual reproduction

1. Confirm the GPU PCI address on your own machine; `pci-0000_00_02_0` identifies the Intel device on this particular laptop. Do not apply it blindly to another computer.
2. Fully exit Chrome. Back up your existing `chrome-flags.conf` if present and record `flatpak override --user --show com.google.Chrome`. Preserve all other existing options and permissions.
3. For a fresh, separate profile, choose the `google-chrome-smooth` directory above. Chrome will create it on launch. For an already validated test profile, move that profile there only after its Chrome process has fully exited. Never overwrite an existing destination or move a running profile. A fresh profile is not guaranteed to reproduce the owner's result.
4. Add the four recorded lines to the flags file, using your absolute path and reconciling any existing conflicting options rather than adding duplicates.
5. Set only the two application-specific environment values:

```bash
flatpak override --user --env=DRI_PRIME=pci-0000_00_02_0 --env=vblank_mode=0 com.google.Chrome
```

Launch Chrome normally. Check `chrome://version`: Profile Path should end in `google-chrome-smooth/Default`, and Command Line should contain the recorded graphics options. Test one player at a time at the same resolution and codec, both windowed and fullscreen. Check visible smoothness and tearing as well as dropped frames. Disabling synchronization can affect presentation and power usage; retain this setup only if it benefits your machine.

## Revert without deleting profiles

Fully exit Chrome first. Remove only the added `--user-data-dir=...google-chrome-smooth` line to return to the retained original profile while keeping the graphics options. The separate profile remains on disk.

To also undo the graphics experiment, restore the prior values of the three graphics flags and the two environment variables. On the recorded machine neither environment variable existed beforehand, so removal is:

```bash
flatpak override --user --unset-env=DRI_PRIME --unset-env=vblank_mode com.google.Chrome
```

Do not reset all Flatpak permissions: the existing FamiliarMac integration permissions must remain. If you had previous values or made subsequent changes, restore those deliberately instead. A documentation record is not a backup of browser data; maintain your own profile backups.
