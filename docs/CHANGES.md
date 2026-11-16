# Complete change inventory

This inventory covers project behavior, not every typo or intermediate experiment. [Development notes](DEVELOPMENT-NOTES.tr.md) retain the implementation chronology; Git history records every revision. The current public installer supersedes old command examples in those notes.

| Area | Changes | Source / entry point |
|---|---|---|
| Window controls | Left close/minimize/maximize; traffic-light colors; compact GTK4 header spacing so titles fit | `scripts/desktop.py`, `config/traffic-lights.css`, `config/headerbar-spacing.css` |
| Desktop theme | Pinned WhiteSur dark GTK/Shell/icons, wallpaper, shared dialog contrast/buttons | `scripts/visual-system.sh`, `config/shell-refinements.css` |
| Top panel | One Apple-style system menu, localized labels, left popup alignment, clock at far right; capsule selections inset 2 logical px | `extensions/macbook-menu@local/` |
| Application menus | Real D-Bus menu export, app identity, desktop Finder-like actions, actual supported native actions; late registration recovery and focus debounce | modified `vendor/appmenu-5.7.1.tar.gz` |
| Menu layout | Compact 200px minimum popup content width; normal text alignment and narrow separators; long content can grow | AppMenu `stylesheet.css` |
| Brave integration | X11 launcher for exported menus; supported shortcuts and command-based quit mapping | `scripts/install-brave-global-menu.py`, `config/app.conf` |
| ChatGPT integration | Version-guarded native window frame, Electron→Dbusmenu bridge, removal of duplicate HTML menu | `scripts/chatgpt-*`, `bridges/` |
| Dock | Bottom centered fixed dock, reserved work area, reduced corner radius/top gutter, mount/trash visibility | desktop settings, Shell CSS |
| Dock icon alignment | Event-driven favorite icon artwork normalization to an 84/96 visible square, original aspect ratio and inherited theme preserved; no runtime polling | `scripts/install-dock-icons.py` |
| Running indicators | Finder uses native dock dot; tracked process identity keeps a dot while an observed app process lives; PID reuse/exit checks | `processTracker.js`, `extension.js` |
| Dock reopen | One pending launch while last window exits; repeated clicks coalesce; bounded wait for background process | `dockLaunch.js` |
| Window rounding | Pinned outer-actor shader, 12px/.2 profile, maximized padding/inset fixes, texture signal lifecycle cleanup | `scripts/install-rounded-corners.py`, `overrides/rounded-window-corners/` |
| Minimize animation | Pinned Magic Lamp extension, 400ms profile | desktop installer / vendor |
| Keyboard | keyd physical Apple keyboard match excluding touchpad; Cmd-style copy/paste/quit, terminal-specific shortcuts, Ctrl+C interrupt preserved, function key setting | `config/apple.conf`, `config/app.conf`, `scripts/system.sh` |
| Screenshots | Cmd+Shift+3/4 and clipboard variants, Shell screenshot UI, popup/modal-aware capture, freeze-before-area-selection, HiDPI crop, async file writes | `capture.js`, `scripts/screenshot-clipboard.sh`, keyboard profile |
| Workspaces/gestures | Dynamic horizontal workspaces, opt-in gesture profile, pinned upstream gesture customization; input settings no longer reset by default | desktop installer, gesture vendor |
| Scroll distance | Optional finger-only 0.50 libinput value multiplier, both axes; wheel/continuous motion unaffected | `native/scroll-scale.c`, `scripts/install-scroll-speed.sh` |
| Scroll animation | Optional smooth-scrolling launch flag for installed Chromium-based apps | `scripts/install-smooth-scrolling.py` |
| Display brightness | Optional gmux down key reaches hardware zero; native GNOME up key remains available to restore light; no daemon/polling | `scripts/brightness.py`, `scripts/install-brightness.py` |
| Boot | Local vector logo rasterized at multiple native sizes; bottom progress bar; boot-only drawing, black shutdown, prompt handling retained | `config/macbook.script`, `assets/boot`, `scripts/render-boot-assets.py` |
| Login | Big upper clock/date, lower avatar/password, keyboard-clearance layout, small session icon, no bottom logo; exact-source/hash guard | `config/gdm.css`, `scripts/build-login-layout.py`, GDM wrapper/installers |
| Wi-Fi | Optional BCM4360 Broadcom STA DKMS repair, not a theme dependency | `scripts/wifi.sh` |
| Performance | Dock-only traversal instead of whole Shell scene; repaint only on state changes; destroyed indicators removed; no duplicate window registration on menu updates; asynchronous PNG file save | extension + exporter |
| Packaging | Supported-profile preflight, default read-only check, dry-run plan, optional input/apps/Wi-Fi, generic Node dependency, checksum verification, rollback layering, CI/tests | `install.sh`, `scripts/doctor.py`, `restore.sh`, `tests/` |

## Not claimed or not complete

