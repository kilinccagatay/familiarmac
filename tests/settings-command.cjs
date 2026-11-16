const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let installed=false;
const c={GLib:{get_home_dir:()=>'/home/test user',build_filenamev:p=>p.join('/'),FileTest:{IS_EXECUTABLE:1},file_test:()=>installed}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/settingsCommand.js','utf8').replace(/^import.*\n/gm,'').replace(/^export /gm,''),c);
assert.equal(c.settingsCommand(),'gnome-control-center');installed=true;
assert.equal(c.settingsCommand(),'/home/test user/.local/bin/familiarmac-settings');
console.log('Settings launcher: guarded user wrapper and native fallback PASS');
