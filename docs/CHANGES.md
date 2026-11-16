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
