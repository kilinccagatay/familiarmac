# MacBookPro10,1: transient corruption during boot/logout

This is a hardware-specific, **unverified workaround**, not a default FamiliarMac theme setting.

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
