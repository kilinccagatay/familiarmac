#!/usr/bin/python3
"""On-demand gmux backlight control through active-session logind permissions."""
from pathlib import Path
import argparse,fcntl,os

def next_brightness(current,maximum,direction):
    if maximum<=0:raise ValueError('Invalid backlight range')
    step=max(1,(maximum+15)//16)
    return max(0,min(maximum,current+step*(1 if direction=='up' else -1)))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('direction',choices=['up','down']);args=parser.parse_args()
    device=Path('/sys/class/backlight/gmux_backlight')
    if not device.exists():raise SystemExit('Supported gmux backlight not found; no changes made.')
    from gi.repository import Gio,GLib
    runtime=Path(os.environ.get('XDG_RUNTIME_DIR',f'/run/user/{os.getuid()}'))
    # Lock only for one key event, avoiding lost increments during autorepeat.
    with (runtime/'familiarmac-brightness.lock').open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        maximum=int((device/'max_brightness').read_text())
        current=int((device/'brightness').read_text())
        target=next_brightness(current,maximum,args.direction)
        bus=Gio.bus_get_sync(Gio.BusType.SYSTEM,None)
        bus.call_sync('org.freedesktop.login1','/org/freedesktop/login1/session/auto',
            'org.freedesktop.login1.Session','SetBrightness',
            GLib.Variant('(ssu)',('backlight','gmux_backlight',target)),None,
            Gio.DBusCallFlags.NONE,2000,None)
if __name__=='__main__':main()
