# keyd IPC reliability

The bundled 2.6.0 daemon uses xread in its single-threaded IPC handler. EOF returns zero without advancing the byte count, producing an infinite loop while the daemon still holds its keyboard grab. An idle client also blocks its read indefinitely.

`patches/keyd-ipc-read.patch` replaces only that daemon request read with an EOF-aware, total 100 ms bounded read. Invalid/incomplete requests are closed and logged; no keymap, device matching, driver, boot or Wi-Fi configuration changes. The pinned archive remains intact. The optional hardware installer applies the patch before building; desktop-only installs do not install keyd.

`python3 tests/keyd-ipc.py` reproduces the original EOF spin in an isolated socket pair and checks closed, partial, idle and valid fragmented requests in the patched reader. It never accesses evdev or the running daemon. Existing keymap tests also run against the patched source.

On 2026-11-17 the installed daemon was CPU-running and unresponsive, with a mapper bind-reset request waiting. Restart restored the internal keyboard. The user reported onset during Check menus. That service has no direct keyd IPC call. The original process was restarted before a stack trace was captured, so this reproduced defect is a matching failure mechanism, not proof of the exact historical trigger. A future incomplete request is logged for diagnosis.
