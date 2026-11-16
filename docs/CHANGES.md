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

### Control Center layout and session confirmation
- Reordered native controls into connectivity/Do Not Disturb cards, followed by labelled Display and Sound sliders; system/power actions at the bottom. Native submenu overlays, network selection, output selection, keyboard/outside-click dismissal remain intact. Layout is set only at first opening after native initialization, with no polling; original actor order and signal connections are restored on disable.
- Do Not Disturb is functional and synchronized to GNOME notification banner settings.
- Smaller session confirmation with question title and compact buttons. Native countdown presentation previously rounded to 10-second steps; now shows ceil(actual remaining seconds) every native timer tick. Timer deadline, cancel, inhibitors, PackageKit/update flow and restart actions are unchanged. No system restart was triggered for tests.
- Native GNOME grid is retained: this does not yet reproduce Apple's grouped connectivity tile, media tile, or every macOS-specific submenu. Physical layout still needs post-login validation.

### Visible dock separator and control-card geometry
- Downloads now contains a dedicated noninteractive 1×32 logical-pixel divider actor before its button. It no longer depends on the dock's `.bottom` class or a theme-overridden container border. Divider is destroyed with the stack and does not add timers or input handlers.
- Control Center card main/arrow halves now have complementary corners and matching enabled/disabled colors. Removed doubled padding and inherited fixed minimum widths; enlarged panel to 360 logical pixels for readable titles. Changes need the next login; physical appearance is not yet verified.

### Independent status buttons
- Network, Bluetooth, volume and battery now have separate panel hit targets with their live native indicators. The Control Center icon opens the full panel; separate buttons show only their corresponding native controls. Repeated click closes the detail. Keyboard Enter/Space/Down is supported.
- Controls remain in their native grid, preserving submenu overlay metadata. Other controls are temporarily hidden with state-change tracking and restored on close/disable. No duplicate network/audio daemons; startup readiness wait is bounded and removed on disable. Privacy indicators remain in the native area.
- Tests cover filtering, changing visibility, repeated activation and restoration. Full test suite passed. Installed for next login; live pointer/keyboard behavior still needs physical verification.

### Movable status icons and explicit clock format
- Command-drag reorders right-side status buttons; with this setup keyd exposes physical Command as Control, so Control-drag also works. Super is accepted for unmapped keyboards. Escape cancels; dropping outside the status buttons restores the previous order. Normal clicks keep opening menus. Order persists in `~/.config/familiarmac-panel-order.json`; stale/duplicate IDs are ignored. No polling or per-frame timer.
- Date now uses English abbreviated day/month with seconds: `Mon 16 Nov 10:50:30`, using the system timezone and GNOME's native wall-clock updates. Other system locale preferences are unchanged.
- Installed for next login. Automated order/format tests pass; physical dragging still needs post-login verification.

### Localized panel date names
- Removed fixed English weekday/month tables. GLib now supplies abbreviated names using the session's LC_TIME locale, matching system regional date settings. Order remains weekday, day number, abbreviated month, 24-hour time with seconds. No locale or timezone settings are changed.

### Date names follow the interface language
- Corrected the preceding locale change: weekday/month names now use GLib's LC_MESSAGES language preference list and cached Intl formatters, not LC_TIME/region. Fixed field order and 24-hour seconds remain unchanged. English UI with Turkish date-region settings produces `Mon 16 Nov 10:50:30`; Turkish UI produces `Pzt 16 Kas 10:50:30`. Tests cover both and the C-locale fallback.

### Status interaction fixes
- Command-drag now checks that the primary mouse button and modifier remain held; lost button release, modifier release and Escape cancel the drag. A 100ms guard runs only during dragging and is removed on completion/disable, preventing later hover from moving icons. Regression tests cover missed release and normal drop.
- A detail menu highlights only its clicked status button. Removed the native Control Center active state that was also applied when its shared menu hosted a network/sound/battery detail view.
- Installed for next login; live input validation pending.

### Session confirmation layout repair
- Corrected the style target: GNOME 46's actual modal box is `dialogLayout._dialog`, not the outer Dialog actor. Width/padding/radius rules now apply to the visible box.
- Explicitly enabled word wrapping and disabled title ellipsis; restore prior Pango properties on disable. Added a class to the otherwise unstyled button-layout widget so its spacing rule takes effect. Countdown and session actions unchanged.
- Regression test verifies the correct inner style target and wrapping restoration. Installed for next login; no real restart invoked to test layout.

### Apps opening and compact search repair
- Fixed actual logged Apps exception: Shell.AppSystem.get_installed() returns Gio.DesktopAppInfo. Filter those, then resolve Shell.App through lookup_app before icon creation/activation. Ignore unresolved IDs. Regression fixture uses the real API object distinction.
- Spotlight-style search removes inherited WhiteSur content margins/max-width, uses a transparent search entry with search glyph, and left-aligns expanding result contents. Empty query still collapses results; existing keyboard, Escape and outside-click behavior remains.
- Added read-only graphics transition diagnostic script. Session and greeter logs both selecting Nouveau/card2 argues against a persistent Intel/NVIDIA switch; does not exclude a transient hardware mux change. No GPU, firmware or boot settings changed.
- Installed UI fixes for next login. Tests pass; live Apps/search verification pending.

## Status popup anchors and undimmed launchers (2026-11-16)

