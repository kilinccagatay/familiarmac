# Application appearance audit — 2026-11-16

Scope: 98 visible desktop launchers on the development machine were inventoried and attempted or inspected in their existing windows. Applications were handled sequentially. This is an appearance audit, **not a claim that all 98 apps or all features passed**. First-run dialogs, stale launchers and unavailable windows are recorded below. No account setup, project import, driver change or OS upgrade was performed.

The shared header correction was rechecked in Contacts, Characters, Settings, Terminal and Blanket. ChatGPT remained open to preserve the active conversation. Private full-screen captures are not included in the repository.

Remaining distinct issues: LibreCAD uses its own Qt Wayland decoration; Logseq uses HTML window controls; Blender showed corrupted glyphs and a Mesa Vulkan warning. These are not repaired by the GTK header CSS. Panel menu allocation updates require the next normal GNOME login.

| Launcher | Observation |
|---|---|
| `alacarte.desktop` | Title fits, normal close; settings unchanged. |
| `app.drey.Warp.desktop` | Dismissed welcome sheet; empty Send File page fits with compact controls. No transfer started; global app/Window/Help only, full command coverage unverified. |
| `be.alexandervanhee.gradia.desktop` | Start screen inspected: centered full title and compact controls. Global app/Window only; editor command coverage remains unverified. No existing image edited. |
| `brasero.desktop` | Title fits in maximized window; no disc operation. |
| `brave-browser.desktop` | Main window and global menus inspected; shared GTK3 spacing applies on next launch. |
| `chatgpt.desktop` | Existing conversation window inspected; not restarted to preserve active work. |
| `com.github.finefindus.eyedropper.desktop` | Reopened normally: title fits, controls match; stale render corruption cleared on app restart. |
| `com.github.johnfactotum.Foliate.desktop` | Empty library inspected: sidebar title and compact controls fit. Global Foliate/Window/Help exists but full reader/local-menu coverage remains unverified; app menu Settings is disabled. No book imported. |
| `com.github.phase1geo.minder.desktop` | Stale launcher: Flatpak not installed; current io.github ID remains to test. |
| `com.github.wwmm.easyeffects.desktop` | Title fits; stopped background service with documented --quit after normal close. |
| `com.github.xournalpp.xournalpp.desktop` | Main document title fits, controls match; empty document closed. |
| `com.google.Chrome.desktop` | Main title/controls and global menus visible; no profile edits. |
| `com.logseq.Logseq.desktop` | Custom Electron HTML controls on right; own light theme. Not covered by GTK rule; no graph opened. |
| `com.obsproject.Studio.desktop` | Main editor rechecked after login: real global menus and full top-level labels visible; File menu and Quit shortcut inspected. No recording/streaming started. |
| `com.odnoyko.valot.desktop` | Own custom header without window controls; title labels fit. |
| `com.rafaelmardojai.Blanket.desktop` | Reopened after fix: complete centered title and compact controls. |
| `com.zorin.desktop.upgrader.desktop` | No-upgrades screen title fits; closed, no upgrade performed. |
| `de.haeckerfelix.Fragments.desktop` | Empty download view: centered title, compact controls and dark appearance fit. Global View menu exposes Show Preferences/Show Stats with aligned rows; shortcut hints absent. No transfer started. |
| `fr.free.Homebank.desktop` | Normal Flatpak launch verified after shared GTK3 integration: actual File/Edit/View/Manage/Transactions/Reports/Tools/Help menus exported and local menubar removed. File popup labels, Open Recent arrow and muted New/Open/Save As/Import/Quit shortcut hints aligned. Blank document only; normal quit. No app-specific patch required. |
| `fr.handbrake.ghb.desktop` | Main window and global File menu inspected without loading/encoding video. Title/buttons fit; global menus export, but local menubar remains duplicated and File shortcut hints are missing. These remain compatibility gaps; no blanket local-menu hiding applied. |
| `gimp.desktop` | Blank image checked: full top-level names now fit; File popup rows align. Native GMenu omits accelerators; read-only shortcutsrc v1 adapter added and tested for saved defaults, overrides/unbindings and collisions. Visual hints pending next shell load. User requested panel-only GIMP name alias; installed, pending next shell session. |
| `gnome-language-selector.desktop` | Title fits; no language changes. |
| `gnome-session-properties.desktop` | Title fits; normal Close, no autostart changes. |
| `gufw.desktop` | Firewall title fits; settings untouched, normal WM_DELETE_WINDOW. |
| `install-zorin-windows-app-support.desktop` | Opens Software catalog; no package installed. |
| `io.github.OpenToonz.desktop` | Main blank scene verified with user: full exported menus, actual shortcut hints and aligned submenu rows. Native Windows plus synthetic Window duplicate found; shared singular/plural detection now fixed, pending next shell load. |
| `io.github.alainm23.planify.desktop` | Main Inbox and local menu inspected: title/controls fit. Local Preferences (Ctrl+,), Summary & Productivity and Keyboard Shortcuts (F1) are not represented by global Planify/Window menus. Menu coverage gap confirmed; no task edited. |
| `io.github.phase1geo.minder.desktop` | Main title fits; blank startup dialog dismissed. |
| `io.github.revisto.drum-machine.desktop` | Centered main title fits, own accent retained; closed without playback. |
| `io.gitlab.news_flash.NewsFlash.desktop` | Selected local RSS mode without adding a feed/account. Empty main view and Discover dialog titles/controls fit; global File Import/Export OPML rows align. Full local action coverage and shortcut hints not verified. |
| `io.gitlab.theevilskeleton.Upscaler.desktop` | Shared controls match; no header title by app design. |
| `librecad.desktop` | Main editor title fits; Qt Wayland frame remains light and standard buttons (separate toolkit issue). |
| `libreoffice-calc.desktop` | Main blank spreadsheet: title fits and controls match; normal close. |
| `libreoffice-draw.desktop` | Main blank drawing title fits; normal close. |
| `libreoffice-impress.desktop` | Main blank presentation and template chooser: titles fit; chooser dismissed, normal close. |
| `libreoffice-startcenter.desktop` | Main title fits; normal close. |
| `libreoffice-writer.desktop` | Title fits; shared controls visible; blank document closed without edits. |
| `net.scribus.Scribus.desktop` | Blank document checked; exported File rows align and actual shortcut hints are muted gray. Native Windows plus synthetic Window duplicate found (same as OpenToonz); shared singular/plural detection fixed, pending next shell load. Normal quit. |
| `nm-connection-editor.desktop` | Title fits; inspected connection list only; settings unchanged. |
| `org.ardour.Ardour.desktop` | Main editor verified with user. EXCEPTION: bundled YTK (libytk/libytkmm), real menus remain inside the app. Preserve the adjacent I/O, DSP, sample-rate and recording-time indicators; do not hide the whole row. Deferred by user; no menu adapter applied. |
| `org.audacityteam.Audacity.desktop` | Shared GTK3 Flatpak module verified after normal launch: real menus move to the panel, local menu bar disappears, File submenu rows and actual muted shortcut hints visible. Initial plugin scanner VST child crash was separate; no claim that audio/plugin functionality has been tested. |
| `org.blender.Blender.desktop` | Own drawn chrome, corrupted glyphs on first-run UI; Mesa Ivy Bridge Vulkan warning. Closed with Ctrl+Q; no GPU changes. |
| `org.darktable.Darktable.desktop` | Title fits; app custom theme retained; closed without import. |
| `org.deskflow.deskflow.desktop` | Header fits. Background/tray process needed SIGTERM after normal close; no server/client started. |
| `org.familiarmac.Apps.desktop` | Five-column grid and search/header visible; dismissed with Escape. |
| `org.freecad.FreeCAD.desktop` | Startup completed; blank Part Design editor and native top-level menus visually checked. Window buttons/title fit. Same native Windows + synthetic Window duplication; shared fix prepared, pending next shell load. |
| `org.freedesktop.MalcontentControl.desktop` | Main header fits; no account setting modified. |
| `org.gnome.Calculator.desktop` | Basic view and global app popup inspected: controls/title fit. Global app popup falls back to disabled About/Settings and no calculator actions; menu export gap. No calculation history changed. |
| `org.gnome.Calendar.desktop` | Month view and global app popup inspected: sidebar header/controls fit, no events changed. Global app menu is limited; Settings disabled. Full local action/shortcut coverage not verified. |
| `org.gnome.Characters.desktop` | After shared fix: complete title; visually verified. |
| `org.gnome.Contacts.desktop` | After shared fix: complete title; visually verified. |
| `org.gnome.DejaDup.desktop` | Welcome screen and app popup checked: title/controls fit and exported Settings enabled. No backup/restore configured or started. |
| `org.gnome.DiskUtility.desktop` | Device list and app popup checked without selecting or modifying a disk: sidebar title/controls fit. Fallback app menu only; no native action export verified. |
| `org.gnome.Evince.desktop` | Generated one-page test PDF opened; compact controls fit, filename ellipsizes at initial narrow width. Local menu has Save As/Properties/Keyboard Shortcuts, but global panel only app/Window. Export gap; no user document touched. |
| `org.gnome.Evolution.desktop` | Main Mail window verified after user completed setup. Audited native profile enables real menubars and X11 export; normal generated launcher shows File/Edit/View/Message/Folder/Search/Window/Help. File popup alignment and muted actual shortcut hints verified; compact controls preserved. No mail actions tested. |
| `org.gnome.FileRoller.desktop` | Opened a generated 21-byte test ZIP: archive header/title and compact traffic lights fit; File/Window/Help exported. Closed normally; no user archive touched. |
| `org.gnome.GTK4ThemeSwitcher.desktop` | Title fits; no theme applied. |
| `org.gnome.Logs.desktop` | Main log viewer and app popup inspected: complete title/subtitle and compact controls. File menu present; shortcut coverage not yet verified. No logs changed. |
| `org.gnome.Maps.desktop` | World map and app popup checked: header controls fit. No location permission, search or route entered; global menu limited, Settings disabled. |
| `org.gnome.Nautilus.desktop` | Sidebar Files title fits; normal quit. |
| `org.gnome.NetworkDisplays.desktop` | Screen-share chooser cancelled; main header fits; normal close. |
| `org.gnome.PowerStats.desktop` | Read-only AC-adapter details and app popup checked: title/controls fit. No application actions exported; fallback menu only. |
| `org.gnome.Rhythmbox3.desktop` | Empty music library and local menu checked: compact controls fit. Preferences/Help and many commands exist in actual D-Bus action group but global panel only shows app/Window. Confirmed shared export gap; no playback/import. |
| `org.gnome.Screenshot.desktop` | Dialog title fits, normal quit. |
| `org.gnome.Settings.desktop` | After shared fix: complete title and unchanged control size. |
| `org.gnome.Shotwell.desktop` | Empty library checked without importing photos: complete global menu labels, aligned File rows and muted shortcut hints. Compact controls and centered title fit. Closed from File → Quit. |
| `org.gnome.Snapshot.desktop` | Camera main view opened briefly: compact controls fit. No photo/video capture performed; preview screenshot remains private and is not published. |
| `org.gnome.Software.desktop` | Main Explore header and controls fit after foregrounding; quit normally, no install/update. |
| `org.gnome.Solanum.desktop` | Idle timer screen inspected: compact controls; global app/Window/Help. No timer started; shortcut coverage not verified. |
| `org.gnome.SoundRecorder.desktop` | Empty recordings view and app popup checked: complete title, compact controls and dark colors fit. No recording started; shortcut coverage unverified. |
| `org.gnome.SystemMonitor.desktop` | Processes view and app popup inspected: tabs and compact controls fit; exported Settings enabled. No process changed; normal window close. |
| `org.gnome.Terminal.desktop` | After shared fix: measured 44 px control centers at 2× (previously 56 px). |
| `org.gnome.TextEditor.desktop` | Blank document main window and app popup inspected: centered title, compact controls and dark colors fit. File/Edit/Help menus present; app Settings disabled. Full command/shortcut coverage remains unverified. |
| `org.gnome.Totem.desktop` | Empty Videos view inspected: compact controls/tabs fit. Global menu limited; no video decoded or media imported. |
| `org.gnome.Tour.desktop` | Custom Zorin welcome screen checked; no conventional titlebar by design. Closed with No Thanks, no system changes. |
| `org.gnome.Weather.desktop` | Welcome screen inspected: compact controls. No location selected; global menu limited; forecast view remains unverified. |
| `org.gnome.World.Secrets.desktop` | Empty safe chooser inspected: compact controls. Global File only New Window while local Open remains available: window-command coverage gap. No safe created or opened. |
| `org.gnome.baobab.desktop` | Devices & Locations view and app popup checked: full centered title and compact controls; no disk scan started. App menu limited, Settings disabled. |
| `org.gnome.clocks.desktop` | World view and global popup inspected: compact controls fit, tabs unobstructed. Global menu limited to app/Window; Settings disabled. Window close leaves intentional background process; used exported quit action, no alarms edited. |
| `org.gnome.eog.desktop` | Generated solid-color PNG opened: full filename and compact controls fit. Actual D-Bus app actions include Preferences/Help/view toggles, but global menu only app/Window. Shared export gap confirmed. |
| `org.gnome.font-viewer.desktop` | Opened installed Arimo font file: centered title/subtitle and compact controls verified. No font installation or removal. |
| `org.gnome.gitlab.somas.Apostrophe.desktop` | Blank editor title/controls fit. Global File contains only New Window, while actual window D-Bus action group exports open/save/find and other commands. Ctrl+F successfully opens find bar; no document edited, app closed normally. Window-action export and shortcut-display coverage remain incomplete. |
| `org.gnome.seahorse.Application.desktop` | Narrow 600px content width caused repeated HdyLeaflet layout oscillation (sidebar 252/344px); user observed flicker and missing controls. Audited Seahorse 43 overlay sets default width 810 and minimum request 740. Normal relaunch plus 200 AT-SPI samples stayed fixed; controls returned. User subsequently confirmed that the visible resizing stopped. Version/resource/binary guards, update watcher and restore included. This is a constrained layout workaround, not a libhandy-wide fix. |
| `org.inkscape.Inkscape.desktop` | Created blank document from welcome screen: full Inkscape and Extensions labels fit, File rows and Open Recent arrow align, real muted accelerator hints visible. Injected Ctrl+Shift+D opened Document Properties successfully; no property edited. Dialog temporarily reports Finder in panel (ownership gap). Closed dialog and unchanged document normally; physical Command key not independently tested. |
| `org.kde.kdenlive.desktop` | Rechecked after login with a blank project: full panel menu labels, aligned Open Recent row and muted exported shortcut hints visually verified. |
| `org.kde.krita.desktop` | User-created blank document checked: complete exported top-level labels and aligned window controls. Actual D-Bus accelerators include New/Open/Save/Save As; app menu Quit hint visible. Full File popup alignment not visually verified. Closed without saving the blank test document. |
| `org.mixxx.Mixxx.desktop` | BLOCKED: repeat launch exported top-level menus, then became unresponsive. At 22:48:58 CET Nouveau reported a PTE write fault on the GNOME Shell channel; Shell segfaulted in host libgallium 25.2.8 and the session ended. Mixxx causality unproven; do not repeat launch during ordinary audit. No GPU/boot settings changed. |
| `org.mozilla.firefox.desktop` | Main title/controls and global menus visible; no profile edits. |
| `org.remmina.Remmina.desktop` | Main header fits, quit with documented --quit; no remote connection opened. |
| `org.videolan.VLC.desktop` | Empty main window inspected: full exported top-level menus and aligned Media popup with muted real shortcut hints. Injected Ctrl+O opens file chooser (underlying shortcut represented as Command by keyboard mapping); chooser cancelled, no media opened. Physical Command key not independently tested. Portal chooser temporarily shows Finder panel identity, a separate ownership gap. Compact window controls fit; app closed by its own close button. |
| `org.xfce.mousepad.desktop` | Blank document inspected: compact controls and full title fit, File/Edit/Search/View/Document/Window/Help exported. File popup aligned but New/Open/Save/Quit accelerator hints absent. Injected Ctrl+F successfully opens the find bar; dismissed and closed unchanged document. Shortcut display gap, not a failed Find binding; physical Command key not independently tested. |
| `simple-scan.desktop` | Scanner-discovery screen inspected: full centered title and compact controls. No scan started; no scanner available for document-state checks. |
| `software-properties-gtk.desktop` | Title fits, wide GTK3 control spacing like Terminal; sources/drivers unchanged. |
| `update-manager.desktop` | Check-only progress title fits; process exited, no installation triggered. |
| `webapp-manager.desktop` | Header title/subtitle fit; normal close. |
| `yelp.desktop` | Title fits; normal header close. |
| `zorin-appearance.desktop` | Title fits; no preferences changed. |
| `zorin-connect.desktop` | First-run pairing wizard title fits; closed without pairing. |

