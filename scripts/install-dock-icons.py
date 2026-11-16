#!/usr/bin/python3
"""Normalize favorite application icon artwork once, never in the Shell render loop."""
from pathlib import Path
import base64,json,mimetypes,sys,shutil
import gi
gi.require_version('Gtk','3.0')
from gi.repository import Gtk,Gio
root=Path.home()/'.local/share/icons/FamiliarMac-Aligned'
state=Path.home()/'.local/state/macbook-zorin/dock-icons.json'
settings=Gio.Settings.new('org.gnome.desktop.interface')
if '--restore' in sys.argv:
    if not state.exists():raise SystemExit('No managed icon alignment installed.')
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
    app=Gio.DesktopAppInfo.new(desktop)
    if not app or not isinstance(app.get_icon(),Gio.ThemedIcon):continue
    name=app.get_icon().get_names()[0]
    if '/' in name:continue
    info=theme.lookup_by_gicon(app.get_icon(),96,Gtk.IconLookupFlags.FORCE_SIZE)
    if not info or not info.get_filename():continue
    pix=info.load_icon();box=bounds(pix)
    if not box:continue
    x1,y1,x2,y2=box;scale=84/max(x2-x1,y2-y1)
    x=48-(x1+x2)*scale/2;y=48-(y1+y2)*scale/2
    source=Path(info.get_filename());mime=mimetypes.guess_type(source.name)[0] or 'image/png'
    encoded=base64.b64encode(source.read_bytes()).decode()
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="96" height="96" viewBox="0 0 96 96"><g transform="translate({x} {y}) scale({scale})"><image width="{pix.get_width()}" height="{pix.get_height()}" xlink:href="data:{mime};base64,{encoded}"/></g></svg>'
    out=target/(name+'.svg');out.write_text(svg)
    # Verify the actual SVG renderer, not just the transform calculation.
    from gi.repository import GdkPixbuf
    rendered=GdkPixbuf.Pixbuf.new_from_file_at_scale(str(out),96,96,True)
    actual=bounds(rendered)
    if not actual or abs(max(actual[2]-actual[0],actual[3]-actual[1])-84)>2:
        out.unlink();raise SystemExit(f'Icon renderer validation failed for {name}')
    print(name,box,'->',actual)
(root/'index.theme').write_text(f'[Icon Theme]\nName=FamiliarMac Aligned\nInherits={original}\nDirectories=apps/scalable\n\n[apps/scalable]\nSize=96\nType=Scalable\nMinSize=16\nMaxSize=512\nContext=Applications\n')
settings.set_string('icon-theme','FamiliarMac-Aligned');Gio.Settings.sync()
print('Favorite dock artwork aligned; original theme inherited. No background process.')
