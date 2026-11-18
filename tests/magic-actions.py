import sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(root/'native/mouse-shortcuts'),str(root/'vendor/familiarmac-magic-mouse')]
from gesture_actions import MagicOptions,action_for
from magic_mouse_support import Gesture
all_on=MagicOptions(True,True,True,True)
for fingers,kind in [(1,'zoom'),(2,'mission')]:
    assert action_for(Gesture('double-tap',fingers),all_on)==kind
    assert action_for(Gesture('double-tap',fingers),MagicOptions()) is None
for fingers,positive,negative in [(1,'back','forward'),(2,'previous-space','next-space')]:
    assert action_for(Gesture('swipe',fingers,dx=700),all_on)==positive
    assert action_for(Gesture('swipe',fingers,dx=-700),all_on)==negative
    assert action_for(Gesture('swipe',fingers,dx=700),MagicOptions(True,True,True,True,False))==negative
    for phase in ('begin','update','cancel'):
        assert action_for(Gesture('swipe',fingers,phase,700),all_on) is None
    for dx,dy in [(300,0),(700,900),(float('nan'),0),(float('inf'),0)]:
        assert action_for(Gesture('swipe',fingers,dx=dx,dy=dy),all_on) is None
assert action_for(Gesture('pinch',2,dx=1000),all_on) is None
print('Magic action routing: explicit options, release-only, direction, deadzone and cancelled gestures PASS')
