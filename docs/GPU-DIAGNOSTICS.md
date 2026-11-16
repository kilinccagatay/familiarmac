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

## Hardware decode validation: FAILED (16 November, 19:14 CET)

After a user-initiated reboot, `vainfo --display drm --device
/dev/dri/renderD128` successfully initialized Mesa Nouveau NVE7 and advertised
H.264 VLD. That probe alone did not establish working decoding.

A locally generated 5-second H.264 High 8-bit 4:2:0 test pattern (1280x720,
30 fps) was decoded with FFmpeg 6.1.1, explicitly targeting Nouveau VA-API:

```sh
LIBVA_DRIVER_NAME=nouveau ffmpeg -nostdin -hwaccel vaapi \
  -hwaccel_device /dev/dri/renderD128 -hwaccel_output_format vaapi \
  -i sample-720p.mp4 -vf 'hwdownload,format=nv12' -an -f framemd5 gpu.md5
```

The test process exited 139, with `RT_WIDTH_OVERRUN`, `RT_HEIGHT_OVERRUN`,
and `MSVLD PRIV_VIOLATION` followed by a Mesa `libgallium` segfault. The
reported instruction offset `b2b187` matches the earlier Shell crash.
No further hardware stress tests were run.

A CPU-only control decoded the same clip with `-hwaccel none -pix_fmt nv12`:
150 frames completed, exit 0. The Shell PID remained 1897, Wi-Fi and Ethernet
remained connected, and no additional kernel events appeared immediately
after the failed decode. Test executables and dependencies were extracted
from distro packages to `/tmp`; no packages or persistent environment
settings were installed or changed.

This reproduces a driver-path failure in a separate FFmpeg process, without
invoking the custom menus. It does **not** prove that extensions can never
trigger a related failure, or that the precise cause of the idle Shell
crash has been identified. Missing firmware is repaired, but hardware decode
and the overall stability issue are **not fixed**. Do not enable accelerated
video globally based on the successful `vainfo` probe.

## Repeat session failure during application audit (22:48:58 CET)

Kernel 6.17.0-20 and host Mesa 25.2.8 remained installed. Nouveau reported
`WRITE / PTE / GPC0/PROP_0` on **gnome-shell's channel**, disabled that channel,
then Shell exited with SIGSEGV in host libgallium at offset `0xb2b187`.
No logout was requested. No Wi-Fi, boot, kernel or driver configuration was changed.
Mixxx 2.5.6 was starting with Flatpak Mesa 26.2.5, renderer NVE7, at the time.
This timing does not establish Mixxx as the sole cause: at 22:38:31, before
Mixxx, three ffmpeg channels already reported `RT_WIDTH_OVERRUN` during the
Kdenlive startup interval. The exact ffmpeg command lines were not captured.

The matching Ubuntu debuginfo build ID
`198701d4b61dc1afd1949464114e27c1e90498a2` places the final fault inside
`pushbuf_dump` (symbol starts at `0xb2afa0`). This is the command-buffer dump
path after a GPU submission failure, **not proof of the initial GPU fault's
cause**. Do not treat patching the dump or suppressing logging as a GPU repair.
The existing ~/core is an older Xwayland dump, not this Shell crash.

Diagnostic caveat: unrestricted addr2line exhausted memory at 22:53:55 and was
OOM-killed. That was a separate diagnostic error, after the original crash.
Symbol-table-only inspection succeeded under a 512 MiB address-space limit.
Use explicit memory limits for further symbol processing and isolate test
application scopes; Flatpak may move its process outside a launching service.

A per-process software-rendering plus Mixxx `--safe-mode` control reached the
main UI, exited normally (code 0), and produced no new kernel messages during
that short run. This is a short control, not a driver fix or stability guarantee.
[Mixxx documents safe mode](https://manual.mixxx.org/2.5/en/chapters/appendix/commandline_dev_tools)
as a GPU-driver workaround. [Mesa documents LIBGL_ALWAYS_SOFTWARE](https://docs.mesa3d.org/envvars.html)
as forcing software rendering. Neither was set globally.

### Scoped mitigation, not a root-cause repair

A second control kept normal Mixxx features enabled and changed only its Mesa
renderer to llvmpipe using per-process `LIBGL_ALWAYS_SOFTWARE=true` and
`GALLIUM_DRIVER=llvmpipe`. Its log confirmed llvmpipe; the full UI appeared,
normal shutdown completed with code 0, and no new kernel events were recorded
from 22:55 through 22:57. This brief idle/startup test does not validate audio
latency or long sessions. Software rendering costs CPU and may reduce waveform
performance. It does not resolve independent Shell/Nouveau faults.

The opt-in `python3 scripts/mixxx-software-workaround.py` applies only to
Mixxx Flatpak on the observed Nouveau PCI ID 10de:0fd5. It preserves existing
overrides and supports `--restore`, refusing restoration if overrides changed
externally. Repeated apply and restore/reapply were checked locally. It is
not part of the default installer and never changes GRUB, firmware, Wi-Fi,
the selected GPU, or desktop-wide rendering.

The remaining application audit is paused pending graphics stability work.
Do not interpret this mitigation as confirmation that the session crash is fixed.