### Electron shortcut metadata

ChatGPT supplies real accelerators, but the Electron bridge previously dropped
this field. The shared bridge now exports explicit accelerators and, where
available, Electron's own role defaults as D-BusMenu `aas` shortcut metadata.
It does not assign bindings or infer them from translated menu labels. Existing
panel formatting provides muted Apple-style hints. Fresh installations include
this automatically; existing integrations can run
`sudo bash scripts/update-electron-menu-bridge.sh` and restart the application.
Parser and real D-Bus tree/activation tests pass. User confirmed the ChatGPT
shortcut display works after restarting the application (2026-11-16).

### Follow-up — 2026-11-17

VLC, Inkscape and Mousepad no longer have launch-only audit records. The
follow-up used empty documents and cancelled dialogs, checking real popup
layout and representative underlying keyboard bindings, not merely launch
success. VLC Ctrl+O, Inkscape Ctrl+Shift+D, Mousepad Ctrl+F and Apostrophe
Ctrl+F were exercised successfully. Synthetic input bypasses the physical
keyd layer, so this does not independently certify hardware Command mapping.

VLC/Inkscape shortcut hints are present and aligned. Mousepad hints are
missing despite a working Find binding. Rhythmbox and Apostrophe still expose
commands through D-Bus that the panel does not fully display. Helper dialogs
in VLC and Inkscape temporarily fall back to Finder identity. These are open
compatibility issues, not passed checks. No menu or shortcut configuration,
GPU, Wi-Fi, boot setting, or user document was changed in this follow-up.

