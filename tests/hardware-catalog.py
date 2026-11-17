#!/usr/bin/env python3
import hashlib,importlib.util,json,os,subprocess,tempfile,xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('hardware_identity',ROOT/'scripts/hardware_identity.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
c=json.loads((ROOT/'assets/hardware/categories.json').read_text())
assert set(c)=={'laptop','macbook-air','all-in-one','tower','mini','white-macbook','cylinder','white-imac','white-top-mini','macbook-retina','air-retina','pro-2016','tower-2019','rack'}
for model,kind in [('MacBook1,1','white-macbook'),('MacBook7,1','white-macbook'),('MacBook8,1','macbook-retina'),('MacBook5,1','laptop'),('MacPro6,1','cylinder'),('MacBookPro10,1','laptop'),('MacBookAir5,2','macbook-air'),('MacBookAir7,2','macbook-air'),('MacBook Air','macbook-air'),('iBook','laptop'),('PowerBook5,1','laptop'),('iMac12,1','all-in-one'),('Macmini3,1','white-top-mini'),('MacPro5,1','tower'),('PowerMac7,2','tower')]:
    result=m.select_device({'model':model,'vendor':'Apple Inc.'},c)
    assert result['category']==kind
    assert m.asset_path(result).is_file()
# Explicit legacy identifiers must not capture the newer aluminium generations.
for kind, models in {
    'white-imac': ['iMac4,1','iMac4,2','iMac5,1','iMac5,2','iMac6,1','PowerMac8,1','PowerMac8,2','PowerMac12,1'],
    'white-top-mini': ['Macmini1,1','Macmini2,1','Macmini3,1','PowerMac10,1','PowerMac10,2'],
    'all-in-one': ['iMac7,1','iMac8,1','iMac14,2'],
    'mini': ['Macmini4,1','Macmini5,1','Macmini6,2'],
    'tower': ['PowerMac7,2','PowerMac11,2'],
}.items():
    for model in models:
        assert m.select_device({'model': model, 'vendor': 'Apple Inc.'}, c)['category'] == kind
        assert m.select_device({'model': 'Apple '+model}, c)['category'] == kind
        assert m.select_device({'model': model, 'vendor': 'Other'}, c)['category'] == 'tower'
for kind, models in {
    'macbook-retina': ['MacBook8,1','MacBook9,1','MacBook10,1'],
    'air-retina': ['MacBookAir8,1','MacBookAir8,2','MacBookAir9,1'],
    'pro-2016': ['MacBookPro13,1','MacBookPro13,2','MacBookPro13,3','MacBookPro14,1','MacBookPro14,2','MacBookPro14,3','MacBookPro15,1','MacBookPro15,2','MacBookPro15,3','MacBookPro15,4','MacBookPro16,1','MacBookPro16,2','MacBookPro16,3','MacBookPro16,4'],
    'tower-2019': ['MacPro7,1'],
    'rack': ['Xserve1,1','Xserve3,1'],
    'laptop': ['MacBookPro10,1','MacBookPro11,3','MacBookPro12,1'],
    'macbook-air': ['MacBookAir7,2'],
}.items():
    for model in models:
        assert m.select_device({'model':model,'vendor':'Apple Inc.'},c)['category']==kind
for identity in [
    {'model':'MacPro7,1','vendor':'Apple Inc.','chassis':'23'},
    {'model':'Server','vendor':'Other','chassis':'23'},
    {'model':'Unknown','chassis':'23'},
]:
    assert m.select_device(identity,c)['category']=='rack'
assert m.select_device({'model':'MacPro7,1','vendor':'Apple Inc.','chassis':'7'},c)['category']=='tower-2019'
# Apple Silicon is not classified as the newly added Intel generations.
assert m.select_device({'model':'MacBookPro17,1','vendor':'Apple Inc.'},c)['category']!='pro-2016'
assert m.select_device({'model':'MacBookAir10,1','vendor':'Apple Inc.'},c)['category']!='air-retina'
for row in c.values():
    assert row['asset'].endswith('.svg')
    ET.parse(m.asset_path(row))
assert m.asset_path(c['laptop']) == ROOT/'assets/hardware/macbook-pro-a1398.svg'
assert hashlib.sha256(m.asset_path(c['laptop']).read_bytes()).hexdigest() == '837dbf36e77cf772551d3dbc035f63237f22e98f7bf1383b5ce7dc00e4078604'
# Selection is recalculated for the target machine, not remembered from the author host.
for model, kind in [('MacBookAir6,2', 'macbook-air'), ('iMac14,2', 'all-in-one'), ('Macmini6,2', 'mini')]:
    assert m.select_device({'model': model, 'vendor': 'Apple Inc.'}, c)['category'] == kind
for chassis,kind in [('9','laptop'),('13','all-in-one'),('35','mini'),('3','tower'),('','tower')]:
    assert m.select_device({'model':'Unknown','vendor':'Other','chassis':chassis},c)['category']==kind
assert m.select_device({'model':'MacBookPro10,1','vendor':'Dell Inc.'},c)['category']=='tower'
assert m.select_device({'model':'MacBookAir5,2','vendor':'Other','chassis':'9'},c)['category']=='laptop'
with tempfile.TemporaryDirectory() as d:
    assert m.read_identity(Path(d))=={'model':'','vendor':'','chassis':''}
    home=Path(d);desktop=home/'.local/share/applications/org.gnome.Settings.desktop'
    desktop.parent.mkdir(parents=True);desktop.write_text('user original\n')
    env=dict(os.environ,HOME=d)
    subprocess.run(['python3',str(ROOT/'scripts/install-about.py')],env=env,check=True)
    base=home/'.local/share/familiarmac/about'
    if base.exists():
        tree=ET.parse(base/'cc-about-page.ui')
        assert tree.find('.//object[@id="os_logo"]') is not None
        assert tree.find('.//object[@id="hardware_model_row"]') is not None
        pic=tree.find('.//object[@class="GtkPicture"]/property[@name="file"]')
        assert pic is not None and pic.text.startswith('file:')
        subprocess.run(['python3',str(ROOT/'scripts/install-about.py')],env=env,check=True)
        subprocess.run(['python3',str(ROOT/'scripts/install-about.py'),'--restore'],env=env,check=True)
        assert desktop.read_text()=='user original\n'
print('Hardware categories, asset integrity, old Mac families, fallbacks and About install/restore PASS')
