# FamiliarMac Genie and minimized-window previews

Included in the normal desktop installation and `install.sh --all`, on GNOME
Shell 46. The installer disables the old Magic Lamp extension and installs
Genie instead. Magic Lamp is no longer bundled or downloaded. Existing copies
are left intact but disabled, preserving rollback and user-owned files.

## Behavior and controls

- Minimize captures the window once and adds a clickable preview after Downloads
  on the Dock's right/file side. Its width follows the actual Dock icon size,
  including HiDPI, and an application badge identifies it.
- Click a preview to restore that specific window. Right-click shows
  **Open “current window title”**; the label updates when the app's window title
  changes (including browser tab titles when the browser exports them).
- A 480 ms Genie curve flows into the preview's actual allocation, which is
  checked every frame as the Dock moves. Restore follows the reverse path.
- Closing uses a separate 110 ms fade and creates no preview. Whether closing
  the last window quits an app remains the application's decision.
- **Settings → Dock & Window** opens the animation switch and application menu checks.
  The Dock context-menu entry and application search entry open this same page.
  System motion is displayed as status, not a second switch. If system animations
  are off, Genie shows off; enabling it asks permission to enable system animations.
  Cancel preserves both settings.
- System reduced motion (`org.gnome.desktop.interface enable-animations=false`)
  always takes priority. Preview items remain usable without animation.
  The installer preserves that system preference and the user's Genie switch.

Apple distinguishes separate minimized Dock windows from minimizing into the
application icon in [Desktop & Dock settings](https://support.apple.com/en-gu/guide/mac-help/-mchlp1119/mac).
The curve and timings here are our implementation, not measured Apple timings.

New or updated extension JavaScript loads at the next normal login. To disable
Genie completely without re-enabling the old effect:

```sh
gnome-extensions disable familiarmac-genie@local
```

To re-enable it:

```sh
gnome-extensions enable familiarmac-genie@local
```

## Safety, validation and limits

The 1×32 mesh needs only 66 vertices because horizontal rows are linear.
Quintic interpolation gives zero velocity and acceleration at phase endpoints.
A parent clip contains the current deformed bounds without cropping the source
texture. New preview layout is awaited for up to 192 ms before an immediate
completion fallback. Disable, monitor changes, window destruction and reduced
motion finish pending jobs and release snapshots.

Tests cover geometry endpoints and bounds, HiDPI sizing, updated context-menu
titles, deferred first allocation, completion exactly once, cleanup, motion
preferences and installer migration. The user approved the revised appearance
and motion on the MacBookPro10,1. This does not establish long-term GPU stability
or resolve the separate Nouveau driver investigation.

Currently, up to three full-window snapshots are retained to bound GPU memory;
additional windows use native minimization. The bottom Dock with FamiliarMac's
Downloads section is required. Left/right Docks and retroactive snapshots of
already-minimized windows are not supported. No GPU, boot, firmware or networking
settings are applied by this feature.
