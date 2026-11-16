# Nouveau session crash investigation

## Evidence (16 November 2026)

On a MacBookPro10,1, GK107M / GT 650M (`10de:0fd5`), kernel
6.17.0-20, Mesa 25.2.8 and GNOME 46:

- At 18:54:42 CET Nouveau reported `SCHED_ERROR 0a [CTXSW_TIMEOUT]`,
  disabled the GNOME Shell GPU channel, and Mesa `libgallium` segfaulted.
  The Wayland session then ended. No logout command was issued.
- Earlier Xwayland channels produced `RT_WIDTH_OVERRUN` and
  `RT_HEIGHT_OVERRUN` traps. These predate the latest Spotlight change.
- The kernel repeatedly failed to load `nouveau/nve7_fuc084` / `084d`:
  `msvld: unable to load firmware data`, `init failed, -19`.
- The user reported being idle at the crash. There is no captured backtrace
  or action trace proving which extension or application triggered it.

**Do not claim the root cause is proven or the crash is fixed.** The missing
video firmware is a confirmed defect; whether it explains this particular
Shell timeout still needs verification. A matching timeout string alone
is not sufficient. Custom effects can exercise driver paths without being
the underlying driver defect.

## Targeted video firmware repair

Nouveau's [official video acceleration instructions](https://nouveau.freedesktop.org/VideoAcceleration.html)
require firmware extracted from the NVIDIA package for this generation.
An [upstream developer discussion](https://mail-archive.com/nouveau%40lists.freedesktop.org/msg54610.html)
describes failed Kepler video-engine initialization followed by timeouts
on later attempts. This is relevant evidence, not proof of our trigger.

Prepare in an empty working directory as a normal user:

```sh
curl -fLO https://us.download.nvidia.com/XFree86/Linux-x86/325.15/NVIDIA-Linux-x86-325.15.run
curl -fL https://raw.githubusercontent.com/envytools/firmware/a0b9f9be0efad90cc84b8b2eaf587c3d7d350ea9/extract_firmware.py -o extract_firmware.py
printf '%s\n' \
 '3d790e4bfed24641f7cc76879144ab5d52b12271012ba381b0d33aa1a2e08775  NVIDIA-Linux-x86-325.15.run' \
 'b684b37b69a78f58fb3a6cf73684698a65927e701adedbae736ddbb0d1768ea7  extract_firmware.py' | sha256sum -c -
sh NVIDIA-Linux-x86-325.15.run --extract-only
python3 extract_firmware.py
```

From the FamiliarMac checkout, pass that directory:

```sh
python3 scripts/install-nve7-video-firmware.py /path/to/extracted-directory --check
pkexec python3 scripts/install-nve7-video-firmware.py /path/to/extracted-directory
```

The installer checks the GPU/driver and all output hashes before writing.
It installs only ten video firmware files, refuses conflicting existing
files, and records new files in `/var/lib/familiarmac/nve7-video-firmware.json`.
It does not install NVIDIA's proprietary kernel driver, replace Mesa,
reload modules, edit GRUB/initramfs, or change networking. This is an
explicit hardware-specific repair, not part of the default installer.
No firmware binaries are redistributed in this repository.

The already-initialized video engine may require a later user-initiated
restart to retry cleanly. Do not unload the active display driver.
Afterwards, compare kernel logs during ordinary video use and desktop use.
Successful file installation does not demonstrate that decoding or crash
recovery works.

To roll back, remove only files recorded by that manifest whose SHA-256
still matches the recorded value. Preserve files replaced by later packages.
No boot regeneration is required for these runtime-only additions.

## Further isolation if the crash recurs

Retain kernel and Shell logs around the event, extension state, Mesa version
and the operation performed. Change one variable at a time. Optional
window deformation effects can be isolated before considering broader
rendering changes. Avoid speculative kernel flags, firmware mode switches,
GPU switching, full software rendering or unreviewed third-party driver
patch bundles: none has been demonstrated necessary by this incident.
