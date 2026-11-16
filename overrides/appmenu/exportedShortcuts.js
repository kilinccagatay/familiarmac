// Shared by every application exporting GMenu or D-BusMenu. Preserve native
// bindings; no translated-label matching and no new key grabs.
export function gmenuShortcut(getAttribute) {
    for (const name of ['accel', 'x-gtk-accel']) {
        const value = getAttribute(name)?.deepUnpack();
        if (typeof value === 'string' && value.trim()) return value;
    }
    return '';
}

export function dbusMenuShortcut(item) {
    const alternatives = item.property_get_variant('shortcut')?.deepUnpack();
    if (!Array.isArray(alternatives)) return '';
    return alternatives.find(keys => Array.isArray(keys) && keys.length &&
        keys.every(key => typeof key === 'string' && key.length)) ?? '';
}