- Network, Bluetooth, sound and battery detail menus anchor to their own clicked status button and return keyboard focus there. Selected controls span the detail grid, eliminating its unused second column. Closing restores the Control Center anchor, focus and original column spans.
- Spotlight and Apps use an undimmed modal surface: outside-click and Escape dismissal remain, without the GNOME Lightbox. Both have a 24 logical pixel outer radius. Spotlight reference: [Apple Spotlight guide](https://support.apple.com/en-gb/guide/mac-help/mchlp1008/mac).
- Command-drag uses a Clutter pointer grab through release, instead of polling virtual modifier state every 100ms. Escape/modifier release cancel; mouse release ends the operation, so later hover cannot keep moving icons. Input/trackpad settings are unchanged.
- Full automated suite passes, including every hardware popup's anchor/span restoration and drag/release lifecycle. Installed Shell JavaScript takes effect next login; actual pointer behavior and visual alignment still require desktop validation. No logout/restart is triggered by installation.

## Drag applications from launchers to Dock (2026-11-16)

Apps grid/list and Spotlight application results use native GNOME AppIcon drag sources, shared through `launcherDrag.js`. Hold and drag an application onto the Dock application area to pin it at the drop position. Existing favorites use the native move path, avoiding duplicates; Finder-first normalization and the separate Downloads/Trash section remain in place. File/search-setting results are not treated as application favorites.

During drag the launcher hides and releases its modal grab so the Dock receives the drop. Successful drops close the launcher only after DND releases the source; cancelled/outside drops return to the launcher. Pending search updates are cancelled to avoid destroying the source mid-drag. No background polling or input-setting changes are introduced. Spotlight now resolves installed desktop entries into Shell.App objects for launching, native icons and drag interoperability.

The full automated suite passes, with lifecycle regressions for release, cancellation, deferred destruction and accidental activation. Installed copies match the repository; a new login is required to load the JavaScript. Physical drag/drop on the running desktop remains to be validated. Implementation uses the installed GNOME 46 `appDisplay.js`, `dash.js` and `dnd.js` APIs, alongside the existing Zorin Dash.

## Clock scope correction (2026-11-16)

Login and lock-screen clocks omit seconds. The login overlay already uses `%H:%M`; the shared `clock-show-seconds` preference is now false. The panel alone opts into native `WallClock.force_seconds`, preserving its requested seconds format without propagating it to the lock screen or introducing another timer. Disabling the extension restores the panel clock's previous force-seconds property.

## Emergency panel input recovery (2026-11-16)

The panel pointer grab introduced in the drag repair blocked clicks outside the panel on the real desktop. Disabling the extension restored clicks, confirmed by the user. Removed that grab; dragging now observes stage events and has a button-only lost-release watchdog, active only during a drag. The current session keeps the extension disabled because GNOME caches loaded JavaScript modules; corrected source is installed for a fresh session. Automated lifecycle tests now prohibit acquiring a panel grab. Actual drag behavior still needs validation before declaring the feature fixed.

## Spotlight top-edge layout (2026-11-16)

Keep the outer dialog wrapper expanded to the monitor allocation and place the top offset on the visible inner panel. Results grow below the entry rather than changing the wrapper's natural-size positioning. Search filtering/dismissal regressions pass; actual rendered position needs verification in the next session. Apps remains temporarily unavailable while the system-menu extension is disabled for input recovery; its next-session recovery launcher restores it.

## Connection menus, Control Center cards and hardware OSD (2026-11-16)

- Wi-Fi opens the native wireless submenu directly. Its status icon follows wireless state even when Ethernet is the default route; native Ethernet controls remain in Control Center. Tested real simultaneous connectivity: Ethernet route metric 100, Wi-Fi 600. No connection priorities or device state were changed. Reference: [Apple network service order](https://support.apple.com/en-au/guide/mac-help/mchlp2711/27/mac/27) and [Wi-Fi menu](https://support.apple.com/en-us/101589).
- Shared detail close hides the popup before restoring the full grid, suppressing the transient Control Center flash for every status detail.
- Control Center follows the supplied macOS reference's card grouping: left connection block, focus above keyboard/display tiles, full-width brightness/sound cards, and native MPRIS playback. Sliders forward native state and drag signals; no second hardware service or polling. AirDrop is not implemented; the left block instead includes actual Ethernet state. Displays opens GNOME display configuration, not an unsupported AirPlay mirroring service. The light translucent palette approximates the reference; backdrop blur is not claimed. [Apple control behavior](https://support.apple.com/en-in/guide/mac-help/mchlc9d0e1f2/mac).
- Hardware OSDs for volume, display and keyboard brightness use a rounded translucent vertical panel, large native symbol and 16 level segments. Existing timeout, animations and hardware key handling remain native. Unrelated OSDs retain their original style; cleanup restores all properties and callbacks.
- Automated suite covers native slider binding/cleanup, Wi-Fi while wired, hidden-before-restore close, and OSD reuse/restoration. Installed source requires next login; rendered geometry, physical sliders and closing animation still need desktop verification.

### Control Center alignment and independent battery detail (2026-11-16)

- Keep the network status content in one container, so the Wi-Fi glyph can be allocated while Ethernet is the default route. Restore native indicators on extension removal.
- Align connection text to the leading edge; prevent circular glyph backgrounds from stretching into pills. Keep the two small tiles sized consistently.
- Use a white crescent for Do Not Disturb in the panel and a crescent in Control Center; retain native notification settings and restore the original indicator on disable.
- Battery detail now shows the live UPower percentage, battery/adapter source, charging state, an estimate only when provided, and a link to Linux power settings. It does not expose the unrelated screenshot/lock/shutdown row or invent per-app energy data.
- Dock activation no longer waits for a background application with no closing window; when an already-starting application produces a window, a pending click activates it instead of being discarded. Closing-window clicks remain coalesced and bounded.
- Reference: [Apple Battery Status menu](https://support.apple.com/en-sg/guide/mac-help/mchl173fcc57/27/mac/27). Linux state comes from GNOME Shell's existing UPower proxy; no additional polling service.
- Regression tests cover activation transitions, battery state changes/cleanup, popup restoration and control allocation properties. Real session startup and physical click behavior still require verification after a new login; unit tests are not a visual or hardware acceptance test.

### Hardware overlay proportions (2026-11-16)

Use equal 140px content width/height plus equal padding for a square volume/brightness/keyboard-backlight HUD. Match white monochrome symbols to white filled segments on a translucent gray surface. Zero the hidden native level's width as well as height so its theme minimum cannot widen the square. Preserve native adjustment, timeout and fade behavior. Reference: [macOS volume HUD example](https://zenn.dev/noppe/articles/bc790336f3cc6a).

### Rounded hardware level endpoints (2026-11-16)

Round only the outer corners of the first and last hardware OSD segments. Interior segment edges stay square; the same geometry applies to filled and empty segments for sound, display and keyboard brightness.

### Brightness-down visual feedback (2026-11-16)

The zero-capable gmux brightness-down helper bypasses GNOME's native brightness key path and previously did not request an OSD. After a successful logind hardware change it now sends the normalized level to a narrowly scoped session-bus extension method. The extension invokes the same styled native OSD as other brightness controls, including zero. It ignores requests on the lock/greeter screens and clamps levels. An unavailable extension never prevents the hardware adjustment. Native brightness-up remains unchanged. No polling or persistent helper added. Endpoint tests cover zero, clamping, lock-screen suppression and teardown. A new login is required to load the extension method.

### Startup layout, clock spacing and HUD placement (2026-11-16)

- Override WhiteSur's 16px clock inset with 6px, and reduce adjacent Control Center padding.
- Replace the one-second native-indicator readiness polling with a coalesced idle callback triggered by child insertion. Restore the small local panel-order preference before the first paint instead of asynchronously shuffling displayed icons. No login sleep or full-screen input overlay.
- Shell still loads extensions as part of session startup; this removes our own delayed rearrangement but does not claim that every underlying GNOME startup frame is replaced. Verify the transition on a new login.
- Position hardware HUDs horizontally centered with their bottom edge about 16% of monitor height above its bottom. This is an approximation measured from a [full macOS desktop reference](https://pbs.twimg.com/media/FcTFCrqXkAAYZ_O.jpg), not an Apple-published positioning specification. Recalculate per display and scale factor on each show; restore the original style when disabled.

### Notification startup and clock alignment (2026-11-16)

Initialize the DND crescent adapter when the extension enables, not when Control Center first opens. Preserve the normal unread-notification symbol and restore native behavior on disable. Remove GNOME's mirrored clock spacer from the right-aligned panel layout, place the real indicator before the clock, and restore the exact original child order on disable. Match clock text to the other 10pt status labels and keep the white 16px glyph vertically centered. Tests cover initialization before any menu opening, notification changes, spacer removal and teardown. Physical appearance awaits the next login.

### Optional framebuffer handoff workaround (2026-11-16)

Added a device-restricted, reversible `fbcon=nodefer` installer for the reported boot/logout corruption on MacBookPro10,1 with Nouveau. Diagnosis found a registered framebuffer but only the dummy console bound, with deferred takeover in the journal. This is a controlled hypothesis, not a verified fix. It changes one future-boot parameter, does not switch GPUs or disable acceleration, and includes backup, generation checks and restore mode. See [GRAPHICS-TRANSITION.md](GRAPHICS-TRANSITION.md) for evidence, verification and rollback.

### Boot corruption: failed test recorded, early KMS test added (2026-11-16)

The user confirmed boot corruption persisted with `fbcon=nodefer` active; record this as failed, not fixed. Added an opt-in MacBookPro10,1 installer that removes that experiment and loads gmux/Nouveau from initramfs before Plymouth. The existing image lacked both modules and the journal showed a late SimpleDRM→Nouveau transition. Installation backs up the current image, checks included modules, and supports restore. Visual boot/logout results remain pending; no desktop performance or input settings changed.

## 2026-11-16 — Notification Center and independent Focus

- Right-aligned, compact single-column date popup: native notification cards above the calendar. Removed the oversized side-by-side layout and the date popup's duplicate DND switch.
- Independent crescent menu controls the same GNOME `show-banners` setting as Control Center; shown while DND is enabled. Native notification actions and dismissal remain intact.
- No full-screen input layer, polling or new notification daemon. Actor order, visibility and menu anchoring restore when disabled. GNOME 46 private actor integration; other shell versions require verification.
- Unit tests cover layout/restoration and setting synchronization; complete suite passed. Installed for next login; live visual validation pending.
- Apple references: [Notification Center](https://support.apple.com/en-gb/guide/mac-help/-mchl2fb1258f/mac), [Focus menu](https://support.apple.com/en-bw/guide/mac-help/mchl999b7c1a/mac). This Linux version retains its native calendar; it does not implement Apple's widget gallery or cross-device Focus.
- User confirmed the early Nouveau initramfs change resolved both boot and logout corruption.

## 2026-11-16 — Consistent status-bar spacing

- All right-panel buttons use one 6px horizontal padding budget, zero extra icon padding/margins, and 16px symbolic hardware icons. Control Center no longer has its own larger padded icon.
- Tray boxes lose theme-added margins. All AppIndicator applications use 20px artwork bounds to balance inset full-colour artwork against symbolic icons; no ChatGPT-specific exception. Arbitrary source artwork may still have different internal transparent margins.
- Installer applies the shared tray size when a supported AppIndicator schema exists and saves its old value for restoration. Clock retains seconds and its existing UI-language format.
- Installed CSS loads with the next session; tray size updates live. Visual verification remains pending.

## 2026-11-16 — Static early boot logo

- Added an opt-in GRUB background renderer and reversible installer for a centred Apple logo without progress, before Plymouth starts.
- Preserves timeout, graphics mode and the successful early Nouveau initialization. Firmware time before GRUB remains outside its control.
- Renderer and shell syntax validated; installed on the target machine. Visual reboot validation pending.

## 2026-11-16 — Early logo redraw follow-up

- User reported the static GRUB logo did not appear on reboot; the previous background-only approach is not visually verified.
- Added an EFI-only explicit gfxterm redraw after the background is loaded, including the zero-timeout path. This is a testable follow-up, not a confirmed diagnosis. No sleep or timeout increase; early Nouveau is unchanged.
- Redraw generator is included in install/restore and transaction rollback. Shell and GRUB syntax checked; privileged installation completed successfully on the target machine. Hardware validation pending.

## 2026-11-16 — Battery Settings menu row

- Separate separator from the settings action; left-align its label with battery information. Replace square hover fill with rounded blue hover/keyboard focus and explicit transparent idle state.
- Preserve power-settings action and live battery state. Battery tests and JS syntax passed; installed for next session, visual validation pending.

## 2026-11-16 — Single-level Wi-Fi detail

- Replace nested Quick Settings tile/submenu with a master Wi-Fi switch, native network list (signal, lock and connected checkmark), and Wi-Fi Settings action.
- Borrow/restore the original GNOME network section while open; retain NetworkManager authentication, accessibility and activation. Scan only while open, using GNOME's scan lifecycle. Hardware-disabled Wi-Fi cannot be toggled. Ethernet remains independent.
- Apple reference: https://support.apple.com/en-mt/guide/mac-help/mchlfad426fa/mac . Uses Linux's native network ordering; Apple's Personal Hotspot/iCloud sections are not implemented.
- Suite and dedicated lifecycle test passed; installed for next login. Actual network switching was not exercised to avoid interrupting the connection; live visual validation pending.

## 2026-11-16 — Sound detail palette and output list

- Single-level Sound panel with a high-contrast mute icon, native volume slider, output devices and Sound Settings. No nested arrow/tile or white-on-light hardware glyph.
- Native slider and device section are temporarily reparented and restored on close/disable; keeps mute, volume amplification policy, keyboard controls and device selection callbacks. No polling or independent mixer.
- Reference: https://support.apple.com/en-euro/guide/mac-help/mchl1f98810b/27/mac/27 .
- Full suite and dedicated sound lifecycle test passed. Installed for next login; visual and physical audio validation pending.

## 2026-11-16 — Transparent notification drawer and calendar language

- Scope restricted to the date popup and clock pill: transparent outer container, separate cards, right-edge slide animation and monitor-height geometry below the panel. Native menu focus/outside-click handling retained; no new global input layer.
- Calendar date/month/weekday labels follow LC_MESSAGES (UI language), independent of LC_TIME; existing week-start preference retained. Month navigation re-localizes names. Equal calendar columns correct asymmetric spacing.
- Clock pill gets explicit internal horizontal/vertical spacing; neighbouring status-button rules unchanged.
- Complete suite passed, including locale/navigation and drawer geometry/callback/restoration tests. Installed for next session. Live GNOME animation, scaling and visual results still require validation. Wi-Fi, Sound, Battery, Dock and boot code unchanged in this revision.

## 2026-11-16 — Percentage inside battery glyph

- Replace the separate status battery/percentage with a vector-drawn 38×18 glyph containing the numeric percentage. Actual level fill, contrasting digits, green charging with bolt, red low/discharging state; no polling.
- Reuses the native UPower proxy and existing battery menu/hit target. Missing battery hides the target; native indicator restores on disable. No changes to date, Wi-Fi, sound or boot behavior.
- Reference image and description: https://www.iclarified.com/102441/how-to-show-battery-percentage-on-mac-video (macOS 27); Apple battery behavior: https://support.apple.com/guide/mac-help/monitor-your-macs-battery-mchlp1115/mac . Original Cairo implementation, no copied raster artwork.
- Suite and dedicated battery state tests passed. Real GJS/Cairo rendered full/half/low/charging previews; installed for next login, live panel validation pending.

## 2026-11-16 — Withdraw early GRUB logo experiment

- Hardware feedback: static logo appears late and boot transition corruption returned after the GRUB background/redraw experiment. Earlier static-logo entries are not a successful outcome.
- Disable new installation of that experiment; preserve --restore so existing users can remove both the background override and redraw generator and regenerate GRUB.
- Restore completed successfully on the target machine; background override, redraw generator and image removed. Subsequent visual boot validation required. Early Nouveau initramfs hook remains installed.
- Current boot: Nouveau framebuffer ready at approximately 1.95 seconds after kernel start. These logs do not measure the preceding firmware/bootloader delay. No timing claims about the full power-button-to-logo interval.

### Optional fixed-hardware boot-image reduction

- Added `scripts/install-lean-initramfs.sh` with install/check/restore and image backup/rollback.
- On MacBookPro10,1 with only GT 650M NVIDIA hardware, omit modern GA102/TU102 GSP firmware from the initramfs; retain root firmware and the successful early Nouveau hook.
- No extra logo stage, GRUB drawing or framebuffer mode changes. Physical boot timing remains to be verified.

### Boot diagnosis follow-up

- The reduced image did not resolve the reported late logo/pre-logo artifact.
- Added optional reversible Plymouth boot tracing, without changing rendering or GPU settings, to diagnose the remaining transition.

### Critical: status popup could terminate GNOME Shell

- Fixed Wi-Fi/sound/battery custom detail opening hiding every native Quick Settings grid child. GNOME 46 computes row spacing as `(rows.length - 1) * row_spacing`; zero rows produced a negative minimum height and a fatal Clutter warning (observed twice immediately before `gnome-shell` trapped in GLib).
- Custom detail surfaces now hide only the native grid parent and retain its rows; ordinary filtered native details keep their existing behavior.
- Added regression coverage for all three custom details. Full test suite passed. Installed into the user extension and recovered GNOME's crash-disabled user extensions without logging out; physical menu-click verification remains separate.

### Compact status menus and slider contrast

- Reduced detail-popover outer padding from 12 to 8 logical px and nested Wi-Fi/sound/battery padding to 2 px; compact rows retain a minimum readable height.
- Battery Settings gets explicit button and label minimum heights and hover/focus text contrast to prevent a collapsed blank action row.
- Unified sound, display and keyboard-brightness sliders within Control Center: darker empty track, light fill, outlined white handle, visible keyboard-focus border, 24px minimum height. Native value/drag handling and the empty-grid crash fix are unchanged.
- Reference: [Apple's sound-menu screenshot](https://support.apple.com/de-de/105092) and [Control Center guidance](https://support.apple.com/guide/mac-help/quickly-change-settings-with-control-center-mchlc9d0e1f2/mac). These are visual adaptations to GNOME, not a claim of pixel-identical macOS rendering.

### Blue slider fill preference

- Following confirmation that the compact layout and Battery Settings label are fixed, changed the shared Control Center sound/display/keyboard slider fill to blue (`#0a84ff`) with the existing outlined white handle and gray empty track.
- This is the requested visual preference, not a claim that every macOS version/panel uses a blue fill. Existing padding, input handling and crash fix are unchanged.

### Firmware wait diagnosis

- Plymouth trace reaches splash at ~2.5 s after Linux starts; firmware separately reports a 5-second timeout.
- Added optional MacBookPro10,1 timeout-only helper with backup, restore and readback; installed timeout is zero without changing boot order.
- Physical timing benefit remains unverified; pre-logo display corruption is still unresolved.

- Focus/Do Not Disturb card now uses 14px horizontal inset (was 6px), moving its icon and label together away from the left edge; other cards retain their spacing.

### Persistent panel application placement

- AppIndicator order now uses its stable StatusNotifier Id instead of the session-specific D-Bus name.
- Coalesced child-added idle handling reapplies saved order when tray applications arrive after Shell startup; the handler is disconnected on disable.
- Unplaced application indicators default before system controls/date. Saved positions for temporarily absent apps are retained when another item is moved.
- Old ephemeral bus-name entries are ignored; they cannot reliably identify the app in a new session. Users can reposition once to store the stable identity.
- Regression tests cover changing bus names, distinct apps, late arrival and an explicit position. Installed code requires a fresh Shell session to avoid cached JS modules.

- Panel battery artwork uses neutral white/gray with transparent percentage cutouts over the filled portion, instead of fixed black digits or an opaque dark backing. White digits remain over the empty portion for legibility. Charging/low state calculation is unchanged.
- Visually compared the percentage-inside-battery reference: https://www.iclarified.com/images/tutorials/102441/484749/484749-640.png (article: https://www.iclarified.com/102441/how-to-show-battery-percentage-on-mac-video). This is a GNOME adaptation, not a pixel-identical claim.
- JS drawing updates take effect in a fresh Shell session.

### GTK context-menu spacing and boot text follow-up
- Reduced GTK3 menu outer padding from 6 to 4 logical pixels, item horizontal padding from 6 to 4, and submenu arrows from 16 to 12. Check/radio and accelerator columns remain native; applies to GTK3 context menus rather than one application.
- Compared desktop context-menu layout with https://www.techradar.com/computing/software/how-to-right-click-on-a-mac . Parsed using the real GTK CSS provider; desktop-icons restarted to load the stylesheet. Final visual comparison remains user-verifiable.
- User reports no pre-logo corruption on latest boot, but transient text. Current journal contains a Broadcom wl initialization warning ("Unpatched return thunk in use") and backtrace before the splash. This is a candidate source, not proven without seeing the text.
- Removed temporary plymouth.debug via the existing restore helper and regenerated GRUB successfully. Early Nouveau, firmware timeout, and display-mode configuration remain unchanged. This removes diagnostic mode; it does not fix the wl warning or guarantee no text on the next boot.

### Broadcom return-site metadata and update guard
- Diagnosed missing wrapper .return_sites in installed wl, independent of the opaque blob's generic limitations. Added per-wrapper objtool processing; rebuilt signed module has 220 return relocations including osl_strlen's return.
- Installed with original module/source/DKMS/initramfs backup; Wi-Fi remains connected. Runtime warning removal still requires reboot verification.
- Added persistent /etc/dkms build wrapper; exact known sources are patched in the disposable build tree, already-fixed sources are not duplicated, unfamiliar sources remain untouched and modules missing required metadata fail validation.
- Verified a second DKMS build through the persistent guard after restoring pristine vendor /usr/src. No changes to graphics, GRUB, kernel mitigation settings or active network modules. See BROADCOM-RETURN-SITES.md for sources, limitations and rollback.

### Static GRUB logo without terminal reset
- Added a separate opt-in, backed-up installer using background_image and an empty echo paint flush on the already active terminal. No clear, extra terminal selection, delay or video-mode override.
- Validates generated GRUB syntax and unchanged kernel/initrd/mode/timeout commands, rolling back on failure. Previous withdrawn early-logo installer remains disabled.
- Rendered and visually inspected the logo asset. Installed Wi-Fi module, initramfs and early Nouveau hook checksums remain unchanged; Wi-Fi stays connected. Physical early-logo visibility and clean handoff require reboot validation.

### Withdraw same-terminal GRUB logo after cold-boot failure
- User observed no standalone logo, about nine seconds before Plymouth and renewed display corruption. Static configuration checks did not predict this physical failure.
- Restored distribution GRUB theme and removed the logo/paint-flush layer; disabled installation of this experiment while retaining --restore.
- Preserve signed Broadcom module, initramfs and early Nouveau hook. Physical clean-boot confirmation remains necessary; delay is unresolved.

### Event-driven application integrations
- Added a shared registry/dispatcher for supported native and Flatpak apps, refreshed at login and package export changes. No polling and no monitoring of its own launcher writes.
- Firefox Flatpak native menus now get required libraries, the registrar permission, XWayland and a managed preference block. System-style titlebar replaces Firefox's own window-control layout. Original profile content and launcher/permission backups retained.
- Verified actual Firefox File/Edit/View/History/Bookmarks/Tools/Help export in an isolated profile; user confirmed the result. Shared service also applies the existing native Brave adapter. Unsupported apps remain unchanged rather than receiving fake menus or indiscriminate flags.
- Wired the integration installer into desktop setup and documented scope, updates and rollback in APP-INTEGRATIONS.md.

## Toolkit-wide application integration

- Add native GTK module installation, real GMenu/GAction reader and capability-based Qt Flatpak preparation.
- Watch system/user app installations with input fingerprinting, no resident polling or repeated self-write loop.
- Include fresh Firefox profile preparation, dependency preflight, shared installer and guarded rollback.
- Verify a newly installed Mousepad export and existing VLC native menus; document unsupported custom UI honestly.

## Apps, Dock spacing and notification cards

- Apps uses five columns, including keyboard navigation across partial rows. A heading-free suggestion row combines up to two newly detected installations with GNOME's most-used apps; a divider separates the complete catalogue. Install history starts with an existing-app baseline, so package updates are not mistaken for new installs. No independent usage tracking is enabled.
- Hide the native favorites/running separator actor, removing its layout gap while preserving the Downloads/Trash divider.
- Notification empty state has its own card. Remove forced full-screen height so the calendar follows notifications; keep the existing right-edge animation and native notification actions.
- Focus/Do Not Disturb popup shares the light status-popover palette and compact row spacing.
- Reference: Apple's Apps browsing view includes suggestions and categories (https://support.apple.com/en-ie/guide/mac-help/mh35840/27/mac/27). The exact new/frequent selection rule here is FamiliarMac's user-requested policy, not a claim to reproduce Apple's private ranking.

## Empty-card alignment and logout cleanup

- Expand the GNOME notification placeholder across its parent width, matching sibling date/calendar cards; restore native alignment on disable.
- Logout journal exposed Downloads disposing an already-destroyed St.Bin. Track sibling destruction, clear its reference and make cleanup idempotent; remove popup-manager references before destroying menus.
- This repairs the observed extension teardown error, not a proven cure for the corrupt display frame. At 15:15 logout no new Nouveau reset was logged; an earlier 15:08 Xwayland CTXSW_TIMEOUT and missing nve7 video firmware are a separate finding. Drivers, GRUB, early KMS and Wi-Fi were not changed. Physical logout comparison remains required.

## System appearance for custom status surfaces

- Wi-Fi, Sound, Battery, Control Center, Focus and notification cards now follow `org.gnome.desktop.interface color-scheme` at startup and on change. Light/dark palettes cover text, cards, dividers, symbols and slider tracks; active controls retain blue accents and white handles. No theme polling or input/graphics changes.
- Reference behavior: [Apple Appearance settings](https://support.apple.com/en-euro/guide/mac-help/mchlp1225/27/mac/27). Colors are a Linux adaptation, not extracted Apple assets.
- New Shell JavaScript takes effect after the next login; subsequent appearance changes update live.

Native keyboard-brightness detail menus use the same appearance palette, compact inset and blue slider/white handle; the nested slider background is removed.

## Local typography and Apps content allocation

- Apps overrides the inherited modal content margin (32px/40px) and 28em maximum width. Five columns now have the intended content budget instead of clipping the fifth behind the scrollbar. Other dialogs retain their own layout.
- Login time prefers SF Rounded, matching the user's `home-assistant-legacy-panels` Tessera clock. Shell and GDM prefer locally installed SF Pro Text with Inter fallback.
- Optional `sudo bash scripts/install-local-fonts.sh /path/to/fonts` imports locally supplied fonts and rebuilds GDM styling; `python3 scripts/apply-local-typography.py` applies UI settings with a saved settings backup (`--restore` reverses these settings). No Apple font binaries or automatic downloads are distributed by FamiliarMac. Obtain and use fonts under their applicable terms: https://developer.apple.com/fonts/ . The public installer remains usable with Inter.
- Font source reference: `kilinccagatay/home-assistant-legacy-panels`, commit `ec63cb64401dc4d5e8b6266589d79d2cfe40438e`, `examples/panel-v2/tessera.css`. Its local SF Rounded weights are used only on this user's machine.
- Boot/logout visual corruption remains unresolved: early Nouveau is still active, GRUB logo experiments remain removed, and the current mux snapshot has NVIDIA driving the internal display. The earlier Dock disposal fix does not establish a graphics fix. Old Plymouth traces predate the latest report; collect a new boot trace before selecting another workaround.

## Smooth Focus indicator layout

- Focus visibility changes animate allocated width and opacity over 180ms, moving adjacent panel items gradually. Initial login layout and disabled animations update immediately.
- Rapid toggles cancel previous transitions; teardown cancels animations before destroying the button. No polling, global input layer or panel reordering is added.
- Regression tests cover interrupted transitions, completed hiding and disabled animations. New Shell code loads at the next login.

## Dock context menus and login date/font correction

- Dock context menus distinguish stopped and running apps. Stopped apps show Options/Open; running apps show real window titles and desktop actions, Options, window previews, Hide and Quit. Options opens a compact side menu for pinning, login startup and revealing the desktop launcher in Files. Finder remains pinned and has no Quit entry. Virtual locations retain their existing menus.
- Dock menu colors follow the desktop light/dark preference; compact padding is scoped to these menus. Per-icon hooks are restored when disabled and flyout modal grabs are closed with their parent.
- Login date names now follow LC_MESSAGES (UI language) rather than LC_TIME (regional format). The clock remains HH:MM.
- Diagnosed the clock font fallback with Pango: Fontconfig listed the local WOFF font but Pango loaded Noto Sans. The opt-in font installer now unwraps WOFF1 to desktop SFNT format, retaining its tables and recalculating the checksum. Pango now loads the local SF Rounded font. No proprietary font binaries are included in the repository.
- The installer accepts NODE for environments without node in the system PATH. Login styling/layout was rebuilt without restarting GDM. These changes require a new session for visual verification.

## Dock cascading-menu dismissal and alignment

- Options overlaps its parent by 6 logical pixels, with its first row aligned to Options. Placement flips left or clamps vertically at the work-area edge and scales with display scaling.
- One outside click, touch or Escape closes the flyout and parent, releasing the inner native grab first. Clicks within the flyout retain normal behavior; no global input surface or handler is added.
- Tests cover all three dismissal inputs, inside clicks, overlap geometry and screen-edge placement. New JavaScript loads next session; physical visual verification remains pending.

## Dock submenu ancestor highlight and visible overlap

- Keep Options subtly gray while its child menu is open, with distinct light/dark colors; clear the state when either menu closes.
- Remove inherited content margins only for Dock context menus. WhiteSur added 12px side margins that obscured the intended 6px overlap.
- Regression coverage includes state cleanup, single-click/Escape dismissal and overlap at 1x/2x scale. Full tests passed; visual verification requires a new session.

## Apps list alignment and persistent suggestion grid

- List rows fill available width with left-aligned icons and names instead of centered content.
- Suggested/recently installed apps retain the five-column tile row in both views; only the main application collection switches to a list.
- Up/down keyboard navigation follows the mixed rows. Tests cover both view modes and suggestion/list layout; full suite passed. Installed JavaScript takes effect next login; live visual verification remains pending.

## Correct deferred-console initialization experiment

- Found the earlier clear-only hook ran without triggering fbcon takeover; Linux 6.17 ignores erase-only dummy-console output.
- Use an invisible black-on-black non-space glyph followed by clear, before Plymouth; report actual bound status with a bounded check.
- Add reversible repair installation and isolated fixture tests. No driver/Wi-Fi/GRUB changes in repair mode. Boot/logout visual confirmation remains pending.

## GDM font-family parsing repair

- GDM logged “Couldn't parse family in font property” despite installed SF desktop fonts. GNOME 46 st-theme-node.c rejects a quoted family after the first family in a list.
- Keep the dotted clock family quoted, use bare fallback names, and apply the same correction to the SF Pro Text shell declaration. No font binaries are redistributed.
- Rebuilt and inspected GDM resource CSS. No GDM restart or boot/input configuration changes. New greeter appearance still needs visual confirmation.
- Parser reference: https://github.com/GNOME/gnome-shell/blob/46.0/src/st/st-theme-node.c (font_family_from_terms).

## A1398 About page

- Apple menu opens `gnome-control-center system about`, not the System overview.
- Original scalable A1398 illustration replaces only the About-page picture through a user-scoped GResource template overlay; real OS/hardware fields remain native. Applies only to A1398 DMI models.
- Desktop launcher uses the wrapper; a Settings binary hash guards the overlay on upgrades. Re-run `python3 scripts/install-about.py` after a compatible update; `--restore` removes the adaptation and restores the previous launcher.
- Existing Settings processes must close before the overlay loads. Apple menu JS loads next login. Full existing suite passed; isolated Settings launch accepted the overlay without template errors. Visual validation remains pending.
- Design reference: Apple Early 2013 Retina 15-inch technical specifications, https://support.apple.com/en-gb/118465 . SVG is an original FamiliarMac drawing, not an Apple image copy.

## Compact top-right notification banners

- Native GNOME notification tray is aligned to the right with 340px cards, modest edge spacing, rounded corners and system light/dark palettes.
- Queue, DND suppression, actions, close controls and native animation remain unchanged; no additional input surface or polling. Alignment and styles restore on disable.
- Full tests passed including tray-state restoration. Installed for next Shell login; live visual confirmation remains pending.


### Spotlight arithmetic

- Calculator results appear before app/file/settings matches, without executing search text or starting a subprocess.
- Supports addition, subtraction, multiplication, division, parentheses, powers (`^`), unary signs and postfix percentages (`15% = 0.15`). Both comma and dot are decimal separators, including mixed input (`52,5 + 52.5 = 105`); thousands separators are not supported.
- Results use regional number formatting, up to 12 significant digits. Enter or clicking the result copies it to the clipboard. Invalid/incomplete expressions and non-finite results do not produce a calculator result.
- Parser and search-to-clipboard integration tests passed. Installed Shell JavaScript takes effect at next login; live visual validation remains pending.

### Spotlight position and toggle correction

- Keep the search card at 20% of the active monitor height using a translation independent of St theme margins, so showing results does not reset its top offset.
- Handle Super/Command+Space inside the search modal to close it on the second press; ordinary Space still types normally. The desktop shortcut continues to open it.
- Search/clipboard and modal shortcut regressions pass. Installed for next login; actual screen placement still needs session validation.


### GitHub Actions test dependencies

- Install GJS and D-Bus explicitly on the clean Ubuntu runner before testing. Recent runs stopped at the GMenu integration test because `gjs` was missing, after earlier tests had passed.
- Fail early with an actionable dependency message for local test environments too; no tests are skipped.

### About illustration launch-path correction

- Route FamiliarMac System Settings, Wi-Fi, sound, battery, display, notification and Spotlight settings actions through the same guarded launcher used by About This Mac. Previously opening Settings through these routes first created a native process without the About resource overlay; later About requests reused it.
- Add a reversible user D-Bus activation service for Settings so native desktop activation also uses the launcher. Existing service overrides are backed up and restored. No system package files are replaced.
- Correct the About GtkPicture property from invalid `filename` to `file` with a file URI. The invalid property caused the entire native About template to fail once the launcher was actually used. Verified the installed picture using the real GTK4 builder (320px SVG paintable), and reopened the native About page with no template errors in its log.
- Redrew the original A1398 SVG against Apple's Early 2013 15-inch Retina reference, correcting the black glass bezel, 16:10 panel and thin, level silver base. Reference: https://support.apple.com/en-gb/118465 . The repository contains our vector illustration, not Apple's product photograph.

### Settings Dock shortcuts

- The Settings Dock context menu now lists installed GNOME settings panels alphabetically, both while Settings is running and while closed, followed by normal Dock options.
- Names come from localized desktop entries; version-specific subpage arguments (including System → About) are preserved. Actions use the guarded Settings launcher. macOS-only services are not fabricated.
- Parser and stopped/running menu activation regressions passed; installed for next login.

### Application-aware menu shortcuts

- Show actual exported DBusMenu/GMenu accelerators as right-aligned subdued Apple symbols. Preserve GTK `accel`/`x-gtk-accel` metadata and app-specific overrides rather than guessing shortcuts from labels. Terminal Ctrl+C remains Control-C; its configured Ctrl+Shift+C equivalent is shown as Command-C. Synthetic terminal Copy/Paste actions also use the existing terminal mappings.
- Add conflict-checked Apple menu bindings: Control-Command-Q locks, Shift-Command-Q opens logout confirmation, Option-Command-Escape opens the existing force-quit/process manager. A failed accelerator grab keeps the existing owner's binding and omits the hint. Disable releases only owned grabs.
- The three explicit keyd translations separate Command from Control; existing keyboard/touchpad mappings remain intact. The incremental installer backs up and merges the running profile. No destructive Power/Restart shortcuts are added, nor shortcuts invented for About/System Settings.
- Local parser, exported-action, collision/cleanup and real keyd tests passed. Installed Shell changes activate at next login; live keyboard/UI validation is still required.
- Apple reference: https://support.apple.com/en-us/102650 . Menu hints reflect the shortcuts implemented on Linux, not an assertion that every macOS-only command is supported.

### Equal pinned/running Dock gaps after redisplay

- Keep the native favorites/running separator hidden when Dash reparents or shows it during icon updates. The previous one-time hide allowed an invisible separator to re-enter BoxLayout and add a second gap.
- Preserve the existing pinned-icon spacing; the Downloads/Trash divider is unchanged. Restore the separator's prior visibility and reparent behavior when disabled. No new polling loop.
- Redisplay/re-show and cleanup regression tests pass; installed for next login, with visual spacing confirmation still pending.

### Lock/unlock extension recovery

- Fixed the desktop-to-Dock trash installer shadowing Zorin's built-in desktop extension UUID. Zorin 46 skips user copies of mode extensions; its loader leaves an undefined entry in the initialization list. The rejected initialization promise then prevents normal extension restoration after unlocking.
- The patched desktop extension now has its own `familiarmac-desktop-icons@local` identity. The installer selects a single desktop owner, retains the upstream package, checks managed-file hashes and keeps a recovery copy outside extension discovery. Restore removes the managed copy and restores the original desktop selection.
- Existing installations need one new login after migration to clear GNOME's rejected initialization promise and discover the new extension. Dock/menu recovery in the current session does not itself clear that cached promise. Lock/unlock and suspend/resume still require live verification after the new login.

### Dock Trash and application indicator menus

- Trash has only Open and Empty Trash (disabled when empty); it no longer inherits app-launch/GPU actions or running indicators.
- Desktop drops use the GTK source's actual NO_TARGET release and the mapped Trash icon's transformed bounds. They no longer depend on Mutter's Xdnd enter/position events or picking through the drag image. Cancellation and drops outside the icon leave files untouched.
- Files move to Trash asynchronously, never permanently delete. The installed sound theme's `trash-empty` event plays only after every selected file finishes successfully, when `canberra-gtk-play` is available. This is the system sound, not a bundled Apple audio asset.
- All StatusNotifier/AppIndicator popups share FamiliarMac's compact Dock-menu styling and system light/dark preference. App-defined actions and labels are preserved; newly appearing indicators are handled through actor events, without polling.
- Regression tests cover Trash's first menu opening, empty state, hidden/off-target drops, cancellation, completion-only sound, newly added tray apps and cleanup. Live drag/drop and visual verification require the updated Shell code to load in a new login.

### Verified Wayland desktop-to-Dock Trash drop

- Live testing showed GTK reports `Gtk.DragResult.ERROR` (5), not `NO_TARGET`, when releasing a desktop file over this Wayland Dock. Accept that release path only after checking the visible Trash target; explicit user cancellation remains excluded. The Shell bridge also rejects a still-held primary button.
- On 16 November 2026, a disposable desktop text file was dragged to the Dock by the user: its original disappeared and its file appeared in the user's Trash. The user also confirmed hearing the completion sound. No personal files were used or permanently deleted.

### Spotlight placement and nested corners

- Make the inner Spotlight card participate in Clutter BinLayout expansion so its top alignment is honored. The 20% screen-height offset is no longer added to a vertically centered allocation; result growth preserves the top anchor.
- Match result-card corners to the outer 24px radius and 8px inset (16px inner radius). Applies to calculator and all search results.
- Layout setup, nested radii, calculator selection, outside-click dismissal and Super+Space toggle regression checks pass. Actual Shell placement was verified in the published desktop screenshots.

### Investigate idle Wayland session crash

- Preserved the 16 November 18:54 CET Nouveau context-switch timeout and Mesa segfault evidence. Earlier Xwayland render-target traps predate the latest Spotlight edit; an extension trigger has not been established.
- Found and installed missing GK107M video firmware using Nouveau's documented extraction route. A targeted installer verifies all ten hashes, refuses conflicting destination files, checks the GPU/driver and records installed files. No firmware blobs are distributed.
- Installation was verified on disk. No driver/kernel/network/boot configuration changed and no active module was reloaded. Video-engine retry and long-term crash resolution still need validation; this is not a confirmed fix for the entire crash chain.

### Spotlight shortcut in modal mode

- Temporarily allow the registered search accelerator in SYSTEM_MODAL while Spotlight is open. Mutter intercepts registered shortcuts before the entry's captured-event handler, so handling Super+Space only on that actor was insufficient.
- Restore NORMAL-only scope on close, failed modal grab and destruction; other system dialogs do not gain a new Spotlight shortcut. Tests cover the scope lifecycle alongside calculator/input behavior.

### Dock activation during application shutdown

- Apply to all applications through the common Dock activation handler, not a Firefox profile or app-specific command.
- Send the open request immediately, including for background applications. Keep it pending until a real window appears; if shutdown swallowed it, retry once after the old process identities disappear and Shell reports STOPPED. A fixed 1.5-second delay no longer discards the user's request.
- Retain process start times across last-window removal to distinguish process exit from Shell window state and PID reuse. Coalesce repeated clicks, bound pending requests to 15 seconds, and remove timers/signals on disable. Never terminate a process or attempt to reverse its internal shutdown.
- Regression tests cover immediate background activation, delayed exit, duplicate clicks, PID reuse, existing startup and cleanup. Live close-and-reopen behavior requires the updated extension in a new login.
- User confirmed Spotlight opens and closes with Command+Space after the previous fix.

### Native file drops onto Dock Trash

A GTK3 Xwayland drop receiver accepts local `text/uri-list` file drags from file managers and other applications. It appears only during external file drags and follows the actual mapped Trash actor bounds every 100 ms while dragging; Dock growth and icon relocation do not use fixed coordinates. The desktop fallback remains unchanged. Files move through GIO Trash, never permanent deletion; completion sound runs only after all files succeed. The user confirmed file-manager drops and completion sound on GNOME 46. Requires GTK3/PyGObject and Xwayland.

### Keyboard brightness detail

Keyboard brightness now uses the same compact light/dark surface and blue slider with white handle as Sound. The native backlight slider (or discrete levels on supported hardware) is reused and restored when closed; hardware bindings are retained. The old nested Quick Settings submenu is not opened for this view. Automated lifecycle and detail-routing tests pass; the compact keyboard detail was also verified on the running desktop.

### Explicit status-menu activation

Right-panel status menus no longer switch on pointer hover or focus traversal. Clicking a different status button still uses GNOME's existing exclusive popup manager to close the previous menu and transfer the input grab. Outside-click dismissal and Escape remain native. Application-menu hover behavior is unchanged. Regression tests cover status/left-menu boundaries and conditional restoration on disable.

Status-menu clicks now explicitly dispatch to the hit-tested live panel button before the old popup consumes the event. A single unmodified primary press or touch closes the old popup and activates the requested one; clicking its current source only closes it. Hover, off-panel input and Command-drag rearrangement are excluded. Coordinate bounds are read from the current actor on each press. Automated transfer tests pass; live verification is pending a new login.

The MOVE-only cursor experiment was reverted after the user reported broken drops. Native Trash again accepts both COPY and MOVE negotiation, preserving compatibility with COPY-only sources; GIO still performs the actual trash operation and source-side deletion remains disabled. The final fix retains COPY/MOVE acceptance but explicitly responds MOVE to the bridge’s suggestion. The user confirmed the + badge is gone and both trashing and sound work.

### Screenshot gallery update

Added actual desktop captures of Spotlight application search, arithmetic results, the five-column Apps grid and dark Control Center. Both READMEs link to the bilingual gallery and show the calculator alongside the existing About illustration screenshot. No chat content appears in the new captures.

Expanded the screenshot gallery with Wi-Fi, Sound, keyboard brightness, three hardware OSDs, Notification Center, the system power menu and restart confirmation. Network/account names are visibly redacted; OSD images are cropped below the top bar. The actual GDM login-screen capture remains pending.

### Feature close-ups on the repository homepage

Both READMEs now show cropped feature previews for Dock, About, Apps, Spotlight search/calculator, Control Center, notifications, Wi-Fi/audio, keyboard brightness, hardware OSDs and power dialogs. Each preview links to its full reviewed screenshot. `scripts/build-screenshot-details.py` reproduces the crops without altering source captures.

### Actual login-screen capture

Added the real GDM greeter to both README pages and the screenshot gallery. Account name is redacted. A user-approved temporary screenshot permission was reverted after capture; the original locked setting was verified restored. No boot, graphics, Wi-Fi, or authentication configuration was retained from the capture.

### Single clock on the login screen

Hide the redundant top-panel clock only in the GDM greeter, retaining the large login clock and accessibility/network/power controls. Normal desktop and lock-screen clocks are unchanged. The login overlay installer includes this change for fresh installations.

### Global-menu screenshots

Added real Firefox and Files/Finder captures with File menus open in the top bar. Both READMEs include detail crops linked to the full gallery images.

### Login-style unlock screen

Added a separate GNOME 46 extension for user and unlock-dialog session modes. It places an HH:MM clock and UI-language date above the native password prompt, uses the login appearance, hides the redundant panel clock while locked, and reserves room for the on-screen keyboard and notifications. Native authentication and modal grabs remain unchanged; disabling restores the original layout. Fresh desktop installations enable this extension too. Geometry and existing regression tests pass; visual verification after a new login is pending.

### Duplicate unlock clocks

Keep the native clock labels hidden independently of their parent transition animation. Guard the panel clock against late visibility changes and scope the CSS fallback to the unlock screen. Restore prior desktop visibility when leaving lock mode. Regression tests cover late panel rebuilds and restoration.

### Shared Flatpak controls, theme access and Chromium integration

Fixed the installation gap exposed by Chrome and Blanket. Shared GTK3/GTK4 styles now reach every installed Flatpak and later installations through the existing event watcher. Theme files are exposed read-only; the menu registrar permission is shared. Added a reversible Chromium-family launcher/profile adapter and regression coverage for fresh profiles, locked-profile safety, CSS preservation and restoration. Live-checked Chrome dark appearance/menu/decorations and Blanket/Eyedropper GTK4 controls. Existing Wi-Fi, boot and graphics configuration is unchanged.

Control size follow-up: shared fixed-size 14px SVG backgrounds replace allocation-dependent GTK controls. Measured Eyedropper at 28×28 physical pixels on the 2x display, matching the existing ChatGPT/system buttons.

Spacing verification: GTK4 controls use 22 logical pixels center-to-center. Live Eyedropper capture measured 28px diameter and 44px centers at 2x, matching ChatGPT.

GTK4 header bars use a compact 32px minimum height, with centered titles and controls; verified in Eyedropper after restart.

### Repeatable application integration verification

- Added an opt-in sequential visual audit with a memory reserve, private reports,
  explicit normal-closure confirmation and separate launch/visual outcomes.
- Added an empty-home test of the real component installer, repeat installation,
  copied CSS/SVG/runtime assets and watcher-first restore ordering.
- Fixed restore ordering so application installation watchers stop before
  Chromium launchers are restored.
- Documented how another supported machine installs the shared rules and repeats
  checks without copying this user's profiles or home-directory configuration.
