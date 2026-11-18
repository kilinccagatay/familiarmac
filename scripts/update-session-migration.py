#!/usr/bin/python3
"""Finish successful legacy-updater extension migrations at the next login."""
import json
import os
from pathlib import Path
import shutil
from desktop_layout import select_extensions

def main():
    base=Path.home()/'.local/share/familiarmac/update-migration'
    state=Path(os.environ.get('XDG_STATE_HOME',Path.home()/'.local/state'))/'familiarmac/releases'
    pending=base/'pending.json'
    if not pending.exists(): return
    requested=json.loads(pending.read_text())['version']
    try: installed=json.loads((state/'installed.json').read_text())['version']
    except (OSError,ValueError,KeyError): return
    if installed!=requested: return
    from gi.repository import Gio
    shell=Gio.Settings.new('org.gnome.shell')
    enabled,disabled=select_extensions(shell.get_strv('enabled-extensions'),shell.get_strv('disabled-extensions'),bool(shutil.which('keyd-application-mapper')))
    shell.set_strv('disabled-extensions',disabled)
    shell.set_strv('enabled-extensions',enabled)
    Gio.Settings.sync()
    pending.unlink()

if __name__=='__main__': main()
