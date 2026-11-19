# Plex on the working MacBook — 2026-11-19

Chronological investigation record: the early sections describe the unpatched
host; the later section records the separately authorized native-path trial.
These measurements are historical experiments, not the current recommended Plex
configuration. See [the final Intel/X11 profile](../../docs/machines/macbookpro10-1-plex.md).

This is a controlled test of the **existing compositor**, not a measurement of
our patched Mutter. The native prototype API is absent in the running host.
No compositor, Chrome or persistent Plex configuration was changed.

Plex resumed The Big Bang Theory S9E17, The Celebration Experimentation, near
11:34. Intel HD 4000/X11 was selected through process-only environment variables
(`DRI_PRIME=pci-0000_00_02_0`, `QT_QPA_PLATFORM=xcb`, `vblank_mode=0`). Plex's log
confirmed the Intel renderer. The stream was 1920×1080, HEVC 10-bit, 23.98 fps,
software decoded. Playback was paused after testing, before the next episode.

Each measured phase ran for 20 seconds after a 3-second settling period. No
window-size or rounding change was made during the measured interval. The
original geometry/maximization and rounding enabled states were restored.

| Window frame size (compositor coordinates) | Rounding on | Rounding disabled | Rounding restored |
| --- | ---: | ---: | ---: |
| 1100×700 | 16.70 ms | 16.80 ms | 16.70 ms |
| 2400×1400 | 29.74 ms | 16.73 ms | 29.71 ms |

Numbers are mean GNOME `after-paint` intervals, **not decoded-video FPS**.
Fullscreen averaged 41.71 ms, consistent with this 23.98 fps video's cadence;
that larger number alone does not mean worse playback. Windowed rendering can
repaint at a different cadence from the video.

For the large-window phases the rounding effect was confirmed attached to Plex,
with enabled states true / false / true. The repeatable large-window difference
isolates a substantial cost in the current rounding path. It does not prove that
the proposed native replacement removes all of that cost on this GPU.

Plex's reported drop counter reached 2 during initial startup and remained at 2
through the test, including the last logged playback time 1039.34/1138.85 seconds.
Thus this run did not reproduce the earlier rapidly increasing decoder/player
drop count. It still reproduced the size-dependent compositor cost. ChatGPT was
minimized during these tests; performance with multiple visible background
windows was not measured in this run.

The native Mutter test requires loading a different compositor at a new session.
It has not been installed on the host pending the user's choice about restarting
the session. Hardware conclusions must be revisited after that separate test.

Sanitized summaries are in `results/host/`; no Plex server tokens or media URLs
are included.

## Candidate preflight

The first VM build automatically enabled libdisplay-info, absent from the host.
That candidate was rejected before installation. Rebuilding with
`-Dlibdisplay_info=disabled` removed the extra requirement. The revised candidate
passed `ldd -r` against the host's existing companion libraries and a separate GJS
process successfully resolved the native API. These are loader/ABI checks, not a
live-session or Plex performance test. The running compositor remains untouched.

## Native path tested after user-authorized session refresh

The user explicitly authorized session renewal. The patched libmutter and Meta
 typelib were installed atomically with originals in
`/var/lib/familiarmac-native-rounding/20261119`. The extension was backed up in
`~/.local/state/macbook-zorin/native-rounding-host-test-20261119/extension-backup`.
After login, live inspection confirmed `FamiliarMacNativeCorners`, enabled and
not a `Clutter.OffscreenEffect`, on Plex and ChatGPT. The running native API exists.

Plex used the same temporary Intel/X11/vblank environment and the same episode,
seeked back to approximately 11:33. At 2400×1400, a same-session alternating
comparison switched only Plex between native and legacy rounding, keeping the
other rendering conditions unchanged. Each phase settled for 3 seconds then
measured for 15 seconds. Background windows were restored after testing.

| Background condition | Native mean paint interval | Legacy mean paint interval | Reduction |
| --- | ---: | ---: | ---: |
| ChatGPT minimized (3 native, 2 legacy samples) | 24.16 ms | 30.10 ms | 19.7% |
| ChatGPT visible behind Plex (2 native, 1 legacy sample) | 58.57 ms | 65.69 ms | 10.8% |

The background-visible legacy trial used legacy rounding on **Plex only**;
ChatGPT retained native rounding in both modes. This is not a complete comparison
against the previous unpatched compositor. Raw summaries are `ab-results.json`
and `visible-results.json` in `results/host/`.

An initial native/disabled/native/fullscreen test with ChatGPT visible gave
58.30 / 36.02 / 58.91 / 41.71 ms. These intervals remain compositor repaint
measurements, not video presentation FPS. Plex's own drop counter reached 6 near
startup/seeking, then 8 across later transitions; it cannot independently certify
smooth frame presentation. GNOME Shell retained PID 272156 across the tests and
no matching JS/shader/segfault errors appeared in the inspected journal interval.

**Conclusion:** the native method improves the measured cost while preserving
rounding, but does not fully solve the multi-window stutter. It remains a local
experiment, not a release-ready fix. Next investigation should isolate background
occlusion/compositing cost; no unverified culling change was applied during this
session. Native rounding was restored after every comparison, geometry restored,
and playback paused before the episode ended. Chrome settings were preserved.