### Shared repairs prepared and live-backend verified — 2026-11-17

The above Mousepad, Rhythmbox and Apostrophe gaps now have a shared implementation:
Mousepad Open resolves to its saved `<Primary>o`; empty Rhythmbox GMenu falls back
to its real enabled Settings action; Apostrophe exports window Open/Save/Find,
and activating Find through the new model updates its checked state. These checks
ran against the actual applications in a separate GJS process, preserving the
running Shell. Dialog ownership and native-menu precedence pass isolated tests.
The installed panel UI still requires a normal login before visual re-verification;
these repairs are not yet marked as user-confirmed visual passes.

### Visual verification after normal login — 2026-11-17

- Mousepad: muted File shortcut hints now visible; clicking exported Open opens
  the actual chooser. Panel identity stays Mousepad while the chooser is open.
- Rhythmbox: exported Settings opens its Preferences dialog and the panel remains
  Rhythmbox. Missing commands are now available through the shared fallback.
- Apostrophe: File Open/Save and Edit Find are visible; clicking Find opens the
  actual find bar. Accelerator hints remain unavailable for this app because no
  supported binding source is exposed; this is not a full shortcut-display pass.
- VLC: original Media tree and muted hints preserved. Its Flatpak file chooser
  shows Portal, not VLC. A follow-up now prefers the actual transient owner over
  a separately tracked helper app, including org.gnome.Portal. Unit tests pass;
  visual validation of that follow-up still needs the next normal login. Do not
  mark ownerless portals as repaired or guess ownership from previous focus.
