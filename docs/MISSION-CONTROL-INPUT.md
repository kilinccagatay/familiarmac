# Mission Control input

Open Settings → Dock & Window → Mission Control → Shortcuts… . Keyboard shortcuts use GNOME’s existing `toggle-overview` binding; the installer normally supplies Control+Up. Record a modified key or function key, press Escape to cancel, or Backspace to disable. Conflicts with standard window-manager, Shell and media bindings are rejected.

The F4 key row selects Apps (default) or Spotlight for plain F4 and Apple Launchpad/Search hardware keys. Alt+F4 and other modified shortcuts are preserved. Existing owners of a hardware accelerator are respected. The choice applies immediately; it does not change keyd.

Mouse shortcuts live in Settings → Mouse & Touchpad and are opt-in: middle/wheel click, Back, or Forward. The selected button is reserved for Mission Control, including while application windows are focused. The default is Off. Lock-screen input is excluded. On Wayland, a separate `familiarmac-mouse` service handles conventional relative-pointer mice; keyboards and absolute devices (including touchpads) are excluded. The desktop sends a heartbeat; disabling the option, locking the session, losing the heartbeat or stopping the service releases the physical mouse. The service is installed by the portable setup/updater; it does not change keyd. Run `sudo bash scripts/install-mouse-shortcuts.sh` for an existing desktop-only installation. Magic Mouse HID touch reports are read passively using the separately maintained `familiarmac-magic-mouse` library. When page or workspace swipes are enabled, only its hardware-matched relative mouse endpoint is forwarded through uinput to suppress duplicate wheel scrolling. Buttons, pointer motion and ordinary vertical scrolling are preserved. Its keyboard and touchpad endpoints are never grabbed.

Three- and four-finger vertical gestures use the installed gesture engine. Horizontal workspace gestures and other input preferences remain unchanged. Selecting a vertical gesture explicitly replaces that vertical action.

Apple places shortcuts under Desktop & Dock and Magic Mouse double-tap under Mouse:
- https://support.apple.com/en-mt/guide/mac-help/mchlp1119/27/mac/27
- https://support.apple.com/en-la/102482

When a supported Magic Mouse is connected, Settings → Mouse & Touchpad → Mouse shows Point & Click and More Gestures. The latter has an opt-in two-finger double-tap switch for Mission Control. Disconnecting restores the ordinary Mouse page; the Touchpad page remains available. Tracking speed, natural scrolling and secondary-click controls use the existing system mouse settings and also affect other mice. The optional switches also enable one-finger horizontal Back/Forward navigation, two-finger desktop/full-screen workspace navigation, and one-finger double-tap document zoom. All new switches default to Off for existing installations; enabling them is explicit.

The backend identifies Apple HID vendor/product IDs instead of device names. Source, upstream attribution and protocol limitations: https://github.com/kilinccagatay/familiarmac-magic-mouse . The vendored snapshot records its source commit in `vendor/familiarmac-magic-mouse/VENDORED.json`. Original Magic Mouse hardware produced five two-finger double-tap recognitions in a passive test; Mission Control action delivery was confirmed locally. Lightning and USB-C models have parser tests, not physical validation.


## Gesture behavior and limits

- The installer disables `hid_magicmouse`'s synthetic middle-button region (`emulate_3button=0`) so central physical clicks retain the mouse's native left/right classification. Otherwise Linux can report `BTN_MIDDLE` for a normal click, and standard dialog buttons such as Cancel do not activate. The setting applies immediately and persists in `/etc/modprobe.d/familiarmac-magic-mouse.conf`; conventional mice retain their wheel/middle button. This does not change touch gestures, scrolling or keyd. [Linux driver implementation](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-magicmouse.c).
- Page swipes stream native horizontal finger-scroll events after recognition. Chrome owns its back/forward overscroll arrows and navigation threshold; reversing the finger reverses progress. Other applications handle this as native horizontal scrolling according to their own support. Release sends a scroll-stop event, without an additional Back/Forward key. Focus changes, modal dialogs, session lock, disconnect and timeout end the stream. Older Shell clients retain the discrete Back/Forward fallback. Vertical scrolling, physical clicks and two-finger workspace gestures keep their existing paths.
- Two-finger horizontal swipes select the adjacent GNOME workspace, including FamiliarMac full-screen workspaces, without wrapping or creating empty desktops. Movement streams to the same GNOME workspace animation controller used by touchpad gestures. Inside Mission Control, the native overview workspace adjustment moves full-monitor wallpaper surfaces and previews together, separated by the normal workspace gap, without dismissing the overview. The compact strip marks the selected desktop; expanded thumbnails use separate captions. Hover outlines remain hidden during the entire swipe and settling animation. Outside it, desktops follow the fingers, then settle on release; reversing a short drag returns to the original desktop. Existing clients retain the discrete fallback. Active touchpad transitions are never taken over. A lost service connection cancels the drag.
- Smart Zoom sends two zoom-in steps, then two zoom-out steps on the next double-tap in the same window. Supported identities include Firefox, Chromium/Chrome, Brave, Vivaldi, Edge, Epiphany, Evince/Papers, Okular and ChatGPT. It does not send Ctrl+0 or overwrite a saved zoom setting. Unsupported applications, held modifiers, drags, the overview and locked sessions are ignored. Unlike macOS, Linux has no shared semantic fit-to-column API: this is document zoom, not automatic content-aware framing. Changing tabs/documents or manually changing zoom between taps can change the return position.
- The gesture recognizer remains independent of desktop actions. Attribution and upstream licenses remain in the standalone repository and vendored snapshot.
- Hardware testing is required for each model. Original Magic Mouse is the local device; Lightning and USB-C remain parser-tested only.


### Local verification, 2026-11-18

The user confirmed page navigation and one-finger double-tap zoom with the
original Magic Mouse. A real GTK test window entered its own full-screen
workspace; the same F14/F15 input path used by two-finger swipes moved back to the
original desktop and forward to that full-screen window, then restored the
window and removed its test workspace. This verifies desktop action delivery;
the user subsequently confirmed physical two-finger workspace switching. The user also confirmed finger-following continuous progress; the adapter adds frame-clock smoothing.
The complete repository suite passed; after the standard-pointer report fix,
all 16 library tests and the affected adapter tests passed again.


### Mouse gesture demonstrations

The Mouse panel uses original Cairo vector animations: hovering or focusing a
setting selects its paired hand-motion and desktop-result demonstration. Tab
changes select the appropriate initial demo. Tracking, scrolling, secondary
click, zoom, page swipes, workspace swipes and Mission Control each have distinct
scenes. The frame clock follows widget visibility; system animation preferences
produce a static explanatory frame. Demonstrations never emit real input or
change settings. Reference: https://support.apple.com/en-ie/guide/mac-help/mh35869/mac

### Local native page-swipe verification, 2026-11-19

Chrome rendered its native overscroll indicator in isolated X11 and Wayland test windows. The virtual pointer must synchronize its coordinates with the physical pointer before scrolling, without generating redundant motion on each sample. The user confirmed that page swipes and the other gestures worked after this correction. Regression tests cover pointer targeting, reversal, release, focus changes, timeout and modal guards. Included in FamiliarMac 1.2.4.
