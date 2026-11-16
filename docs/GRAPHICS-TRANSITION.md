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
