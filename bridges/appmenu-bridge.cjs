// Export real Electron MenuItems; never emulate application commands.
const {spawn} = require('node:child_process');
// D-BusMenu uses an array of modifier/key names, not Electron's string.
function acceleratorShortcut(item) {
    const value = item.accelerator ?? item.getDefaultRoleAccelerator?.();
    if (typeof value !== 'string' || !value.trim()) return [];
    const parts = value.trim().replace(/\+\+$/, '+Plus').split('+');
    const modifiers = {ctrl:'Control', control:'Control', cmdorctrl:'Control',
        commandorcontrol:'Control', command:'Super', cmd:'Super', super:'Super',
        meta:'Super', alt:'Alt', option:'Alt', shift:'Shift'};
    const keys = {plus:'plus', space:'space', escape:'Escape', esc:'Escape',
        return:'Return', enter:'Return', backspace:'BackSpace', delete:'Delete',
        pageup:'Page_Up', pagedown:'Page_Down', up:'Up', down:'Down',
        left:'Left', right:'Right', home:'Home', end:'End', tab:'Tab', insert:'Insert'};
    const key = parts.pop();
    if (!key || parts.some(p => !modifiers[p.toLowerCase()])) return [];
    return [...new Set(parts.map(p => modifiers[p.toLowerCase()])), keys[key.toLowerCase()] ?? key];
}
let installed = false;
module.exports = function bridge(electron, initialWindow) {
    if (installed || process.platform !== 'linux') return;
    installed = true;
    const {app, Menu, BrowserWindow, webContents} = electron;
    const windows = new Set([initialWindow]);
    const child = spawn('/usr/bin/python3', ['/usr/local/lib/macbook-zorin/appmenu-exporter.py'],
        {stdio: ['pipe', 'pipe', 'ignore']});
    let actions = new Map(), signature = '', output = '', stopped = false;
    const itemIds = new WeakMap(); let nextId = 0;
    child.on('error', () => {stopped = true; clearInterval(timer);});
    child.on('exit', () => {stopped = true; clearInterval(timer);});
    child.stdin.on('error', () => {});
    function sync() {
        if (stopped) return;
        const next = new Map();
        const serialize = menu => (menu?.items ?? []).map(item => {
            let key = itemIds.get(item);
            if (!key) {key = ++nextId; itemIds.set(item, key);}
            next.set(key, item);
            return {id:key, label:item.label, type:item.type, enabled:item.enabled,
                visible:item.visible, checked:item.checked, shortcut:acceleratorShortcut(item),
                children:item.submenu ? serialize(item.submenu) : []};
        });
        const tree = serialize(Menu.getApplicationMenu());
        const ids = [...windows].filter(w => !w.isDestroyed()).map(w =>
            w.getNativeWindowHandle().readUInt32LE(0));
        const data = JSON.stringify({windows:ids, tree});
        actions = next;
        if (data !== signature) {signature = data; child.stdin.write(data+'\n');}
    }
    child.stdout.on('data', chunk => {
        output += chunk.toString();
        let end;
        while ((end=output.indexOf('\n')) !== -1) {
            const line=output.slice(0,end); output=output.slice(end+1);
            try {
                const message=JSON.parse(line);
                const item=actions.get(message.activate);
                const win=BrowserWindow.getFocusedWindow() || [...windows].find(w=>!w.isDestroyed());
                if (item && item.enabled !== false && item.visible !== false && !item.submenu)
                    item.click({}, win, webContents.getFocusedWebContents() || win?.webContents);
            } catch (_) { /* Ignore malformed/stale requests. */ }
        }
    });
    app.on('browser-window-created', (_event, window) => {
        windows.add(window); window.once('closed', () => windows.delete(window));
    });
    const timer = setInterval(sync, 500); timer.unref();
    app.once('before-quit', () => {clearInterval(timer); child.stdin.end();});
    sync();
};

module.exports.acceleratorShortcut = acceleratorShortcut;
