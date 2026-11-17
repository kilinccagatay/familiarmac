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

const display = new Function(source+';return panelAppName;')();
assert.equal(display('GNU Image Manipulation Program','gimp.desktop'), 'GIMP');
assert.equal(display('GIMP','org.gimp.GIMP.desktop'), 'GIMP');
assert.equal(display('GNU Emacs','emacs.desktop'), 'GNU Emacs');
assert.equal(display('GIMP',undefined), 'GIMP');
const identity = new Function(source+';return menuWindowIdentity;')();
const types = new Function(source+';return isApplicationWindowType;')();
const app = {get_id:()=> 'editor.desktop'}, portal = {get_id:()=> 'org.freedesktop.impl.portal.desktop.gtk.desktop'};
const parent = {app}; const dialog = {get_transient_for:()=>parent};
const tracker = {get_window_app:w=>w?.app??null};
assert.equal(identity(dialog,tracker),app);
dialog.app=portal; assert.equal(identity(dialog,tracker),app);
const orphan={get_transient_for(){return this;}};
assert.equal(identity(orphan,tracker),null);
for(const type of [0,3,4,7])assert(types(type));
for(const type of [1,2,5,6,8])assert(!types(type));
console.log('Dialog ownership, portal parent, cyclic orphan and desktop exclusion PASS');

dialog.app={get_id:()=> 'org.gnome.Portal.desktop'};
assert.equal(identity(dialog,tracker),app);
dialog.app={get_id:()=> 'unrelated-helper.desktop'};
assert.equal(identity(dialog,tracker),app, 'actual transient parent must own helper');
const orphanPortal={app:portal};assert.equal(identity(orphanPortal,tracker),portal);
console.log('Separate helper and GNOME Portal ownership prefer actual parent; orphan identity is not guessed PASS');
