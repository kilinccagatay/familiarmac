# Application appearance audit — 2026-11-16

Scope: 98 visible desktop launchers on the development machine were inventoried and attempted or inspected in their existing windows. Applications were handled sequentially. This is an appearance audit, **not a claim that all 98 apps or all features passed**. First-run dialogs, stale launchers and unavailable windows are recorded below. No account setup, project import, driver change or OS upgrade was performed.

The shared header correction was rechecked in Contacts, Characters, Settings, Terminal and Blanket. ChatGPT remained open to preserve the active conversation. Private full-screen captures are not included in the repository.

Remaining distinct issues: LibreCAD uses its own Qt Wayland decoration; Logseq uses HTML window controls; Blender showed corrupted glyphs and a Mesa Vulkan warning. These are not repaired by the GTK header CSS. Panel menu allocation updates require the next normal GNOME login.

| Launcher | Observation |
|---|---|
| `alacarte.desktop` | Title fits, normal close; settings unchanged. |
| `app.drey.Warp.desktop` | Launch and capture recorded; no full functional validation. |
| `be.alexandervanhee.gradia.desktop` | Launch and capture recorded; no full functional validation. |
| `brasero.desktop` | Title fits in maximized window; no disc operation. |
| `brave-browser.desktop` | Main window and global menus inspected; shared GTK3 spacing applies on next launch. |
| `chatgpt.desktop` | Existing conversation window inspected; not restarted to preserve active work. |
| `com.github.finefindus.eyedropper.desktop` | Reopened normally: title fits, controls match; stale render corruption cleared on app restart. |
| `com.github.johnfactotum.Foliate.desktop` | Launch and capture recorded; no full functional validation. |
| `com.github.phase1geo.minder.desktop` | Stale launcher: Flatpak not installed; current io.github ID remains to test. |
| `com.github.wwmm.easyeffects.desktop` | Title fits; stopped background service with documented --quit after normal close. |
| `com.github.xournalpp.xournalpp.desktop` | Main document title fits, controls match; empty document closed. |
| `com.google.Chrome.desktop` | Main title/controls and global menus visible; no profile edits. |
| `com.logseq.Logseq.desktop` | Custom Electron HTML controls on right; own light theme. Not covered by GTK rule; no graph opened. |
| `com.obsproject.Studio.desktop` | Main editor rechecked after login: real global menus and full top-level labels visible; File menu and Quit shortcut inspected. No recording/streaming started. |
| `com.odnoyko.valot.desktop` | Own custom header without window controls; title labels fit. |
| `com.rafaelmardojai.Blanket.desktop` | Reopened after fix: complete centered title and compact controls. |
| `com.zorin.desktop.upgrader.desktop` | No-upgrades screen title fits; closed, no upgrade performed. |
| `de.haeckerfelix.Fragments.desktop` | Launch and capture recorded; no full functional validation. |
| `fr.free.Homebank.desktop` | Main test document verified with user: title and controls fit. FAILED menu export: File/Edit/View/Manage/Transactions/Reports/Tools/Help remain in the app despite GTK3 X11/registrar overrides. Needs shared Flatpak GTK exporter investigation; not marked supported. |
| `fr.handbrake.ghb.desktop` | Launch and capture recorded; no full functional validation. |
| `gimp.desktop` | Main editor title fits; long panel menus ellipsized; existing panel-width fix awaits login. |
| `gnome-language-selector.desktop` | Title fits; no language changes. |
| `gnome-session-properties.desktop` | Title fits; normal Close, no autostart changes. |
| `gufw.desktop` | Firewall title fits; settings untouched, normal WM_DELETE_WINDOW. |
| `install-zorin-windows-app-support.desktop` | Opens Software catalog; no package installed. |
| `io.github.OpenToonz.desktop` | Main blank scene verified with user: full exported menus, actual shortcut hints and aligned submenu rows. Native Windows plus synthetic Window duplicate found; shared singular/plural detection now fixed, pending next shell load. |
| `io.github.alainm23.planify.desktop` | Launch and capture recorded; no full functional validation. |
| `io.github.phase1geo.minder.desktop` | Main title fits; blank startup dialog dismissed. |
| `io.github.revisto.drum-machine.desktop` | Centered main title fits, own accent retained; closed without playback. |
| `io.gitlab.news_flash.NewsFlash.desktop` | Launch and capture recorded; no full functional validation. |
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
| `org.gnome.Calculator.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.Calendar.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.Characters.desktop` | After shared fix: complete title; visually verified. |
| `org.gnome.Contacts.desktop` | After shared fix: complete title; visually verified. |
| `org.gnome.DejaDup.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.DiskUtility.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.Evince.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.Evolution.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.FileRoller.desktop` | Service launched but no normal window observed; unverified. |
| `org.gnome.GTK4ThemeSwitcher.desktop` | Title fits; no theme applied. |
| `org.gnome.Logs.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.Maps.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.Nautilus.desktop` | Sidebar Files title fits; normal quit. |
| `org.gnome.NetworkDisplays.desktop` | Screen-share chooser cancelled; main header fits; normal close. |
| `org.gnome.PowerStats.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.Rhythmbox3.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.Screenshot.desktop` | Dialog title fits, normal quit. |
| `org.gnome.Settings.desktop` | After shared fix: complete title and unchanged control size. |
| `org.gnome.Shotwell.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.Snapshot.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.Software.desktop` | Main Explore header and controls fit after foregrounding; quit normally, no install/update. |
| `org.gnome.Solanum.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.SoundRecorder.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.SystemMonitor.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.Terminal.desktop` | After shared fix: measured 44 px control centers at 2× (previously 56 px). |
| `org.gnome.TextEditor.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.Totem.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.Tour.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.Weather.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.World.Secrets.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.baobab.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.clocks.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.eog.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.font-viewer.desktop` | Launcher failed during this audit; not a visual pass. |
| `org.gnome.gitlab.somas.Apostrophe.desktop` | Launch and capture recorded; no full functional validation. |
| `org.gnome.seahorse.Application.desktop` | Launch and capture recorded; no full functional validation. |
| `org.inkscape.Inkscape.desktop` | Launch and capture recorded; no full functional validation. |
| `org.kde.kdenlive.desktop` | Rechecked after login with a blank project: full panel menu labels, aligned Open Recent row and muted exported shortcut hints visually verified. |
| `org.kde.krita.desktop` | User-created blank document checked: complete exported top-level labels and aligned window controls. Actual D-Bus accelerators include New/Open/Save/Save As; app menu Quit hint visible. Full File popup alignment not visually verified. Closed without saving the blank test document. |
| `org.mixxx.Mixxx.desktop` | BLOCKED: repeat launch exported top-level menus, then became unresponsive. At 22:48:58 CET Nouveau reported a PTE write fault on the GNOME Shell channel; Shell segfaulted in host libgallium 25.2.8 and the session ended. Mixxx causality unproven; do not repeat launch during ordinary audit. No GPU/boot settings changed. |
| `org.mozilla.firefox.desktop` | Main title/controls and global menus visible; no profile edits. |
| `org.remmina.Remmina.desktop` | Main header fits, quit with documented --quit; no remote connection opened. |
| `org.videolan.VLC.desktop` | Launch and capture recorded; no full functional validation. |
| `org.xfce.mousepad.desktop` | Launch and capture recorded; no full functional validation. |
| `simple-scan.desktop` | Launch and capture recorded; no full functional validation. |
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
