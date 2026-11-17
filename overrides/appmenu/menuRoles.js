// Match the application's real Window menu before adding a fallback. Labels may
// contain mnemonic markers; translated singular and plural forms are supplied
// by the caller. Never use substring matches (e.g. "Window Layout").
export function hasWindowMenu(menus, localized = []) {
    const normalize = label => String(label ?? '').replace(/[_&]/g, '').trim().toLocaleLowerCase();
    const names = new Set(['window', 'windows', ...localized.map(normalize)]);
    return menus.some(menu => names.has(normalize(menu.label)));
}

// Explicit user-requested display alias; do not match other GNU applications.
export function panelAppName(name, appId) {
    return ['gimp.desktop', 'org.gimp.GIMP.desktop'].includes(appId) ? 'GIMP' : name;
}

// Dialogs retain their owning application, but actions still target the focused
// dialog. Never borrow the previous application's identity for an orphan window.
export function menuWindowIdentity(window, tracker) {
    let current = window;
    const seen = new Set();
    const chain = [];
    while (current && !seen.has(current) && seen.size < 16) {
        seen.add(current);
        chain.push(current);
        current = current.get_transient_for?.();
    }
    // The transient owner is authoritative, even if the dialog itself is
    // tracked as a separate application (e.g. org.gnome.Portal).
    for (const owner of chain.reverse()) {
        const app = tracker.get_window_app(owner);
        if (app && !/^(org\.freedesktop\.impl\.portal\.|org\.gnome\.Portal(?:\.|$)|xdg-desktop-portal)/i.test(app.get_id?.() ?? ''))
            return app;
    }
    // With no actual owner relation, do not guess from the previously focused app.
    return tracker.get_window_app(window);
}

export function isApplicationWindowType(type) {
    // Meta.WindowType NORMAL, DIALOG, MODAL_DIALOG, UTILITY; never desktop/dock.
    return [0, 3, 4, 7].includes(type);
}

// Preserve non-menu actors (including hidden Activities) in their exact slots.
export function orderedMenuActors(children, menus) {
    const present = menus.filter(actor => children.includes(actor));
    let index = 0;
    return children.map(actor => present.includes(actor) ? present[index++] : actor);
}
