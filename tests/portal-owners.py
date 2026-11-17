from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location('owners',Path(__file__).resolve().parents[1]/'scripts/portal-owners.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
o=m.Owners();args=('/org/freedesktop/portal/desktop/request/1_2/a','org.example.App','x11:0','Choose file')
assert not o.add(':rogue',':trusted',1,':backend',123,args)
assert o.add(':trusted',':trusted',1,':backend',123,args)
assert o.state()[0]['appId']=='org.example.App'
assert not o.reply(':other',1)
assert o.reply(':backend',1) and not o.state()
assert o.add(':trusted',':trusted',2,':backend',123,args)
assert o.close(args[0]) and not o.state()
assert not o.add(':trusted',':trusted',3,':backend',0,args)
assert not o.add(':trusted',':trusted',3,':backend',123,(args[0],'','x11:0',args[3]))
print('Portal ownership: authenticated sender, generic app IDs, exact replies, cancellation and no invalid owner PASS')
