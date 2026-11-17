// Real GI arity check: optional callbacks still require two arguments in GJS.
imports.gi.versions.Dbusmenu = '0.4';
const {Dbusmenu, Gio} = imports.gi;
const [, bytes] = Gio.File.new_for_path('overrides/appmenu/realMenuManager.js').load_contents(null);
const source = new TextDecoder().decode(bytes);
const method = source.match(/_aboutToShow\(item\) \{([\s\S]*?)\n    \}/)[1];
const item = new Dbusmenu.Menuitem();
item.child_append(new Dbusmenu.Menuitem());
let caught = null;
new Function('item', 'Logger', method)(item, {debug: e => caught = e});
if (caught) throw new Error(caught);
print('Lazy D-Bus menus: real GJS AboutToShow callback arity PASS');
