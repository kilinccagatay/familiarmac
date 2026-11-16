"""Exercise the early-console hook with isolated sysfs/tty fixtures, never real VTs."""
from pathlib import Path
import subprocess
import tempfile

source = Path('config/initramfs/00-familiarmac-console').read_text()
for model, fb, plymouth, bound, expected in [
    ('MacBookPro10,1', 'nouveaudrmfb', False, True, 'bound before'),
    ('MacBookPro10,1', 'nouveaudrmfb', False, False, 'not confirmed'),
    ('Other', 'nouveaudrmfb', False, True, None),
    ('MacBookPro10,1', 'simpledrmdrmfb', False, True, None),
    ('MacBookPro10,1', 'nouveaudrmfb', True, True, None),
]:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for name, data in {
            'sys/class/dmi/id/product_name': model,
            'sys/class/graphics/fb0/name': fb,
            'sys/class/vtconsole/vtcon1/name': '(M) frame buffer device',
            'sys/class/vtconsole/vtcon1/bind': '1' if bound else '0',
            'dev/tty0': '',
        }.items():
            p = root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(data)
        if plymouth:
            p = root / 'run/plymouth/pid'
            p.parent.mkdir(parents=True)
            p.write_text('1')
        # Ordinary files represent device fixtures; append retains both writes.
        script = source.replace('/sys/', tmp+'/sys/').replace('/run/', tmp+'/run/').replace('/dev/tty0', tmp+'/dev/tty0').replace('[ -c ', '[ -e ').replace(' > '+tmp+'/dev/tty0', ' >> '+tmp+'/dev/tty0')
        subprocess.run(['sh', '-c', script], check=True, timeout=3)
        marker = root / 'run/familiarmac/console-init'
        output = (root/'dev/tty0').read_bytes()
        if expected:
            assert expected in marker.read_text()
            assert b'\x1b[30;40m\x1b[H.\x1b[2J' in output
        else:
            assert not marker.exists() and not output
print('Console init: hardware/Plymouth guards, non-erase trigger, actual bind reporting PASS')
