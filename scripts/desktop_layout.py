"""Select the portable panel/Dock layout without assuming a Pro preset."""

REQUIRED = (
    'zorin-dash@zorinos.com',
    'appmenu@ChathurangaBW.github.io',
    'compiz-alike-magic-lamp-effect@hermes83.github.com',
    'touchpad-gesture-customization@coooolapps.com',
    'macbook-menu@local',
    'familiarmac-panel-layout@local',
    'familiarmac-lock@local',
    'user-theme@gnome-shell-extensions.gcampax.github.com',
)
CONFLICTS = (
    'zorin-taskbar@zorinos.com',
    'zorin-menu@zorinos.com',
    'zorin-hide-activities-move-clock@zorinos.com',
    'x11gestures@joseexposito.github.io',
)
KEYD = 'keyd@keyd.rvaiya.github.com'


def select_extensions(enabled, disabled, keyd_available):
    required = (*REQUIRED, *((KEYD,) if keyd_available else ()))
    blocked = (*CONFLICTS, *((KEYD,) if not keyd_available else ()))
    enabled = list(dict.fromkeys(x for x in enabled if x not in blocked))
    disabled = list(dict.fromkeys(x for x in disabled if x not in required))
    for item in required:
        if item not in enabled:
            enabled.append(item)
    # Session-mode extensions can be enabled even when absent from enabled-extensions.
    for item in blocked:
        if item not in disabled:
            disabled.append(item)
    return enabled, disabled
