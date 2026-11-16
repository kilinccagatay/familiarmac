#!/usr/bin/env python3
"""Emit a quiet clone of one installed kernel entry using the distro generator."""
import re,subprocess,sys,os
kernel=sys.argv[1]
if not re.fullmatch(r'\d+\.\d+\.\d+-\d+-generic',kernel):raise SystemExit('Invalid kernel')
source=subprocess.check_output(['/etc/grub.d/10_linux'],env=dict(os.environ,LC_ALL='C'),text=True)
lines=source.splitlines();entry=[]
for index,line in enumerate(lines):
    if line.lstrip().startswith('menuentry ') and 'gnulinux-'+kernel+'-advanced-' in line:
        indent=line[:len(line)-len(line.lstrip())]
        for following in lines[index:]:
            entry.append(following[len(indent):])
            if following==indent+'}':break
        break
if not entry or entry[-1]!='}':raise SystemExit('No complete installed kernel entry')
result=[];removed=0
for line in entry:
    if re.match(r"\s*echo\s+'Loading (Linux |initial ramdisk)",line):removed+=1;continue
    result.append(line)
if removed!=2:raise SystemExit('Unexpected distro status messages; refusing')
result[0]=re.sub(r'gnulinux-'+re.escape(kernel)+r'-advanced-[a-fA-F0-9-]+','familiarmac-quiet-kernel',result[0])
print('\n'.join(result))
