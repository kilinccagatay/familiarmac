#!/usr/bin/env python3
"""Reproduce EOF spin and test bounded IPC reads without evdev or live keyd."""
import pathlib, subprocess, tempfile, tarfile
root=pathlib.Path(__file__).resolve().parents[1]
headers='#include <unistd.h>\n#include <sys/socket.h>\n#include <poll.h>\n#include <errno.h>\n#include <time.h>\n#include <stdlib.h>\n#include <stdio.h>\n#include <string.h>\n#include <assert.h>\n#include <sys/wait.h>\n'
with tempfile.TemporaryDirectory() as tmp:
 d=pathlib.Path(tmp)
 with tarfile.open(root/'vendor/keyd-2.6.0.tar.gz') as t:
  original=t.extractfile('./src/util.c').read().decode().replace('#include "keyd.h"',headers)
  daemon=t.extractfile('./src/daemon.c').read()
 (d/'src').mkdir();(d/'src/daemon.c').write_bytes(daemon)
 subprocess.run(['patch','-d',tmp,'-p1','-i',str(root/'patches/keyd-ipc-read.patch')],check=True,stdout=subprocess.DEVNULL)
 (d/'old.c').write_text(original+'\nint main(void){int f[2];char b[4];socketpair(AF_UNIX,SOCK_STREAM,0,f);close(f[1]);xread(f[0],b,4);return 0;}')
 subprocess.run(['cc',str(d/'old.c'),'-o',str(d/'old')],check=True)
 try:subprocess.run([str(d/'old')],timeout=.3,check=True)
 except subprocess.TimeoutExpired:pass
 else:raise AssertionError('Expected original EOF loop')
 source=(d/'src/daemon.c').read_text();fn=source[source.index('static int read_request'):source.index('static void handle_client')]
 main=r'''
int main(void){
 for(int mode=0;mode<4;mode++){
  int f[2];char b[4]={0};assert(!socketpair(AF_UNIX,SOCK_STREAM,0,f));
  pid_t child=-1;
  if(mode==0){close(f[1]);f[1]=-1;}
  if(mode==1){write(f[1],"ab",2);close(f[1]);f[1]=-1;}
  if(mode==3){child=fork();if(!child){close(f[0]);write(f[1],"ab",2);usleep(10000);write(f[1],"cd",2);close(f[1]);_exit(0);}close(f[1]);f[1]=-1;}
  int result=read_request(f[0],b,4);
  assert(result==(mode==3?0:-1));if(mode==3)assert(!memcmp(b,"abcd",4));
  close(f[0]);if(f[1]>=0)close(f[1]);if(child>0)waitpid(child,NULL,0);
 }
 return 0;
}
'''
 (d/'new.c').write_text(headers+fn+main)
 subprocess.run(['cc','-Wall','-Wextra','-Werror',str(d/'new.c'),'-o',str(d/'new')],check=True)
 subprocess.run([str(d/'new')],timeout=2,check=True)
print('keyd: original EOF spin reproduced; fixed EOF, partial, idle and fragmented requests PASS')
