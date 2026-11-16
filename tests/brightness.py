import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('brightness',Path(__file__).resolve().parents[1]/'scripts/brightness.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
x=223
for _ in range(32):x=m.next_brightness(x,1023,'down')
assert x==0
assert m.next_brightness(0,1023,'up')==64
x=0
for _ in range(32):x=m.next_brightness(x,1023,'up')
assert x==1023
assert m.next_brightness(0,1,'down')==0
assert m.next_brightness(0,1,'up')==1
print('Brightness: reaches true zero, wakes from zero, clamps both limits PASS')
