#!/usr/bin/python3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=Path.home()/'.config/gtk-3.0/gtk.css'
s=p.read_text() if p.exists() else ''
begin='/* BEGIN macbook-chromium-inner-corners */';end='/* END macbook-chromium-inner-corners */'
if begin in s:
 a=s.index(begin);b=s.index(end,a)+len(end);s=s[:a]+s[b:]
p.parent.mkdir(parents=True,exist_ok=True)
p.write_text(s.rstrip()+'\n\n'+begin+'\n'+(root/'config/chromium-inner-corners.css').read_text()+end+'\n')
print('Chromium-only inner corner override installed; compositor rounding preserved.')
