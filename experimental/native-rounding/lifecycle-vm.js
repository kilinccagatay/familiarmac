import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
const a=global.get_window_actors().find(a=>a.meta_window.get_title().includes('Native Rounding Test'));const w=a.meta_window;
const original=w.get_frame_rect();const rows=[];
const phases=[['resize-small',()=>w.move_resize_frame(false,120,140,500,340)],['resize-large',()=>w.move_resize_frame(false,100,100,900,600)],['fullscreen',()=>w.make_fullscreen()],['fullscreen-exit',()=>w.unmake_fullscreen()],['maximize',()=>w.maximize(Meta.MaximizeFlags.BOTH)],['unmaximize',()=>w.unmaximize(Meta.MaximizeFlags.BOTH)],['overview',()=>Main.overview.show()],['overview-exit',()=>Main.overview.hide()],['restore',()=>w.move_resize_frame(false,original.x,original.y,original.width,original.height)]];
let i=0;
GLib.timeout_add(GLib.PRIORITY_DEFAULT,2500,()=>{
 if(i){const e=a.get_effect('Rounded Corners Effect');const r=w.get_frame_rect();rows.push({phase:phases[i-1][0],fullscreen:w.is_fullscreen(),rect:[r.x,r.y,r.width,r.height],enabled:e?.enabled,offscreen:e instanceof Clutter.OffscreenEffect,values:e?._values});GLib.file_set_contents('/home/tester/native-rounding/lifecycle.json',JSON.stringify(rows,null,2));}
 if(i===phases.length)return GLib.SOURCE_REMOVE;phases[i++][1]();return GLib.SOURCE_CONTINUE;
});
