# Magic Mouse review — 19 November 2026

Reviewed FamiliarMac `b0a193b339db031cefed750892f1e9fd81c55c66` plus the pending middle-button installer fix, and the independent library at `889b3e1c1a9c080b5edf05de7c91842a9bdeb2aa`. The library's Python source matches the vendored snapshot. Scope: HID decoding, recognition, evdev/uinput ownership, service transport, Shell actions and installation. No live settings or production code were changed for this review.

## Findings

### 1. [P1] Blocking logind calls remain in the exclusive pointer forwarding loop

Location: `native/mouse-shortcuts/daemon.py:88–94,265`.

Every second `run()` calls `active_user()` synchronously, before reading or forwarding pointer events. That function performs up to three D-Bus calls with a one-second timeout each. When logind is slow, the exclusively grabbed mouse cannot deliver movement or button releases until these calls return. Neither the heartbeat check nor cleanup can run during the wait. The recent device-enumeration fix does not remove this independent blocking path.

This is a source-confirmed latency risk, not a claim that logind caused the earlier observed stalls. Use asynchronously maintained seat/session state, invalidate it safely on disconnect/lock, and keep bounded pointer forwarding independent of control-plane latency. Test delayed replies and logind loss while the mouse is held, including release delivery and fail-safe ungrab.

### 2. [P2] Streamed workspace gestures bypass the native modal/action-mode guard

Location: `extensions/macbook-menu@local/magicMouseActions.js:79–90` and `missionControlInput.js:27–28`.

The datagram path invokes `_switchWorkspaceBegin()` directly. It checks lock/overview state but not `Main.actionMode` or an active system modal. Consequently a swipe can begin behind a logout or authentication dialog; ongoing swipes also lack this modal interruption guard. The discrete accelerator path is limited to NORMAL/OVERVIEW, so it does not have the same policy as streaming.

Reproduction with the existing action-test harness: set `Main.modalCount=1`, use a system-modal action mode, and send a valid `begin` packet. `swipeState` is created. The installed GNOME 46 `swipeTracker.js` explicitly checks allowed action modes; its native workspace tracker allows NORMAL. Direct invocation skips that guard. Apply matching mode checks before beginning and during updates, with safe cancellation when the mode changes. Test both normal workspace swipes and Mission Control swipes so the latter remain supported.

### 3. [P2] Enabling Magic Mouse swipes can leave its old pointer grab in place

Location: `native/mouse-shortcuts/daemon.py:105–110,183–193`.

If the conventional mouse shortcut already owns a Magic Mouse endpoint (for example its middle-button capability before the driver setting was changed), enabling page/workspace swipes changes `options` but not `choice`. `receive()` releases only `magic_pointers`; the existing bridge in `devices` survives. `scan_magic()` then opens the same physical endpoint and attempts a second exclusive grab. That fails with EBUSY and keeps retrying while the old bridge remains, leaving the newly enabled gestures inactive.

A synthetic control-packet test confirmed the old bridge remains after enabling page swipes with an unchanged mouse choice. Reconcile ownership when the handling mode changes; release only the affected Magic Mouse endpoint, preserving ordinary mice. Cover transitions in both directions, button-down deferral and failure recovery.

### 4. [P2] Long swipes reverse direction at a displacement of 2048 sensor units

Location: standalone/vendored `magic_mouse_support/gestures.py:95–100,120–121`, using `protocol.py:21–22`.

`delta()` returns the shortest modular difference, but it is applied between the current contact and the original contact position for the entire gesture. A monotonic movement greater than 2047 units therefore becomes negative. This distance fits the original mouse's horizontal sensor range. The same arithmetic affects workspace displacement and pinch distance calculations.

Reproduction: feed a single contact at x = -1100, -700, -200, 300, 800, 1000 at 50 ms intervals, then lift. Emitted dx values are `[400, 900, 1400, 1900, -1996, -1996]`; with page swipes enabled the final action is `forward`, although the positive direction should produce `back`. Accumulate incremental per-contact movement if wrap handling is required, rather than taking a modular difference from the start. Test long monotonic movement, actual wrap boundaries, reversal and both finger counts.

## Verification and limits

- All 17 standalone library unit tests passed.
- Existing mouse-shortcut, action-routing and JavaScript action/continuous-swipe tests passed.
- Additional isolated reproductions verified findings 2–4 without physical input injection or changing the running service.
- Reviewed installed GNOME 46 workspace-animation and swipe-tracker sources to check assumptions. A mock initially suggested an overview-interruption leak; native GNOME explicitly cleans that transition on `showing`, so that was excluded from findings.
- The existing suite lacks these modal, ownership-transition and long-displacement scenarios. It also does not exercise slow logind while forwarding actual pointer events.
- Lightning and USB-C models still have synthetic parser coverage only. This review does not upgrade their hardware-validation status or identify a proven cause for historical session crashes.
- The already confirmed Cancel-click correction is pending separately: disabling kernel middle-button emulation restores native left/right classification. It is not presented as a newly discovered issue here.

Recommended repair order: keep blocking control work out of pointer forwarding; enforce gesture action-mode guards; make device ownership transitions explicit; correct displacement accumulation in the independent library and update the vendored snapshot. Add regression tests before applying fixes to the running desktop.

## Local fixes and verification — unreleased

All four findings now have local fixes and regression coverage:

- `seat_state.py` queries logind on a dedicated worker. The input loop reads an expiring snapshot; delayed replies are aged from query start and cannot extend stale authorization. Expiry/failure releases interception through the existing service path. Shutdown does not wait for blocked D-Bus work.
- Streaming begins and frame updates enforce NORMAL/OVERVIEW action modes. A modal interrupts an ongoing switch, and edge feedback is restored as well.
- Magic Mouse ownership is reconciled before HID setup. Held clicks finish through the original bridge; other mice retain their bridges. The new HID reader is deferred while the old bridge still owns its endpoint.
- The independent library and vendored source accumulate incremental per-contact movement, preserving direction through long swipes, reversal and coordinate wrap. Pinch distances use the resulting continuous positions.

The full FamiliarMac `tests/run.sh` suite passed, including package-content validation for the new helper. The standalone library passed 19 tests. New tests cover slow/failed/expired seat queries, late replies after shutdown, ownership changes in both directions, held-click deferral, modal interruption and long movement.

Installed locally with backups on 19 November 2026; the service is active with no HID errors. The Shell guard was loaded into the existing session without logout. A live Shell check recorded modal mode 64 rejecting a begin packet without creating a transition, and normal mode 1 allowing gestures again after dismissal. Mouse setting values matched before/after installation. The user confirmed all four local fixes working on 19 November 2026. The accepted changes are being committed and pushed without a release or version bump; version remains 1.2.2. A subsequently reported workspace-edge rendering issue is tracked separately.
