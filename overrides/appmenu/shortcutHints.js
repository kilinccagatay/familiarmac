// Display actual exported accelerators in Apple notation. Account for FamiliarMac's
// keyd translations; never assign a shortcut merely by matching a translated label.
export function shortcutHint(shortcut, appId = '') {
    if (!shortcut) return '';
    if (/[⌘⌥⇧⌃]/.test(shortcut)) return shortcut;
    const parts = Array.isArray(shortcut) ? shortcut : shortcut.replace(/<([^>]+)>/g, '$1+').split('+');
    const mods = new Set();
    let key = '';
    for (const part of parts) {
        const p = part.trim().toLowerCase();
        if (['control','ctrl','primary'].includes(p)) mods.add('ctrl');
        else if (['shift','alt','super','meta'].includes(p)) mods.add(p === 'meta' ? 'super' : p);
        else if (p) key = p;
    }
    if (!key) return '';
    const terminal = /terminal|console|kitty/i.test(appId);
    const terminalKeys = /kitty/i.test(appId) ? /^[cvt]$/ : /console/i.test(appId) ? /^[cvtnw]$/ : /^[cvtnwf]$/;
    if (terminal && mods.has('ctrl') && mods.has('shift') && terminalKeys.test(key)) {
        mods.delete('ctrl'); mods.delete('shift'); mods.add('cmd');
    } else if (mods.has('ctrl') && !terminal && !['h','m','left','right','up','down','backspace'].includes(key)) {
        mods.delete('ctrl'); mods.add('cmd');
    }
    const keys = {escape:'⎋',esc:'⎋',return:'↩',enter:'↩',backspace:'⌫',delete:'⌦',space:'Space',tab:'⇥',left:'←',right:'→',up:'↑',down:'↓',comma:',',period:'.',plus:'+',minus:'-'};
    return (mods.has('ctrl')?'⌃':'')+(mods.has('alt')?'⌥':'')+(mods.has('shift')?'⇧':'')+
        (mods.has('cmd')||mods.has('super')?'⌘':'')+(keys[key] ?? key.toUpperCase());
}

export function itemShortcut(item, appId = '') {
    if (item.shortcut) return shortcutHint(item.shortcut, appId);
    if (item.action?.startsWith('custom-shortcut:'))
        return shortcutHint(item.action.slice('custom-shortcut:'.length), appId);
    // Only existing dispatcher/keyd pairs with matching behavior.
    const common = {copy:'⌘C',paste:'⌘V',cut:'⌘X',undo:'⌘Z','select-all':'⌘A',
        'new-tab':'⌘T',print:'⌘P',find:'⌘F',minimize:'⌘M','hide-app':'⌘H',
        'toggle-fullscreen':'⌃⌘F','open-search':'⌘Space'};
    return common[item.action] ?? '';
}
