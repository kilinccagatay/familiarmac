# Native rounding experiment — GNOME 46

VM-only prototype; **not part of installation or releases**. Do not install the
patched compositor on the working computer. A VM disk snapshot precedes testing.

The existing GLSL actor effect renders a window into an intermediate framebuffer
before rounding. This experiment adds opt-in rounded coverage to Mutter's existing
client-texture sampling pipeline. Opaque interior rectangles retain the normal
unblended path; only the edge region uses blending. The opaque/culling region is
conservatively reduced so that windows behind transparent corners remain visible.

- `patch-mutter.py SOURCE_TREE` patches a disposable GNOME 46 source tree.
- `native-effect.js` is the experimental adapter for the existing rounding
  extension. Copy its previous effect module as `rounded_corners_effect_legacy.js`.
  The adapter falls back when the native API is absent.
- `animation-test.c` supplies a reproducible animated OpenGL client without
  network, decoder, authentication or media differences.

This prototype does not support the extension's optional colored borders. Tests
use the existing borderless configuration. Fullscreen removes rounding; detaching
an effect clears native state. Scaling, nested/transient surfaces, X11 server
frames, Wayland clients, overview clones and background occlusion need visual
validation before any deployment decision.

Reference: GNOME Mutter's `meta-shaped-texture.c` and public/private headers on
[the GNOME 46 branch](https://github.com/GNOME/mutter/tree/gnome-46/src/compositor).
Mutter remains GPL-2.0-or-later. This experiment is a patch to the distro's source,
not a replacement downloaded from an unrelated compositor fork. The existing
extension's upstream attribution remains in `vendor/rounded-window-corners-LICENSE`.

VM software-rendering results cannot establish performance on the host's Nouveau
GT 650M. No host driver, GPU clock, Chrome flag or desktop setting is changed by
this experiment.

## Reproduce in the disposable VM

1. Snapshot its powered-off disk. Install distro Mutter build dependencies and
   fetch the distro's GNOME 46 source with its downstream patches.
2. Save unmodified `src/compositor/meta-shaped-texture.c` and
   `src/meta/meta-shaped-texture.h`, then apply `patch-mutter.py` once.
3. Build with `meson setup build --prefix=/usr --buildtype=release -Dtests=false -Dlibdisplay_info=disabled`
   and `ninja -C build -j2`. Stage with
   `DESTDIR=$HOME/native-rounding/stage meson install -C build --no-rebuild`.
4. In **familiarmac-vm only**, run `install-vm-runtime.py` as root. It retains the
   original runtime and replaces libraries atomically. Back up the rounding
   extension before installing the adapter. Restart the VM session.
5. Compile the controlled animation client using
   `gcc -O2 animation-test.c -o animation-test $(pkg-config --cflags --libs gtk+-3.0 epoxy) -lm`.
6. Run `python3 test-geometry.py`. Compare native and legacy rounding with identical
   window geometry, no shadows, and the same patched compositor binary.

The vertex snippet uses **client texture coordinates**, not `cogl_position_in`:
Cogl may transform journaled rectangle vertices when batching, so actor-local
positions cannot be inferred from that attribute. The opaque interior cross must
remain conservative; otherwise transparent corners can expose missing background.

See [RESULTS.md](RESULTS.md) for the completed VM checks, raw measurements and
remaining hardware/compatibility validation. The prototype is not a Plex fix
verified on the working machine.

The real-machine baseline is recorded separately in [HOST-RESULTS.md](HOST-RESULTS.md).
Use build options matching the destination distro: an automatically enabled
optional dependency in the VM must not silently become a host requirement.
