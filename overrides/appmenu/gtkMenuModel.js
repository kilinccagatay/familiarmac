import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Read real GMenu trees and GAction state. No guessed labels or key presses.
export class GtkMenuModel {
    constructor(bus, menuPath, appPath, windowPath, changed) {
        this._changed = changed;
        this._signals = [];
        this._models = new Set();
        this._groups = {};
        this._root = Gio.DBusMenuModel.get(Gio.DBus.session, bus, menuPath);
        for (const [prefix, path] of Object.entries({app: appPath, win: windowPath, unity: menuPath})) {
            if (!path) continue;
            const group = Gio.DBusActionGroup.get(Gio.DBus.session, bus, path);
            this._groups[prefix] = group;
            for (const signal of ['action-added', 'action-removed', 'action-enabled-changed', 'action-state-changed'])
                this._signals.push([group, group.connect(signal, () => this._notify())]);
            group.list_actions();
        }
        this._watch(this._root);
    }

    _notify() {
        if (this._pending || !this._changed) return;
        this._pending = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._pending = 0;
            this._changed?.();
            return GLib.SOURCE_REMOVE;
        });
    }

    _watch(model) {
        if (this._models.has(model)) return;
        this._models.add(model);
        this._signals.push([model, model.connect('items-changed', () => this._notify())]);
    }

    _items(model, depth = 0) {
        if (depth > 10) return [];
        this._watch(model);
        const items = [];
        for (let i = 0; i < model.get_n_items(); i++) {
            const section = model.get_item_link(i, 'section');
            if (section) {
                const children = this._items(section, depth + 1);
                if (children.length && items.length) items.push({type: 'separator'});
                items.push(...children);
                continue;
            }
            const get = name => model.get_item_attribute_value(i, name, null);
            const label = (get('label')?.deepUnpack() ?? '').replace(/_([^_])/g, '$1').replace(/__/g, '_');
            if (!label) continue;
            const submenu = model.get_item_link(i, 'submenu');
            if (submenu) {
                items.push({type: 'submenu', label, children: this._items(submenu, depth + 1)});
                continue;
            }
            const full = get('action')?.deepUnpack() ?? '';
            const dot = full.indexOf('.');
            const group = this._groups[full.slice(0, dot)];
            const name = full.slice(dot + 1);
            const target = get('target');
            const state = group?.get_action_state(name);
            let ornament = null;
            if (state && target) ornament = state.equal(target) ? 'dot' : null;
            else if (state?.get_type_string() === 'b') ornament = state.get_boolean() ? 'check' : null;
            const shortcut = get('accel')?.deepUnpack() ?? get('x-gtk-accel')?.deepUnpack() ?? '';
            items.push({label, shortcut, sensitive: Boolean(group?.has_action(name) && group.get_action_enabled(name)),
                ornament, activate: () => {
                    if (group?.has_action(name) && group.get_action_enabled(name)) group.activate_action(name, target);
                }});
        }
        return items;
    }

    build(key) {
        const seen = new Set();
        const menus = this._items(this._root).filter(item => {
            // GTK module may append a compatibility copy of an existing native menu.
            if (item.type !== 'submenu' || seen.has(item.label)) return false;
            seen.add(item.label); return true;
        });
        return menus.length ? {registrationKey: key, appMenuChildren: null, topLevelMenus: menus} : null;
    }

    destroy() {
        this._changed = null;
        if (this._pending) GLib.source_remove(this._pending);
        this._pending = 0;
        for (const [object, id] of this._signals) object.disconnect(id);
        this._signals = [];
        this._models.clear();
        this._root = null;
        this._groups = {};
    }
}