- No universal keep-alive after an app closes its last window: apps that exit still exit.
- No universal global menu support. Unsupported apps retain their own UI.
- Screenshot bindings intentionally exclude secure login/lock screens.
- No exact macOS acceleration/momentum/animation engine.
- Brave's extra internal rounding is still unresolved; our old GTK3 workaround was ineffective.
- Login source/layout tests passed, but latest appearance needs a physical greeter check.
- No cross-distribution or other-hardware support claim and no clean-install certification yet.

## Early experiments

Earlier revisions used a synthetic Finder dot, repeated panel fallback menus, larger logo assets and GTK3 inner-corner CSS. They were changed or superseded; their presence in history is not a recommendation to reapply them. Current options and status take precedence over historical notes.

### Screenshot shortcuts
- Command + Shift + 3: full-screen PNG to Desktop.
- Command + Shift + 4: selected area to Desktop; Space before dragging toggles window selection. Escape cancels.
- Add Control to 3/4: copy PNG to clipboard instead of saving a file. Control can also be held when completing a selection.
- Command + Shift + 5: native Shell screenshot/recording toolbar.
- A successful 3/4 capture flashes the screen and plays the capture sound, including clipboard captures.
- Shell popup/modal action modes are supported; login and locked-screen capture are intentionally excluded.
- This is not an exact clone of every macOS Screenshot option: the toolbar is GNOME's, window capture crops the visible frame, and macOS selection-resize modifier gestures are not implemented.

Reference: [Apple screenshot shortcuts](https://support.apple.com/en-euro/guide/mac-help/mh26782/mac).

### Desktop-to-dock Trash
Added a desktop drag-source/Shell bridge for dropping selected desktop files onto dock Trash. Uses the existing desktop file-operations service, rejects cancellations and stale/off-target drops, excludes special desktop icons, and adds no polling. Source integration is version-guarded and reversible. Covered by logic tests; live drag verification pending next login.

### Search and installed applications
Command+Space opens AppMenu's existing floating search for installed applications, settings and recent files. Removed competing overview/input-source bindings for this chord; Control+Up still opens the overview. Apps is a normal movable dock launcher, initially after Finder, opening the floating application browser.

### Compact floating search
Search opens as a 460-logical-pixel input with no initial suggestions; typing expands results downward from a fixed upper-screen anchor, capped at five results. Clearing collapses immediately. Clicking/touching outside the dialog closes it; inside clicks, arrow-key selection, Enter and Escape retain their behavior. Overrides are layered after the pinned AppMenu archive, without altering it.

### Fixed dock endpoints and movable Apps
Finder is maintained at position zero and Finder/Trash drag starts are blocked. Other favorite ordering is preserved, including Apps. The native extra Show Applications endpoint is hidden. A separator is drawn immediately before Trash rather than between favorites and running apps. Apps offers installed-app search, category filters, Grid/List, keyboard navigation and outside-click dismissal; no daemon or app-list polling. Installation uses the existing desktop rollback journal.

Reference: [Apple — View and open apps](https://support.apple.com/en-ie/guide/mac-help/mh35840/27/mac/27). Functional unit tests pass; live shell layout and physical dragging await next login.

Dragging a favorite dock icon at least 48 logical pixels upward and releasing removes only its favorite entry through GNOME’s native favorites service (with Undo support). Running applications remain running and may stay visible as running icons. Finder/Trash and overview-grid drags are excluded. No application files are deleted.

### Downloads stack
The dock folder section is now `separator | Downloads | Trash`. Downloads opens a native popup with Auto/Fan/Grid/List, modified-date/name sorting and Open in Files. Auto uses Fan for up to seven items and Grid above that. Clicking a file opens its default application; outside-click/Escape closes the popup. Enumeration is asynchronous and cancelled on close; all visible entries are counted while only 200 are retained for display; hidden files are omitted. Preferences are saved in `~/.config/familiarmac-stacks.json`. No polling or thumbnail-generation service is added. macOS Quick Look, file dragging from the popup and thumbnail previews are not implemented. Live fan/grid layout verification awaits next login.

### Downloads reference-menu refinement
Separate right-click sections mirror the supplied reference: Sort by, Display as Folder/Stack, View content as Fan/Grid/List/Automatic, Options and Open Downloads. Fan is explicitly selectable regardless of file count. Its configurable maximum defaults to seven; screen height may lower it. A clickable **N More in Finder** row sits above the fan and uses the full visible-file count, including folders larger than 200 entries. View/sort/display/limit choices persist. Date Added is visibly disabled rather than substituting another timestamp.

### Compact status controls and Help ordering (2026-11-16)
- Added an original two-toggle Control Center icon to the native status button, with compact spacing and lighter battery text. Existing privacy, recording, network and battery indicators remain live.
- Scoped native Quick Settings styling: rounded compact cards, blue active controls, inset volume/brightness cards, dark translucent background. Native controls, authentication, keyboard navigation and hardware callbacks remain unchanged; no timer or new service. This is a macOS-inspired GNOME control center, not a pixel-identical replacement; AirDrop and Apple screen mirroring are not implemented.
- Generic app menu ordering keeps localized Help last, after synthesized Window and custom menus, preserving actions.
- Changes install for the next login. Syntax, lifecycle cleanup and ordering tests passed; physical panel appearance still needs visual verification after login.
