#!/usr/bin/env python3
"""Fresh taskbar preset, existing Dock and disabled-extension reconciliation."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from desktop_layout import select_extensions, KEYD

taskbar = 'zorin-taskbar@zorinos.com'
dock = 'zorin-dash@zorinos.com'
gesture = 'x11gestures@joseexposito.github.io'
enabled, disabled = select_extensions([taskbar, 'unrelated@local'], [dock, 'other@local'], False)
assert dock in enabled and dock not in disabled
assert taskbar not in enabled and taskbar in disabled
assert gesture in disabled  # Zorin enables this through its session mode.
assert KEYD not in enabled and KEYD in disabled
assert 'unrelated@local' in enabled and 'other@local' in disabled
assert select_extensions(enabled, disabled, False) == (enabled, disabled)

# Existing full installations keep their mapper; an old disabled entry is removed.
enabled, disabled = select_extensions([dock, KEYD, 'unrelated@local'], [KEYD], True)
assert enabled[:3] == [dock, KEYD, 'unrelated@local']
assert KEYD not in disabled
# Removing the optional system mapper cannot leave a broken enabled extension.
enabled, disabled = select_extensions(enabled, disabled, False)
assert KEYD not in enabled and KEYD in disabled
print('Portable layout: fresh preset, existing Dock, optional mapper, idempotence PASS')

# Fresh installation and upgrade both select Genie, never the retired effect.
old = 'compiz-alike-magic-lamp-effect@hermes83.github.com'
new = 'familiarmac-genie@local'
for active, blocked in [([], []), ([old, 'unrelated@local'], [new])]:
    active, blocked = select_extensions(active, blocked, False)
    assert new in active and new not in blocked
    assert old not in active and old in blocked
    assert select_extensions(active, blocked, False) == (active, blocked)
print('Genie clean install and Magic Lamp migration PASS')
