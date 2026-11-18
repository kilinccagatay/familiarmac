# Open follow-ups

## Reported on 19 November 2026

- [ ] **Type to log in:** On the physical computer, typing at the user-selection screen still does not reliably open the password field and preserve the first characters. A stock-GDM VM test passed, but the user confirmed the installed login layout still fails. Reproduce with the installed greeter layout and account focus; preserve printable symbols, Unicode and native password handling. Do not mark complete based on unit tests alone.
- [ ] **Magic Mouse disconnect during a swipe:** Switching the mouse off partway between desktops still leaves the transition stuck on the physical computer. The attempted reader-removal cancellation did not resolve the reported scenario. Trace Bluetooth disconnect, heartbeat and Shell cancellation together, and verify with the physical power switch before closing.

Desktop icon visibility during workspace transitions also needs physical confirmation after the latest DING clone fix.
