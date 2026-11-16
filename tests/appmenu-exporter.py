#!/usr/bin/python3
import json,subprocess,time,select
from pathlib import Path
from gi.repository import Gio,GLib
root=Path(__file__).resolve().parents[1]
p=subprocess.Popen(['/usr/bin/python3',str(root/'bridges/appmenu-exporter.py')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
bus=Gio.bus_get_sync(Gio.BusType.SESSION,None);wid=2147483646
try:
 p.stdin.write(json.dumps({'windows':[wid],'tree':[{'id':1,'label':'File','children':[{'id':2,'label':'Test action','enabled':True,'shortcut':['Control','Shift','S']}]}]})+'\n');p.stdin.flush()
 service=''
 for _ in range(30):
  service,path=bus.call_sync('com.canonical.AppMenu.Registrar','/com/canonical/AppMenu/Registrar','com.canonical.AppMenu.Registrar','GetMenuForWindow',GLib.Variant('(u)',(wid,)),None,0,1000,None).unpack()
  if service:break
  time.sleep(.1)
 assert service,'No registration'
 layout=bus.call_sync(service,path,'com.canonical.dbusmenu','GetLayout',GLib.Variant('(iias)',(0,-1,[])),None,0,2000,None).unpack()
 assert 'Test action' in str(layout),layout
 shortcut=bus.call_sync(service,path,'com.canonical.dbusmenu','GetProperty',GLib.Variant('(is)',(2,'shortcut')),None,0,2000,None).unpack()[0]
 assert shortcut == [['Control','Shift','S']],shortcut
 bus.call_sync(service,path,'com.canonical.dbusmenu','Event',GLib.Variant('(isvu)',(2,'clicked',GLib.Variant('i',0),0)),None,0,2000,None)
 assert select.select([p.stdout],[],[],2)[0],'No activation'
 assert json.loads(p.stdout.readline())=={'activate':2}
 print('Real D-Bus exported tree and activation round-trip: PASS')
finally:
 p.stdin.close();p.wait(timeout=4)
 errors=p.stderr.read()
 if errors:print(errors)
