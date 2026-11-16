const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('extensions/familiarmac-panel-layout@local/layout.js', 'utf8');
const ranges = new Function(source.replace('export function', 'function') + '; return panelRanges;')();
assert.deepEqual(ranges(1440, 850, 350, 8), {left:[0,850],right:[1090,1440]});
assert.deepEqual(ranges(800, 650, 350, 8), {left:[0,442],right:[450,800]});
assert.deepEqual(ranges(800, 650, 350, 8,true), {left:[358,800],right:[0,350]});
for (const width of [0,400,1440,2880]) {
 const r=ranges(width,2000,350,16);
 assert(r.left[1]<=r.right[0]); assert(r.right[1]<=width);
}
console.log('Panel allocation: spare space, bounded overflow, scaling and RTL PASS');
