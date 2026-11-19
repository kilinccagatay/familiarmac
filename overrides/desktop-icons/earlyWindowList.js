// Hide owned desktop surfaces before map handlers publish running applications.
// Ordinary DING dialogs and other GJS applications must remain visible.
export class EarlyDesktopWindowList {
    constructor(display, windowManager, getClient) {
        this.getClient = getClient;
        this.windows = new Map();
        this.signals = [
            [display, display.connect('window-created', (_d, window) => this.watch(window))],
            [windowManager, windowManager.connect('map', (_wm, actor) => {
                const window = actor.get_meta_window();
                this.hide(window);
                this.forget(window);
            })],
        ];
    }
    hide(window) {
        const client = this.getClient();
        if (!client || !/^Desktop Icons [1-9]\d*$/.test(window.get_title() ?? '') ||
            !client.query_window_belongs_to(window)) return false;
        client.hide_from_window_list(window);
        return true;
    }
    watch(window) {
        if (this.hide(window) || this.windows.has(window)) return;
        const title = window.connect('notify::title', () => {
            if (this.hide(window)) this.forget(window);
        });
        const unmanaged = window.connect('unmanaged', () => this.forget(window));
        this.windows.set(window, [title, unmanaged]);
    }
    refresh() {
        for (const window of this.windows.keys())
            if (this.hide(window)) this.forget(window);
    }
    forget(window) {
        for (const signal of this.windows.get(window) ?? []) window.disconnect(signal);
        this.windows.delete(window);
    }
    destroy() {
        for (const [object, signal] of this.signals) object.disconnect(signal);
        for (const window of this.windows.keys()) this.forget(window);
    }
}
