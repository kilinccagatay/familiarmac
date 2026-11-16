#!/usr/bin/env bash
# Existing sessions retain a working grid until new Shell code loads.
if ! gdbus call --session --dest org.gnome.Shell --object-path /org/familiarmac/Apps --method org.familiarmac.Apps.Show >/dev/null 2>&1; then
    exec gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.ShowApplications
fi
