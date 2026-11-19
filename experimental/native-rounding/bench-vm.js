import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import System from 'system';
import {RoundedCornersEffect as Legacy} from 'file:///home/tester/.local/share/gnome-shell/extensions/rounded-window-corners@fxgn/effect/rounded_corners_effect_legacy.js';
import {getPref} from 'file:///home/tester/.local/share/gnome-shell/extensions/rounded-window-corners@fxgn/utils/settings.js';
const actor=global.get_window_actors().find(a=>a.meta_window.get_title().includes('Native Rounding Test'));
const native=actor.get_effect('Rounded Corners Effect');
const v=native._values.slice();
const config=getPref('global-rounded-corner-settings');
// Keep identical geometry and the same shadow state in both modes.
let legacy=null; const results=[]; const modes=['native','legacy','native','legacy','native']; let index=0;
function step(){
 if(index===modes.length){native.enabled=true;GLib.file_set_contents('/home/tester/native-rounding/bench.json',JSON.stringify(results,null,2));return;}
 const mode=modes[index++];
 if(legacy){actor.remove_effect(legacy);legacy=null;}
 native.enabled=mode==='native';
 if(mode==='legacy'){
 legacy=new Legacy();actor.add_effect_with_name('Benchmark legacy',legacy);
 const p=config.padding;legacy.updateUniforms(1,config,{x1:v[0]-p.left,y1:v[1]-p.top,x2:v[2]+p.right,y2:v[3]+p.bottom});
 }
 System.gc();
 GLib.timeout_add(GLib.PRIORITY_DEFAULT,2000,()=>{
 let last=0; const values=[];
 const id=global.stage.connect('after-paint',()=>{const t=GLib.get_monotonic_time()/1000;if(last)values.push(t-last);last=t;});
 GLib.timeout_add(GLib.PRIORITY_DEFAULT,10000,()=>{
 global.stage.disconnect(id);values.sort((a,b)=>a-b);
 results.push({mode,count:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)]});
 if(legacy){actor.remove_effect(legacy);legacy=null;}
 native.enabled=true;GLib.file_set_contents('/home/tester/native-rounding/bench-progress.json',JSON.stringify(results,null,2));step();return GLib.SOURCE_REMOVE;});return GLib.SOURCE_REMOVE;});
}
step();
