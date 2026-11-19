# Open follow-ups

## Reported on 19 November 2026

- [x] **Type to log in:** On the physical computer, typing at the user-selection screen still does not reliably open the password field and preserve the first characters. A stock-GDM VM test passed, but the user confirmed the installed login layout still fails. Reproduce with the installed greeter layout and account focus; preserve printable symbols, Unicode and native password handling. Do not mark complete based on unit tests alone.
  - Neutral-focus change alone failed the physical test. Found that GDM `AuthPrompt.hide()` switches back to its plain username entry via `setUser(null)`; the previous handler then discarded type-ahead. Prepare the secret entry before account activation and reveal the prompt immediately. The regression reproduces failure in the previously installed code and passes with the new change. Further failure traced to GI returning `gunichar` as a string: numeric comparisons filtered digits/space and mishandled controls. Use `GLib.unichar_isprint`; native GJS regression fails on the installed version and passes on the new code. Physical startup-screen test confirmed fixed by the user on 19 November 2026; working lock-screen behavior remains unchanged.
- [x] **Magic Mouse disconnect during a swipe:** Switching the mouse off partway between desktops still leaves the transition stuck on the physical computer. The attempted reader-removal cancellation did not resolve the reported scenario. Trace Bluetooth disconnect, heartbeat and Shell cancellation together, and verify with the physical power switch before closing.
  - Local candidate: expire the swipe after one second without real touch reports, even while hidraw remains discoverable and transport heartbeats continue; reset the stale recognizer. Regression tests cover live heartbeats with stale input, fresh touches and reader removal. Physical power-switch test confirmed fixed by the user on 19 November 2026.

Desktop edge-bounce and menu-bar transitions were tested locally and confirmed working by the user on 19 November 2026. Wallpaper backing prevents unpainted edge strips; native transitions include the menu bar.

## Update flow follow-up — 19 November 2026

- [x] **Wait for the package manager:** When apt/dpkg is busy, wait instead of immediately failing the update, and show a clear waiting state in Settings. Continue automatically when the lock is released. Preserve working settings; never remove lock files or terminate another package operation as part of the updater. Implement and test in the VM through Settings (not a terminal install), covering both a busy package manager and successful completion after it becomes available. Do not change the host computer’s working settings.
  - Requested scope: “tamam paket yoneticisi mesgulken hata vermek yerine beklesin ve arayuzde bekledigini gostersin bunu duzeltip VM'de test edelim calisan ayarlari bozma”
  - Evidence: the VM update from 1.2.0 to 1.2.2 failed while unattended-upgrades held the dpkg frontend lock; retrying through Settings after the lock was released succeeded.

  - Completed in 1.2.3: lock-aware apt execution with streamed waiting status. VM candidate update was initiated through Settings with a real dpkg frontend lock held by a test process; the UI showed the waiting message, then resumed automatically and completed after release. Test feed and candidate updater were isolated to the VM; host settings were not modified.