- Inkscape: full File menu and real hints remain aligned; Ctrl+Shift+D opens
  Document Properties, and panel identity stays Inkscape (no Finder fallback).

No user files were opened or saved; empty test windows/dialogs were closed normally.

2026-11-17 Apostrophe shortcut follow-up: shared static Python/GTK reader added;
14 real startup bindings read from the installed deployment without executing it.
Live model verifies Open/Save/Save As/Find/Find Replace/Quit. Conditional/dynamic
sources, conflicts and user-map precedence are guarded. Installed helper and
exact underscore action-ID lookup; full visual check pending normal login with
the VLC portal ownership follow-up.

### Second post-login verification — 2026-11-17

Apostrophe File and Edit menus now visibly display muted Open, Save, Save As,
Close, New Window, Find and Find Replace hints. This confirms the shared static
reader and exact underscore-ID lookup are loaded in the running panel.

VLC's chooser still displays Portal. A narrowly filtered, temporary D-Bus capture
of the actual backend FileChooser.OpenFile call showed app_id org.videolan.VLC
and parent_window x11:0. The missing usable parent handle explains why transient
ownership resolution alone cannot fix this case. Do not claim this issue fixed
or attribute an orphan dialog to the last focused app. No persistent monitor was
installed, and no Flatpak/Qt graphics or sandbox setting was changed.

