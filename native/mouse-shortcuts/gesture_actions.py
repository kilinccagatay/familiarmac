"""Discrete, opt-in gesture actions. No device access or command execution."""
from dataclasses import dataclass
import math

@dataclass(frozen=True)
class MagicOptions:
    mission: bool = False
    pages: bool = False
    spaces: bool = False
    zoom: bool = False
    natural: bool = True
    page_stream: bool = False

    @property
    def enabled(self):
        return self.mission or self.pages or self.spaces or self.zoom


def action_for(gesture, options):
    if gesture.phase != 'end':
        return None
    if gesture.kind == 'double-tap':
        if gesture.fingers == 2 and options.mission:
            return 'mission'
        if gesture.fingers == 1 and options.zoom:
            return 'zoom'
    if gesture.kind != 'swipe' or not all(map(math.isfinite, (gesture.dx, gesture.dy))):
        return None
    # Act once after release, never on every frame or on vertical scrolling.
    if abs(gesture.dx) < 600 or abs(gesture.dx) < abs(gesture.dy) * 1.5:
        return None
    dx = gesture.dx if options.natural else -gesture.dx
    if gesture.fingers == 1 and options.pages:
        return 'back' if dx > 0 else 'forward'
    if gesture.fingers == 2 and options.spaces:
        return 'previous-space' if dx > 0 else 'next-space'
    return None
