#!/usr/bin/python3
"""Normalize favorite application icon artwork once, never in the Shell render loop."""
from pathlib import Path
import base64,json,mimetypes,sys,shutil,hashlib,fcntl,os
import gi
gi.require_version('Gtk','3.0')
from gi.repository import Gtk,Gio
root=Path.home()/'.local/share/icons/FamiliarMac-Aligned'
state=Path.home()/'.local/state/macbook-zorin/dock-icons.json'
settings=Gio.Settings.new('org.gnome.desktop.interface')
refresh='--refresh' in sys.argv
uuid='familiarmac-icons@local'
helper=Path.home()/'.local/lib/familiarmac/align-icons.py'
if refresh and (not state.exists() or settings.get_string('icon-theme')!='FamiliarMac-Aligned'):
    print(json.dumps({'changed':False}));raise SystemExit(0)
lock_path=Path(os.environ.get('XDG_RUNTIME_DIR',f'/run/user/{os.getuid()}'))/'familiarmac-icon-align.lock'
lock=lock_path.open('w');fcntl.flock(lock,fcntl.LOCK_EX)
changed=False
cache_path=root/'alignment-cache.json'
cache=json.loads(cache_path.read_text()) if cache_path.exists() else {}

if '--restore' in sys.argv:
    if not state.exists():raise SystemExit('No managed icon alignment installed.')
    shell=Gio.Settings.new('org.gnome.shell')
    shell.set_strv('enabled-extensions',[x for x in shell.get_strv('enabled-extensions') if x!=uuid])
    helper.unlink(missing_ok=True)
    original=json.loads(state.read_text())['theme']
    if settings.get_string('icon-theme')!='FamiliarMac-Aligned':raise SystemExit('Icon theme changed; restore refused.')
    settings.set_string('icon-theme',original);Gio.Settings.sync()
    shutil.rmtree(root);state.unlink();raise SystemExit(0)
if root.exists() and not state.exists():raise SystemExit('Unmanaged icon directory exists; refusing overwrite.')
original=json.loads(state.read_text())['theme'] if state.exists() else settings.get_string('icon-theme')
theme=Gtk.IconTheme.new();theme.set_custom_theme(original)
target=root/'apps/scalable';target.mkdir(parents=True,exist_ok=True)
state.parent.mkdir(parents=True,exist_ok=True)
if not state.exists():state.write_text(json.dumps({'theme':original}));state.chmod(0o600)
def bounds(pix):
    w,h=pix.get_width(),pix.get_height();stride=pix.get_rowstride();channels=pix.get_n_channels();data=pix.get_pixels()
    points=[(x,y) for y in range(h) for x in range(w) if channels<4 or data[y*stride+x*channels+3]>=128]
    if not points:return None
    return min(x for x,y in points),min(y for x,y in points),max(x for x,y in points)+1,max(y for x,y in points)+1
for desktop in Gio.Settings.new('org.gnome.shell').get_strv('favorite-apps'):
    # Fresh installations may retain favorite IDs for optional/uninstalled apps.
    # PyGObject raises TypeError for a missing DesktopAppInfo instead of None.
    try:
        app=Gio.DesktopAppInfo.new(desktop)
    except TypeError:
        continue
    if not app or not isinstance(app.get_icon(),Gio.ThemedIcon):continue
    name=app.get_icon().get_names()[0]
    if '/' in name:continue
    info=theme.lookup_by_gicon(app.get_icon(),96,Gtk.IconLookupFlags.FORCE_SIZE)
    if not info or not info.get_filename():continue
    source=Path(info.get_filename())
    fingerprint=hashlib.sha256(source.read_bytes()).hexdigest()
    out=target/(name+'.svg')
    if cache.get(name)==fingerprint and out.exists():continue
    pix=info.load_icon();box=bounds(pix)
    if not box:continue
    x1,y1,x2,y2=box;scale=84/max(x2-x1,y2-y1)
    x=48-(x1+x2)*scale/2;y=48-(y1+y2)*scale/2
    source=Path(info.get_filename());mime=mimetypes.guess_type(source.name)[0] or 'image/png'
    encoded=base64.b64encode(source.read_bytes()).decode()
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="96" height="96" viewBox="0 0 96 96"><g transform="translate({x} {y}) scale({scale})"><image width="{pix.get_width()}" height="{pix.get_height()}" xlink:href="data:{mime};base64,{encoded}"/></g></svg>'
    temporary=out.with_suffix('.new.svg');temporary.write_text(svg)
    # Verify the actual SVG renderer, not just the transform calculation.
    from gi.repository import GdkPixbuf
    rendered=GdkPixbuf.Pixbuf.new_from_file_at_scale(str(temporary),96,96,True)
    actual=bounds(rendered)
    if not actual or abs(max(actual[2]-actual[0],actual[3]-actual[1])-84)>2:
        temporary.unlink();raise SystemExit(f'Icon renderer validation failed for {name}')
    temporary.replace(out)
    cache[name]=fingerprint;changed=True
    if not refresh:print(name,box,'->',actual)
index_content=(f'[Icon Theme]\nName=FamiliarMac Aligned\nInherits={original}\nDirectories=apps/scalable\n\n[apps/scalable]\nSize=96\nType=Scalable\nMinSize=16\nMaxSize=512\nContext=Applications\n')
if not (root/'index.theme').exists() or (root/'index.theme').read_text()!=index_content:
    (root/'index.theme').write_text(index_content);changed=True
if changed:
    cache_path.write_text(json.dumps(cache,indent=2));os.utime(target,None);os.utime(root,None)
settings.set_string('icon-theme','FamiliarMac-Aligned');Gio.Settings.sync()
if refresh:
    print(json.dumps({'changed':changed}))
else:
    helper.parent.mkdir(parents=True,exist_ok=True)
    helper.write_bytes(Path(__file__).read_bytes())
    extension=root.parents[1]/'gnome-shell/extensions'/uuid
    source_extension=Path(__file__).resolve().parents[1]/'extensions'/uuid
    shutil.copytree(source_extension,extension,dirs_exist_ok=True)
    shell=Gio.Settings.new('org.gnome.shell');enabled=shell.get_strv('enabled-extensions')
    if uuid not in enabled:shell.set_strv('enabled-extensions',enabled+[uuid])
    Gio.Settings.sync()
    print('Artwork aligned. Automatic favorites/install event watcher enabled; new Shell extensions may require login.')
