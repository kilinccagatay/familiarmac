import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Never confuse Close Tab, Exit Fullscreen or account sign-out with app quit.
export function quitAction(model, appName = '') {
    const nodes=[];
    const visit=items=>{
        for (const item of items??[]) {
            if (typeof item.activate==='function') nodes.push(item);
            if (Array.isArray(item.children)) visit(item.children);
        }
    };
    visit(model?.appMenuChildren); visit(model?.topLevelMenus);
    const action=nodes.find(item=>/^(?:app\.)?(?:quit|exit)$/.test(item.actionId??'')) ??
        nodes.find(item=>{
            const label=(item.label??'').replace(/[_&]/g,'').trim().toLocaleLowerCase();
            const name=appName.replace(/[_&]/g,'').trim().toLocaleLowerCase();
            return /^(?:quit|exit|çıkış|çık|beenden|quitter|avsluta)$/.test(label) ||
                (!!name && ['quit ', 'exit '].some(prefix=>label === prefix+name));
        });
    // An explicitly disabled Quit must not become an enabled close fallback.
    return action??null;
}

// Match the focused Shell application to an indicator's desktop identity.
// Invoke its exported Quit event directly, without a window-activation token.
export function trayQuitAction(app, statusArea = Main.panel?.statusArea ?? {}) {
    const id = app.get_id?.();
    if (!id) return null;
    for (const button of Object.values(statusArea)) {
        if (button._indicator?._appInfo?.get_id?.() !== id) continue;
        const root = button._menuClient?._client?.getRoot?.();
        const convert = item => {
            if (!item || !item.propertyGetBool('visible')) return null;
            const children = (item.getChildren?.() ?? []).map(convert).filter(Boolean);
            return {label: item.propertyGet('label'), sensitive: item.propertyGetBool('enabled'), children,
                activate: children.length ? undefined : () => item.handleEvent('clicked', null, global.get_current_time())};
        };
        const action = quitAction({topLevelMenus: (root?.getChildren?.() ?? []).map(convert).filter(Boolean)}, app.get_name?.() ?? '');
        if (action) return action;
    }
    return null;
}

export class ApplicationQuit {
    constructor(menuManager) {
        this.manager=menuManager;
        this.id=global.display.grab_accelerator('<Control><Alt><Super>q',Meta.KeyBindingFlags.IGNORE_AUTOREPEAT);
        if (!this.id) {console.warn('FamiliarMac: Quit accelerator already owned; quit binding unchanged');return;}
        this.name=Meta.external_binding_name_for_action(this.id);
        Main.wm.allowKeybinding(this.name,Shell.ActionMode.NORMAL);
        this.signal=global.display.connect('accelerator-activated',(_display,id)=>{
            if(id===this.id)this.activate();
        });
    }
    activate() {
        const window=global.display.get_focus_window();
        if (!window || window.skip_taskbar || window.is_override_redirect?.()) return;
        const app=Shell.WindowTracker.get_default().get_window_app(window);
        if (!app) return;
        // Fetch against the actual focused window, never a cached menu from
        // another app or a menu action captured when the shortcut was bound.
        if (this.retry) GLib.source_remove(this.retry);
        this.retry = 0;
        const attempt = () => {
            if (global.display.get_focus_window() !== window) return true;
            const model=this.manager.updateForWindow(window,app.get_name(),app,window.get_wm_class?.()??'');
            const action=quitAction(model, app.get_name()) ?? trayQuitAction(app);
            if (!action) return false;
            if (action.sensitive!==false) {
                try { Promise.resolve(action.activate()).catch(error => this.failed(app, error)); }
                catch(error) { this.failed(app, error); }
            }
            return true;
        };
        if (attempt()) return;
        // AppInfo resolution and D-Bus menu loading are asynchronous after launch.
        // Keep the original focus target; never quit a newly focused application.
        let remaining = 20;
        this.retry = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            if (attempt()) { this.retry=0; return GLib.SOURCE_REMOVE; }
            if (--remaining > 0) return GLib.SOURCE_CONTINUE;
            this.retry=0;
            this.failed(app);
            return GLib.SOURCE_REMOVE;
        });
    }
    failed(app, error = null) {
        if (error) console.warn(`FamiliarMac Quit: ${error.message}`);
        Main.notify('Quit unavailable', `${app.get_name()} does not currently provide an accessible Quit action. Use its own Quit menu.`);
    }
    destroy() {
        if(this.retry)GLib.source_remove(this.retry);
        this.retry=0;
        if(this.signal)global.display.disconnect(this.signal);
        if(this.id){Main.wm.allowKeybinding(this.name,Shell.ActionMode.NONE);global.display.ungrab_accelerator(this.id);}
        this.manager=null;this.signal=0;this.id=0;
    }
}
