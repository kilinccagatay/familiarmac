"""Exercise the build hook with a synthetic PCI tree, never real firmware."""
from pathlib import Path
import subprocess
import tempfile

source = Path('config/initramfs/familiarmac-trim-gsp').read_text()
with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp)
    sys = root / 'sys'
    (sys / 'class/dmi/id').mkdir(parents=True)
    (sys / 'class/dmi/id/product_name').write_text('MacBookPro10,1')
    pci = sys / 'bus/pci/devices'
    def device(name, cls, ident):
        d = pci / name
        d.mkdir(parents=True, exist_ok=True)
        for key, value in {'class': cls, 'vendor': '0x10de', 'device': ident}.items():
            (d / key).write_text(value)
    device('gpu', '0x030000', '0x0fd5')
    device('audio', '0x040300', '0x0e1b')
    stage = root / 'stage'
    fw = stage / 'usr/lib/firmware/nvidia/ga102/gsp/gsp-test.bin.zst'
    kept = stage / 'usr/lib/firmware/nvidia/gk107/keep.bin'
    fw.parent.mkdir(parents=True)
    kept.parent.mkdir(parents=True)
    kept.write_bytes(b'Kepler firmware')
    hook = root / 'hook'
    hook.write_text(source.replace('/sys/', str(sys) + '/'))
    def run():
        subprocess.run(['sh', str(hook)], env={'DESTDIR': str(stage), 'PATH': '/usr/bin:/bin'}, check=True)
    fw.write_bytes(b'modern firmware')
    run()
    assert not fw.exists() and kept.read_bytes() == b'Kepler firmware'
    device('extra_gpu', '0x030000', '0x2684')
    fw.write_bytes(b'modern firmware')
    run()
    assert fw.exists(), 'Additional NVIDIA GPU must disable trimming'
    (sys / 'class/dmi/id/product_name').write_text('OtherModel')
    run()
    assert fw.exists(), 'Other hardware must not be trimmed'
print('Initramfs hardware guards, HDMI audio exclusion and Kepler retention: PASS')
