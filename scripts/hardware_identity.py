"""Offline presentation selection only. Never authorizes driver/boot changes."""
import hashlib
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def read_identity(sysroot=Path('/sys')):
    def read(relative):
        try:return (sysroot/relative).read_text().strip().strip('\0')
        except (OSError,UnicodeError):return ''
    return {'model':read('class/dmi/id/product_name') or read('firmware/devicetree/base/model'),
            'vendor':read('class/dmi/id/sys_vendor'), 'chassis':read('class/dmi/id/chassis_type')}

def select_device(identity, catalog=None):
    if catalog is None:catalog=json.loads((ROOT/'assets/hardware/categories.json').read_text())
    model=identity.get('model','');vendor=identity.get('vendor','')
    apple=vendor in ('Apple Inc.','Apple Computer, Inc.') or (not vendor and model.startswith('Apple '))
    chassis=identity.get('chassis','')
    category='tower'
    if chassis=='23':
        category='rack'
    elif chassis in ('8','9','10','14','30','31','32'):
        category='laptop'
    elif chassis=='13':
        category='all-in-one'
    elif chassis=='35':
        category='mini'
    if apple:
        name=model.removeprefix('Apple ')
        if chassis=='23' or name.startswith('Xserve'):
            category='rack'
        elif name == 'MacPro7,1':category='tower-2019'
        elif name in ('MacBook8,1','MacBook9,1','MacBook10,1'):category='macbook-retina'
        elif name in ('MacBookAir8,1','MacBookAir8,2','MacBookAir9,1'):category='air-retina'
        elif re.fullmatch(r'MacBookPro(?:13|14|15|16),[1-4]', name):category='pro-2016'
        elif name in ('iMac4,1', 'iMac4,2', 'iMac5,1', 'iMac5,2', 'iMac6,1',
                    'PowerMac8,1', 'PowerMac8,2', 'PowerMac12,1'):
            category='white-imac'
        elif name in ('Macmini1,1', 'Macmini2,1', 'Macmini3,1',
                      'PowerMac10,1', 'PowerMac10,2'):
            category='white-top-mini'
        elif name == 'MacPro6,1':category='cylinder'
        elif name != 'MacBook5,1' and re.fullmatch(r'MacBook[1-7],\d+', name):category='white-macbook'
        elif name.startswith(('MacBookAir','MacBook Air')):category='macbook-air'
        elif name.startswith(('MacBook','PowerBook','iBook')):category='laptop'
        elif name.startswith(('Macmini','Mac mini')):category='mini'
        elif name.startswith('iMac'):category='all-in-one'
        elif name.startswith(('MacPro','Mac Pro','PowerMac','Xserve')):category='tower'
    # Illustration describes the form factor, never an exact model/year claim.
    return dict(catalog[category],model=model,category=category,match='category')

def asset_path(selection, root=ROOT/'assets/hardware'):
    path=(root/selection['asset']).resolve()
    if not path.is_relative_to(root.resolve()):raise ValueError('Asset outside catalog')
    if 'sha256' in selection and hashlib.sha256(path.read_bytes()).hexdigest()!=selection['sha256']:
        raise ValueError('Hardware image checksum mismatch')
    return path

if __name__=='__main__':
    print(json.dumps(select_device(read_identity()),indent=2))