2026-11-17 orphan chooser follow-up: generic Portal request ownership bridge
implemented and installed. Live request PID matched the actual chooser accessible
process; client resolver returned org.videolan.VLC.desktop, cancellation returned
an empty state. Generic IDs, wrong senders, replies, ambiguity and malformed-state
tests pass. Full regression suite passes. Panel visual test pending normal login;
no claim of visual success yet.

2026-11-17 Portal bridge post-login visual test FAILED: chooser still labels
Portal while GetState contains the correct org.videolan.VLC request and backend
PID. The bridge is active; panel consumption/owner gate needs diagnosis. Do not
mark the UI fixed based on bridge-only tests.

2026-11-17 Portal ownership visual verification PASSED after root-cause fix:
Meta reported the GNOME Shell PID for the portal's inherited Wayland socket,
while D-Bus reported the backend PID. Added a generic guarded compositor-socket
match: exact backend executable/window class and title, unique window/request.
No VLC-specific mapping or last-focused-app fallback. Loaded the installed
resolver into the running owner instance without restarting Shell. The open VLC
chooser visibly showed “VLC media player”; cancelling cleared GetState to [],
and native Media menu/shortcut hints were visually verified afterward. Full
regression suite passed. Wi-Fi, graphics, boot and sandbox settings untouched.

