// Match the application's real Window menu before adding a fallback. Labels may
// contain mnemonic markers; translated singular and plural forms are supplied
// by the caller. Never use substring matches (e.g. "Window Layout").
export function hasWindowMenu(menus, localized = []) {
    const normalize = label => String(label ?? '').replace(/[_&]/g, '').trim().toLocaleLowerCase();
    const names = new Set(['window', 'windows', ...localized.map(normalize)]);
    return menus.some(menu => names.has(normalize(menu.label)));
}
