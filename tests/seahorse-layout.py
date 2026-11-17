import importlib.util
from pathlib import Path
import xml.etree.ElementTree as ET
spec=importlib.util.spec_from_file_location('layout',Path(__file__).resolve().parents[1]/'scripts/seahorse-layout.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
source='''<interface><template class="SeahorseKeyManager" parent="SeahorseCatalog"><property name="default-width">600</property><property name="default-height">476</property><child><object class="HdyLeaflet" id="header"><child><object class="GtkHeaderBar" id="left_header"/></child><child><object class="GtkHeaderBar" id="right_header"/></child></object></child><child><object class="HdyLeaflet" id="content_box"/></child></template><menu id="main_menu"><item><attribute name="action">app.help</attribute></item></menu></interface>'''
patched=ET.fromstring(m.patch_layout(source));original=ET.fromstring(source)
t=patched.find('template')
assert t.find("property[@name='width-request']").text=='740'
assert t.find("property[@name='default-width']").text=='810'
t.remove(t.find("property[@name='width-request']"));t.find("property[@name='default-width']").text='600'
assert ET.tostring(patched)==ET.tostring(original), 'unrelated UI or menu changed'
for changed in [source.replace('HdyLeaflet','AdwLeaflet'),source.replace('600','700'),source.replace('SeahorseCatalog','OtherCatalog')]:
 try:m.patch_layout(changed)
 except ValueError:pass
 else:raise AssertionError('unsupported resource accepted')
print('Seahorse layout: only width properties change; source drift rejected PASS')
