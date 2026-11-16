# MacBookPro10,1: transient corruption during boot/logout

These are hardware-specific diagnostic changes, not default FamiliarMac theme settings.

## Current result and next test

On 2026-11-16 the `fbcon=nodefer` test was confirmed active after reboot: the framebuffer console was bound, but the user still saw corruption between two appearances of the Apple boot splash. **That workaround did not solve the reported boot artifact.** It must not be described as a fix.

The current initramfs was then inspected: it did not contain `nouveau` or `apple-gmux`. The boot journal showed SimpleDRM first and Nouveau taking over roughly four seconds later. The next controlled test is to load the existing Nouveau driver before Plymouth displays its first logo:

```sh
bash scripts/install-early-kms.sh --check
sudo bash scripts/install-early-kms.sh --install
```

This installer first removes the failed `fbcon=nodefer` drop-in, backs up the current kernel's initramfs, and adds an initramfs hook using the distribution's `force_load` function for `apple_gmux` followed by `nouveau`. Local initramfs-tools `/init` loads these modules before `init-premount/plymouth`. It verifies that both module files are included in the rebuilt image and restores the previous image if generation/verification fails. No live driver reload, GPU mux change or automatic restart is performed.

After reboot, verify module timing and compare the splash visually. This targets the **boot** renderer handoff; it is not evidence that logout corruption is fixed. Test logout separately. Reference: [Nouveau KMS handover](https://nouveau.freedesktop.org/KernelModeSetting.html).

Undo early loading with `sudo bash scripts/install-early-kms.sh --restore` and reboot. The untouched older kernel remains available in GRUB. The hook also applies to subsequently rebuilt kernels; after removing it, regenerate any other affected images with `sudo update-initramfs -u -k all`.

## Previous test (retained for the diagnostic record)

## Observed evidence

On the affected MacBookPro10,1 with Intel HD4000 and NVIDIA GT650M, Linux 7.0.0-43:

- Both GDM and the user Wayland session selected Nouveau's NVIDIA device because it owns the internal panel. These logs do not demonstrate a GPU switch.
- The kernel registered `nouveaudrmfb`, but twice reported `fbcon: Deferring console take-over`.
- Only the dummy console was bound in `/sys/class/vtconsole`; framebuffer console takeover had not completed.
- Corruption is transient during boot and logout; the graphical login subsequently appears.

This makes deferred framebuffer handoff a testable hypothesis, not proof of the cause. Missing Nouveau video-decoding firmware is also logged, but it is not evidence that decoding firmware causes the transition artifact.

## Controlled workaround

The kernel documents `fbcon=nodefer` as attaching the framebuffer console immediately rather than preserving firmware/bootloader content until text is printed:
https://docs.kernel.org/fb/fbcon.html

Inspect applicability:

```sh
bash scripts/install-framebuffer-handoff.sh --check
```

Install only on the affected machine:

```sh
sudo bash scripts/install-framebuffer-handoff.sh --install
```

It creates one managed GRUB drop-in, saves pre-change boot configuration under `/var/lib/macbook-zorin/framebuffer-handoff`, and regenerates GRUB. It does not change GPU selection, Nouveau acceleration, input settings, GDM session type, or restart the computer. Failed configuration generation removes the new drop-in and regenerates the original configuration.

## Verify before calling it fixed

After saving work, reboot at a convenient time. Confirm `fbcon=nodefer` in `/proc/cmdline`, then run:

```sh
bash scripts/diagnose-graphics-transition.sh
```

Look for actual framebuffer console takeover rather than only the dummy console. Compare both the boot-to-login transition and a subsequent logout. A clean journal alone cannot prove that the visual artifact is gone.

If corruption remains, revert this change before trying a different driver/kernel/display-manager hypothesis. No `nomodeset`, experimental atomic modesetting, live mux switching or forced GPU shutdown is included.

## Undo

```sh
sudo bash scripts/install-framebuffer-handoff.sh --restore
```

Reboot when convenient. If needed from recovery, remove `/etc/default/grub.d/98-familiarmac-framebuffer.cfg` and run `update-grub`; the backed-up GRUB file is for reference, not a replacement for newer boot entries. For a single boot, remove `fbcon=nodefer` from the kernel line in GRUB's editor.

## Verified outcome — 2026-11-16

The user rebooted after `install-early-kms.sh` and reported that both boot and logout corruption are resolved. Current kernel command line no longer contains `fbcon=nodefer`. The early Nouveau hook is the successful configuration on this machine; the earlier framebuffer experiment above was ineffective. This is user-observed hardware validation, not a guarantee for other Mac models.

## Withdrawn experiment: logo before Plymouth

**Do not install this experiment.** On 2026-11-16 the user reported that the logo appeared late and display corruption returned after enabling the GRUB redraw. Installation is now disabled. Remove it with `sudo bash scripts/install-early-logo.sh --restore`; keep the successful early Nouveau hook. The historical description below is retained for diagnosis.

The former `sudo bash scripts/install-early-logo.sh --install` command added a static, centred logo on black to GRUB's graphical background. It uses the repository's existing vector logo and does not add a delay or progress indicator. It retains the current video mode, timeout, kernel parameters and early Nouveau hook. A generated-config backup and transaction rollback protect installation; `sudo bash scripts/install-early-logo.sh --restore` removes the override and regenerates GRUB with the previous distribution theme.

This can cover the GRUB portion of the black screen, not the firmware interval before GRUB executes. A seamless transition cannot be guaranteed until observed on hardware. The existing Plymouth logo/progress starts after the native driver is ready; no late-driver workaround is reintroduced.

Reference: [GNU GRUB background configuration](https://www.gnu.org/software/grub/manual/grub/html_node/Simple-configuration.html). No Apple firmware modification or bootloader reinstall is involved.

## Reduce pre-logo loading without another display handoff

On this MacBookPro10,1 (NVIDIA PCI `10de:0fd5`, GK107M/Kepler), the
191,269,179-byte initramfs contained about 100 MiB of GA102/TU102 GSP firmware.
These are for newer GPUs, not this machine. The stock builder places already
compressed firmware in an uncompressed CPIO segment, so simply increasing the
outer compression level does not address the bulk of this image.

Optional, hardware-guarded optimization:

```sh
sudo bash scripts/install-lean-initramfs.sh --install
# Undo (rebuilds the current kernel image with the full firmware set):
sudo bash scripts/install-lean-initramfs.sh --restore
```

The build hook removes only `nvidia/{ga102,tu102}/gsp/gsp-*.bin*` from the temporary
initramfs tree. All installed `/usr/lib/firmware` files remain available. It
requires the working early-KMS hook and skips trimming on a different Mac model
or with any NVIDIA PCI device other than `0fd5`. It leaves module selection,
early Nouveau ordering, Plymouth, GRUB and framebuffer settings unchanged.
The current image is backed up under `/var/lib/macbook-zorin/lean-initramfs`;
build/validation failure restores it. This optional fixed-hardware profile is
not enabled by the generic installer.

Installed image decreased from 191,269,179 bytes (183 MiB rounded) to approximately 83 MiB, about 55% smaller. Build validation confirmed Nouveau/gmux modules remain and modern GSP binaries are absent. Hardware-guard tests cover an additional NVIDIA GPU and the built-in HDMI audio device.

Smaller bootloader reads are expected; **time to first logo and clean transitions
must still be confirmed by a physical reboot**. Firmware time before GRUB is not
measured by this system's `systemd-analyze` output and is not fixed by this change.

Source: [NVIDIA's GSP firmware documentation for Nouveau](https://github.com/NVIDIA/open-gpu-kernel-modules/blob/main/nouveau/extract-firmware-nouveau.txt)
(Turing and later). Build behavior was checked against the installed
`/usr/sbin/mkinitramfs` and `initramfs.conf(5)`.

## Follow-up: brief pre-logo corruption persists

After the smaller initramfs was installed, the user still observed a late logo
and a very brief corrupted frame immediately before the first logo. The size
reduction is verified; an improvement to the visible boot delay is **not**.
Current boot: Nouveau framebuffer ready at 1.9595 seconds kernel time,
kernel 2.641 seconds, userspace 16.477 seconds. No GRUB logo override remains.
Do not describe early KMS as a complete fix based on the earlier observation.

Enable temporary timestamped Plymouth diagnostics:

```sh
sudo bash scripts/install-boot-trace.sh --install
# After one manual reboot:
sudo less /var/log/plymouth-debug.log
sudo bash scripts/install-boot-trace.sh --restore
```

This adds only `plymouth.debug` to the boot command line; no device timeout,
splash delay, renderer, GPU selection or console mode override. Debug logging
can affect timing, so remove it after collecting evidence. It cannot measure
firmware time before Linux. Keep logs local: they can contain device details
and boot messages. Compare renderer creation/activation and first splash
against the kernel framebuffer timestamps before choosing another workaround.
