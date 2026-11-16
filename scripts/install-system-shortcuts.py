#!/usr/bin/python3
"""Merge only three system shortcut mappings into the existing keyd profile."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
if os.geteuid() != 0:
    raise SystemExit('Run with pkexec or sudo')
p = Path('/etc/keyd/macbook.conf')
if not p.exists(): raise SystemExit('No FamiliarMac keyd profile; unchanged')
text = p.read_text()
if '[command:C]' not in text: raise SystemExit('Unknown command layer; unchanged')
updates = [('command+shift','q','M-S-q'),('control+command','q','M-C-q'),('alt+command','esc','M-A-esc')]
for section, key, value in updates:
    pattern = re.compile(r'(?m)^\['+re.escape(section)+r'\]\n([^\[]*)')
    match = pattern.search(text)
    if match:
        body = match.group(1)
        line = re.compile(r'(?m)^'+re.escape(key)+r'\s*=.*$')
        body = line.sub(key+' = '+value,body) if line.search(body) else key+' = '+value+'\n'+body
        text = text[:match.start(1)]+body+text[match.end(1):]
    else: text += '\n['+section+']\n'+key+' = '+value+'\n'
if text != p.read_text():
    backup=Path('/var/lib/macbook-zorin/system-shortcuts');backup.mkdir(parents=True,exist_ok=True)
    shutil.copy2(p,backup/('macbook.conf.'+str(time.time_ns())))
    p.write_text(text)
subprocess.run(['keyd','reload'],check=True)
print('System shortcut mappings installed; all other input settings preserved.')
