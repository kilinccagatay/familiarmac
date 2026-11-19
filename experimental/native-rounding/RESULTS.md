# VM experiment — 2026-11-19

**Status: functional prototype, not approved for host deployment or release.**

The distro-patched Mutter 46.2 source built successfully, including Meta GIR and
its typelib. Runtime changes were installed only in `familiarmac-vm`, after an
offline disk snapshot (`before-native-rounding-20261119`). The working computer's
Mutter, Chrome flags and Chrome/Plex Flatpak overrides were not changed.

## What was demonstrated

- X11 and native Wayland animated GTK/GL clients retain four rounded corners.
- The rounding adapter is a `Clutter.Effect`, not a `Clutter.OffscreenEffect`.
  Rounding is applied while sampling the existing client texture; it no longer
  requires a full-window rounding framebuffer.
- Resize, maximize/unmaximize, fullscreen/unfullscreen, and overview entry/exit
  completed for both client types. Fullscreen exit restored the prior geometry.
- A foreground animated window over Files showed the background through its
  rounded corners. No rectangular holes remained after the coordinate fix.
- GNOME Shell retained its PID through the transition tests. No new JS errors,
  shader compilation failures or segfaults appeared in the inspected interval.
- Three geometry tests passed (symmetry/conservative opaque region, exponent-4
  equivalence, disabled rounding). Existing rounding/uniform tests also passed.

The first prototype used journaled vertex positions and cut whole corner boxes.
Cogl's batching transforms those positions. Switching to untransformed client
texture coordinates fixed this; the initial broken implementation was not used
for the measurements below.

## Controlled comparison

QEMU: 2 vCPU, 3 GiB, software graphics, 1280×800. Same compositor binary,
820×500 animated client content, same geometry and shadow state. Five alternating
10-second samples: native, legacy, native, legacy, native, with two seconds of
settling before each. Discard the first native sample as warm-up; **all raw samples
are retained** in `results/`.

| Client | Legacy mean paint interval | Native mean paint interval | Reduction |
| --- | ---: | ---: | ---: |
| X11 | 23.63 ms | 19.03 ms | 19.5% |
| Wayland | 26.41 ms | 20.95 ms | 20.7% |

These are GNOME stage `after-paint` intervals, **not decoded-video FPS** or direct
GPU execution times. They suggest a benefit for this synthetic workload but do
not establish that Plex on Nouveau is fixed. The first X11 native sample was
38.49 ms; omitting this warm-up must not be hidden when interpreting results.

## Remaining validation before production

- Actual Plex playback on the GT 650M/Nouveau host, including dropped video frames.
- Fractional/HiDPI scaling, multiple monitors and transformed buffers.
- Subsurfaces, unusual client formats and transient windows beyond the tested GTK
  clients; optional colored borders are not implemented by the prototype.
- Longer stability testing, native compositor tests and packaging/ABI policy.

This requires a patched compositor, not just a normal extension update. Keep it
isolated from normal FamiliarMac installation until that maintenance and testing
cost is explicitly accepted. VM screenshots and local diagnostic artifacts are
also saved under the workspace's `work/native-rounding/evidence/` directory.
