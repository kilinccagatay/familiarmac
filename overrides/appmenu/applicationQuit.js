import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Never confuse Close Tab, Exit Fullscreen or account sign-out with app quit.
export function quitAction(model) {
    const nodes=[];
    const visit=items=>{
        for (const item of items??[]) {
            if (typeof item.activate==='function') nodes.push(item);
            if (Array.isArray(item.children)) visit(item.children);
        }
    };
    visit(model?.appMenuChildren); visit(model?.topLevelMenus);
    const action=nodes.find(item=>/^(?:app\.)?(?:quit|exit)$/.test(item.actionId??'')) ??
        nodes.find(item=>/^(?:quit|exit|çıkış|çık|beenden|quitter|avsluta)$/i.test((item.label??'').replace(/[_&]/g,'').trim()));
    // An explicitly disabled Quit must not become an enabled close fallback.
    return action??null;
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
        const model=this.manager.updateForWindow(window,app.get_name(),app,window.get_wm_class?.()??'');
        const action=quitAction(model);
        if(action) {
            if(action.sensitive!==false) action.activate();
        } else app.request_quit(); // Normal WM_DELETE requests; no signals/kill.
    }
    destroy() {
        if(this.signal)global.display.disconnect(this.signal);
        if(this.id){Main.wm.allowKeybinding(this.name,Shell.ActionMode.NONE);global.display.ungrab_accelerator(this.id);}
        this.manager=null;this.signal=0;this.id=0;
    }
}