### Sequential menu/shortcut follow-up — 2026-11-17 01:10–01:17 CET

Eight lightweight applications were checked individually in the live desktop.
Only the existing generated PNG/PDF/ZIP audit fixtures were used; no personal
file, safe, task, preference or system configuration was changed. Test windows
were closed normally. Captures remain private under /tmp/fm-audit-*.

| Application | Visual and interaction result | Remaining gap |
|---|---|---|
| Image Viewer (eog) | File/Edit/View/More now exported. Global Settings opens Preferences; owner remains Image Viewer. Ctrl+O opens chooser with correct owner. | File accelerator hints absent. |
| Text Editor | Blank document and compact controls fit; Ctrl+F opens actual find bar. | File only New Window, Edit only Clear History: native partial menu omits useful window actions and their hints. |
| Document Viewer (Evince) | Generated PDF; File/Edit/View/Tools/More visible. Ctrl+F opens search. | File hints absent. Clicking Properties in exported File menu did not open a dialog, including after waiting; activation needs diagnosis, not a passed menu check. |
| Calculator | Global Settings opens actual Preferences and owner remains Calculator; Edit exports Copy/Undo/Redo/Paste. | No accelerator hints in inspected Edit menu; complete binding coverage unverified. |
| Logs | File exports New Window/Close/Export; Ctrl+F opens search. | File accelerator hints absent. No export or log modification performed. |
| Secrets | Ctrl+O opens Select Safe; panel remains Secrets. This independently verifies chooser ownership beyond VLC. | File still only New Window; Open omitted. More contains raw technical action labels (Db…, Element…). No safe opened/created; context-sensitive command usability not certified. |
| Planify | Ctrl+, opens Preferences; owner remains Planify. | Global Settings disabled and native command coverage absent, despite working local shortcut. No task/account edited. |
| File Roller | Generated 21-byte test archive; File/Edit/View/More visible. Ctrl+O opens chooser with File Roller identity. | Inspected File hints absent. No archive extracted/modified. An initial wrong test filename produced a normal error dialog; it was dismissed and the existing fixture used. |

Synthetic key events exercise the underlying Ctrl bindings, not the physical
keyd Command layer. These observations do not certify all menu actions. No
production-code changes were made in this follow-up. Shared fixes should address
partial native GMenu/window action merging, reliable accelerator metadata,
context-sensitive labels/state and failed action dispatch without replacing
working native menus. Ardour remains the user-approved exception; Mixxx remains
blocked from routine relaunch after its earlier session crash.

