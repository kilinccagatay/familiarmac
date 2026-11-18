const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('extensions/macbook-menu@local/bluetoothSurface.js','utf8').replace(/^import .*;$/gm,'').replace(/^export /gm,'').replaceAll('import.meta.url',JSON.stringify('file:///tmp/bluetoothSurface.js'));
const ctx={};vm.runInNewContext(source,ctx);
assert.equal(ctx.displayDeviceName('Çağatay KILINÇ\u0087’s Mouse'),'Çağatay KILINÇ’s Mouse');
assert.equal(ctx.displayDeviceName('東京 🎧 – Élodie'),'東京 🎧 – Élodie');
assert.equal(ctx.displayDeviceName('A\nB\u007f'),'AB');
console.log('Bluetooth labels remove C0/C1 controls while preserving Unicode names PASS');

for(const id of ['usb:v05ACp030Dd0306','bluetooth:v004Cp0269d0001','usb:v05ACp0323'])assert(ctx.isMagicMouseModalias(id));
for(const id of ['usb:v05ACp0262d0001','usb:v046Dp030Dd0001','Magic Mouse',null])assert(!ctx.isMagicMouseModalias(id));
console.log('Magic Mouse icons use hardware identity, excluding keyboards and non-Apple mice PASS');
