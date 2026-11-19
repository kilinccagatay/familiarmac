#!/usr/bin/python3
"""Wait for apt/dpkg owners without deleting locks or disturbing their processes."""
import errno
import fcntl
import os
import subprocess
import sys
import time

LOCKS=('/var/lib/dpkg/lock-frontend','/var/lib/dpkg/lock',
       '/var/lib/apt/lists/lock','/var/cache/apt/archives/lock')
WAIT='Waiting for another package manager to finish…'
RUN='Installing shared dependencies…'

def busy(paths=LOCKS):
    for path in paths:
        try:
            with open(path,'r+b') as stream:
                try: fcntl.lockf(stream,fcntl.LOCK_EX|fcntl.LOCK_NB)
                except OSError as error:
                    if error.errno in (errno.EACCES,errno.EAGAIN): return True
                    raise
        except FileNotFoundError: pass
    return False

def status(message):
    print('FAMILIARMAC_STATUS\t'+message,flush=True)

def run(args):
    waiting=False
    while True:
        while busy():
            if not waiting:status(WAIT);waiting=True
            time.sleep(1)
        status(RUN);waiting=False
        # apt still acquires its own locks atomically. A competing process can
        # win between our probe and exec: retry only an explicit lock failure.
        collision=False
        with subprocess.Popen(['/usr/bin/apt-get',*args],stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT,text=True,
                              env=dict(os.environ,LC_ALL='C')) as child:
            for line in child.stdout:
                print(line,end='',flush=True)
                if ('Could not get lock ' in line and
                    ('Resource temporarily unavailable' in line or 'It is held by process ' in line)):
                    collision=True
            code=child.wait()
        if code==0 or not collision:return code
        status(WAIT);waiting=True;time.sleep(1)

if __name__=='__main__':
    if os.geteuid()!=0:raise SystemExit('Package installation requires administrator privileges')
    raise SystemExit(run(sys.argv[1:]))
