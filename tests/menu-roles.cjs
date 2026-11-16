const fs = require('node:fs'), assert = require('node:assert/strict');
const source = fs.readFileSync('overrides/appmenu/menuRoles.js','utf8').replace(/^export /gm,'');
const has = new Function(source+';return hasWindowMenu;')();
for (const label of ['Window','Windows','&Windows','_Window','  WINDOWS  '])
 assert(has([{label}]));
assert(has([{label:'Fenster'}], ['Fenster']));
assert(!has([{label:'Window Layout'}]));
assert(!has([{label:'File'},{}]));
assert(!has([]));
console.log('Shared native Window/Windows detection, mnemonics and translated labels PASS');