### Remaining-app follow-up — 2026-11-17, started 01:18 CET

Sequential visual checks, private /tmp/fm-audit captures; no configuration edits.

- GIMP 3.2.2: panel alias GIMP correct, full native File tree and single Windows
  menu; File hints missing. Ctrl+O opens chooser and owner remains GIMP.
- Calendar: File exposes New Event and settings links, no hints; Ctrl+F focuses
  search. No event created/modified.
- Clocks: File/New actually opens Add World Clock, cancelled; owner stays Clocks.
  No hints. No alarm/timer configured.
- Maps: exported View/Show Help Overlay opens the actual Shortcuts dialog, which
  lists real bindings absent from panel hints. Owner stays Maps. User reports
  cramped header search placement; investigate shared header CSS before changing.
- Sound Recorder: empty view; File only technical Open Primary Menu entry.
  No hints, recording controls not validated and no audio recorded.
- Solanum: global Settings opens Preferences with correct owner. No timer started.
- Warp: main Send File page after dismissing welcome; only fallback app/Window/Help,
  disabled About/Settings. Native send/open commands not exported; no transfer.
- Gradia: image editor reached from its start-screen sample; global Open opens
  real chooser, owner retained. No hints. Closed with its confirmation, no save,
  copy or export. Editor sample was not modified.
- Foliate: library File Open exists; Ctrl+O opens Pick a File, owner retained.
  No hints. No book imported, reader-only actions remain unverified.
- Fragments: View/Show Help Overlay opens real shortcut sheet (Ctrl+O/Ctrl+F,
  Ctrl+,/Ctrl+Q); corresponding panel hints absent. No download started.
- NewsFlash: File/Import OPML opens actual chooser, owner retained, cancelled.
  No hints. No feed/account/article changed.
- HandBrake: global File/Preferences opens actual Preferences, owner retained.
  Local menubar still duplicates panel and File hints absent. No encode/preview.
- Videos (Totem): global Settings opens actual Preferences, owner retained.
  Menus are populated; no media played, binding coverage remains unverified.
- Weather: existing forecast view inspected without changing location. View has
  Refresh with no hint. Settings is disabled; no location permission changed.
- System Monitor: global Settings opens Preferences, correct owner. No process or
  preference changed. Inspectable menus populated; hints still absent.
- Disks: File has New disk image plus technical Open App/Drive/Volume Menu entries;
  no hints. No disk selected or disk operation invoked.
- Disk Usage Analyzer: View populated with technical popover/menu entries and
  Show Preferences/Help Overlay; hints absent. No disk scan.
- Power Statistics: read-only AC view; only fallback app/Window, no real export.
- Backups: global Settings opens Preferences with correct owner; no backup,
  restore, schedule or destination change.
- Krita: Ctrl+N opens Create New Document with correct owner. Blank document File
  popup visually verified: native New/Open/Save/Save As/Close/Quit hints muted and
  aligned, Open Recent arrow aligned. One Window menu. Blank document closed.
- Scribus: blank document File popup and real muted hints aligned; one Windows
  menu (no extra Window). Closed normally.
- FreeCAD: File popup and native hints aligned; Ctrl+N creates empty document;
  one Windows menu. Closed without model edits.
- OpenToonz: after startup dialog dismissal and refocusing the main window,
  File popup and real hints aligned, one Windows menu. Initial focus transition
  was not counted as a pass; final main-window capture verified it. No scene edit.

The remaining follow-up list is reviewed. This means inspected/classified, not
that all functions pass: Foliate reader-only actions remain untested without a
book; media/render/backup/disk operations were deliberately not executed. Ardour,
Mixxx and the previously recorded custom-renderer exceptions remain exceptions.

### Shared GTK4 header geometry — 2026-11-17

Reviewed the existing Maps, Calendar, Clocks, Text Editor, Sound Recorder and
Weather screenshots. The shared CSS forced zero vertical padding and 24px
header buttons, which cramped search fields and segmented selectors. Removed
those blanket inner-box/button overrides; keep natural widget sizing and a
single header gutter (2px top, 6px bottom), lifting the whole content row slightly
without independently shifting window controls. Traffic-light diameter and
horizontal spacing are unchanged. No application-name selectors were added.

