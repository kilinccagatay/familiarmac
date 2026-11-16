import contextlib,io,runpy,sys,subprocess
from unittest.mock import patch
source="""submenu 'Advanced' {
\tmenuentry 'Linux 6.17.0-20-generic' --id 'gnulinux-6.17.0-20-generic-advanced-1234-abcd' {
\t\tinsmod gzio
\t\techo 'Loading Linux 6.17.0-20-generic ...'
\t\tlinux /boot/vmlinuz-6.17.0-20-generic root=UUID=1234 ro quiet splash $vt_handoff
\t\techo 'Loading initial ramdisk ...'
\t\tinitrd /boot/initrd.img-6.17.0-20-generic
\t}
}
"""
with patch.object(sys,'argv',['quiet-kernel-entry.py','6.17.0-20-generic']),patch.object(subprocess,'check_output',return_value=source):
 out=io.StringIO()
 with contextlib.redirect_stdout(out):runpy.run_path('scripts/quiet-kernel-entry.py',run_name='__main__')
 result=out.getvalue()
 assert 'echo ' not in result and 'familiarmac-quiet-kernel' in result
 for command in ['linux ','initrd ','insmod ']:
  assert [l.strip() for l in source.splitlines() if l.strip().startswith(command)]==[l.strip() for l in result.splitlines() if l.strip().startswith(command)]
print('Quiet GRUB clone preserves kernel/initrd/module commands; removes only status echoes PASS')
