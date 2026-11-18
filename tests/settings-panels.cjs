const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const c={Gio:{},GLib:{shell_parse_argv:s=>[true,s.split(' ')],path_get_basename:s=>s.split('/').at(-1)}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/settingsPanels.js','utf8').replace(/^import.*\n/gm,'').replace(/^export /gm,''),c);
const info=(id,name,cmd)=>({get_id:()=>id,get_name:()=>name,get_commandline:()=>cmd});
const panels=c.settingsPanels([
 info('gnome-wifi-panel.desktop','Wi-Fi','gnome-control-center wifi'),
 info('gnome-about-panel.desktop','About','/usr/bin/gnome-control-center system about'),
 info('gnome-copy-panel.desktop','Duplicate','gnome-control-center wifi'),
 info('gnome-background-panel.desktop','Appearance','/home/user/.local/share/familiarmac/about/gnome-control-center background'),
 info('other.desktop','Other','gnome-control-center sound'),
 info('gnome-invalid-panel.desktop','Invalid','sh -c other'),
 info('gnome-bad-panel.desktop','Bad','gnome-control-center --help'),
]);
assert.equal(JSON.stringify(panels),JSON.stringify([{name:'About',args:['system','about']},{name:'Appearance',args:['background']},{name:'Wi-Fi',args:['wifi']}]));
console.log('Settings Dock panels: installed names, subpage arguments, deduplication and filtering PASS');