Installed through the existing appearance merger for native GTK and all 37
installed Flatpaks; the same source is used on fresh installations and by the
application integration watcher. Visually checked Maps, Calendar, Clocks and
Blanket after the initial change, then Calendar after the final 2px upward
adjustment. Existing appearance preservation/idempotence/restore tests pass.
Other menu/accelerator limitations recorded above remain separate work.

### Shared menu follow-up and common header minimum — 2026-11-17

- GTK action state refresh keeps the same ownership context, so a menu opened
  before an enabled/state update can still activate its commands. Window/request
  changes continue to invalidate stale callbacks.
- Partial GMenu trees can be supplemented with recognized, parameterless,
  actually exported commands absent by exact action ID. Native labels, targets,
  accelerators and ordering remain intact; dbusmenu is unchanged.
- `show-preferences` and `show-help-overlay` receive their common Settings and
  Keyboard Shortcuts roles. Clocks' shortcut window was opened from the top menu.
- The shared shortcut helper reads explicit GtkBuilder action/accelerator and
  GtkNamedAction/trigger pairs from bounded application-owned resources. It does
  not infer from translated shortcut-window labels. Text Editor's New Window
  now shows Command-N, verified on screen. Existing user keymaps take priority.
- Header content minimum is now 40 logical pixels plus the existing 2/6px
  vertical gutter; larger natural content remains allowed. Checked Clocks,
  Text Editor and Calendar after installation. No per-application CSS selectors.
- Full existing test suite passed; new tests cover stale callbacks after state
  refresh, nonduplicating partial-menu completion, native-tree preservation and
  exact resource shortcut extraction.

Remaining: widget-local GTK4 actions that are not exported over D-Bus cannot be
invoked by this reader. Text Editor still exposes only a subset of its document
commands. Resource discovery intentionally skips Flatpak wrapper executables
until the actual selected package executable can be identified safely. These
are not marked as completed menu/shortcut coverage.

### Header gutter correction — 2026-11-17

User comparison confirms identical traffic-light diameters (28 physical px)
and center spacing (48 physical px); the mismatch was header height. Supersedes
the earlier 40px-content rule: use 32px minimum content with symmetric 4px
outer gutters, a 28px inner-box minimum and 24px ordinary header controls.
Calendar's persistent application service retained old CSS after its Quit action;
reloaded the test process and visually verified the actual new geometry.

### Automatic integration audit — 2026-11-17

The reference machine now has 101 visible launchers. This count is an inventory,
not 101 passing applications. The old generated report assigned a generic
"shared GTK module / native exporter available" description to 62 launchers
without checking their actual frame/menu capability. That wording was misleading
and has been removed. Unknown Flatpak toolkits also no longer receive a description
that can be mistaken for verified GTK support. Desktop IDs are normalized before
deduplication, so native Qt adapters do not get a second generic report row.

Each generated row now explicitly identifies configuration-only evidence and
states that this scanner does not visually verify controls, menu export or
shortcuts. Historical human/visual observations above remain separate evidence.

Lifecycle gaps found by inspection:
- Chromium has a pre-launch refresh wrapper for deferred profile settings.
- Snap/BlueBubbles and editor preferences do not have an equivalent pre-launch
  retry. Running apps and profiles created later need another integration pass.
- Package/desktop updates are watched; changing the desktop color scheme alone
  is not an integration event. Already accessible GTK themes can be selected by
  GTK, but missing new custom themes need synchronization before use.
- The Snap theme mirror covers GTK3. It does not style arbitrary Flutter, Electron,
  Tauri, or Qt Quick content. BlueBubbles requires its explicit native-frame option.
- Native Qt ELF detection skips shell/Python wrappers, D-Bus activation and user
  launchers; these are review cases, not silently supported applications.
- Logseq's native-frame preference is known upstream, but installed-version/profile
  verification remains pending. JetBrains and Zed are documented capability cases,
  not installed-and-tested integrations.

BlueBubbles Snap 2.1.6.0 was visually checked after its native-frame option,
missing SVG assets and missing WhiteSur GTK3 theme were supplied: controls are on
the left and the title bar is dark. This does not certify all Snap applications.
