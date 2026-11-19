import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export function bounceOffset(milliseconds, height) {
    // Ease out of the Dock, pause at the apex, return to exactly the baseline.
    const phase = (milliseconds % 900) / 900;
    return phase > 0 && phase < 0.8 ? -height * 0.42 * Math.sin(Math.PI * phase / 0.8) : 0;
}
export function readyWindow(app) {
    return app.get_windows().some(w => !w.skip_taskbar && !w.minimized &&
        !w.is_override_redirect() && w.get_compositor_private()?.mapped);
}
export class DockBounce {
    constructor(magnification) {
        global[Symbol.for("familiarmac.dockBounce")]?.destroy();
        global[Symbol.for("familiarmac.dockBounce")] = this;
        this.magnification = magnification;
        this.pending = new Map(); this.icons = new Map(); this.dashes = new Map();
        this.timeline = null;
        this.startupChecks = new Map();
        const dir = GLib.build_filenamev([GLib.get_user_data_dir(), 'gnome-shell/extensions/familiarmac-genie@local/schemas']);
        const source = Gio.SettingsSchemaSource.new_from_directory(dir, Gio.SettingsSchemaSource.get_default(), false);
        this.settings = new Gio.Settings({settings_schema: source.lookup('org.gnome.shell.extensions.familiarmac-genie', true)});
        this.desktop = new Gio.Settings({schema_id:'org.gnome.desktop.interface'});
        this.appSystem = Shell.AppSystem.get_default();
        this.signals = [
            [this.appSystem, this.appSystem.connect('app-state-changed', (_s, app) => {
                if (app.state === Shell.AppState.STARTING) this.queueStartup(app);
                else if (app.state === Shell.AppState.STOPPED && this.pending.delete(app.get_id())) this.redisplay();
            })],
            [this.settings, this.settings.connect('changed::dock-launch-animation', () => this.cancel())],
            [this.desktop, this.desktop.connect('changed::enable-animations', () => this.cancel())],
            [Main.layoutManager, Main.layoutManager.connect('monitors-changed', () => this.cancel())],
        ];
        this.scan();
    }
    queueStartup(app) {
        const id = app.get_id();
        if (this.startupChecks.has(id)) return;
        // Tray menu actions also generate startup tokens (including Quit).
        // Wait until token creation returns so the tray controller can identify
        // its own token; explicit Dock launches still call start() directly.
        this.startupChecks.set(id, GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this.startupChecks.delete(id);
            if (app.state === Shell.AppState.STARTING &&
                !global[Symbol.for("familiarmac.trayActivation")]?.hasApp(id))
                this.start(app);
            return GLib.SOURCE_REMOVE;
        }));
    }
    allowed() { return this.settings.get_boolean('dock-launch-animation') && this.desktop.get_boolean('enable-animations'); }
    start(app) {
        if (!this.allowed() || readyWindow(app) || app.get_id() === 'org.familiarmac.Apps.desktop') return;
        if (!this.pending.has(app.get_id())) this.pending.set(app.get_id(), {app, start:GLib.get_monotonic_time()});
        this.scan(); this.redisplay();
        if (this.timeline) return;
        this.timeline = new Clutter.Timeline({actor:global.stage,duration:1000,repeat_count:-1});
        this.timeline.connect('new-frame', () => this.update()); this.timeline.start();
    }
    scan() {
        const visit = actor => {
            const dash = actor._delegate;
            if (dash?._box === actor && typeof dash._redisplay === 'function' && !this.dashes.has(dash)) {
                const original = dash._redisplay, owner = this;
                // A display-only list for this Dash call. Never alter Shell app
                // states, startup sequences, favorites or the global AppSystem.
                const wrapper = function (...args) {
                    const system = this._appSystem;
                    this._appSystem = {get_running: () => [...new Set([...system.get_running(),
                        ...[...owner.pending.values()].map(p => p.app)])]};
                    try { return original.apply(this,args); } finally { this._appSystem = system; }
                };
                dash._redisplay = wrapper;
                const signal = actor.connect('destroy', () => this.dashes.delete(dash));
                this.dashes.set(dash,{actor,original,wrapper,signal});
            }
            if (actor.app?.get_id && actor.icon?.icon && !this.icons.has(actor)) {
                const original = actor.animateLaunch;
                const wrapper = () => this.start(actor.app);
                actor.animateLaunch = wrapper;
                // A press may become a drag/unpin. Only a completed click is a
                // launch request; St.Button cancels clicked when dragging.
                const clicked = actor.connect('clicked', (_a,button) => {
                    if (button === 1) this.start(actor.app);
                });
                const item = {original,wrapper,clicked,clone:null,texture:null};
                item.signal = actor.connect('destroy', () => { this.reset(actor,item);this.icons.delete(actor); });
                this.icons.set(actor,item);
            }
            for (const child of actor.get_children()) visit(child);
        };
        for (const actor of Main.uiGroup.get_children()) if (actor.name === 'dashtodockContainer') visit(actor);
    }
    redisplay() {
        for (const dash of this.dashes.keys()) if (dash.mapped && !dash._dragPlaceholder && !dash._animatingPlaceholdersCount) dash._queueRedisplay();
    }
    reset(icon,item) {
        item.clone?.destroy(); item.clone=null;
        if (item.texture) {item.texture.opacity=item.opacity;item.texture=null;}
        delete icon._fmLaunchAnimating;
    }
    update() {
        const now=GLib.get_monotonic_time();let changed=false;
        for (const [id,p] of this.pending) if (readyWindow(p.app) || now-p.start>15000000) {this.pending.delete(id);changed=true;}
        if(changed)this.redisplay();
        if (!this.lastScan || now-this.lastScan>200000) {this.scan();this.lastScan=now;}
        for (const [icon,item] of this.icons) {
            const p=this.pending.get(icon.app.get_id());
            if(!p || !icon.mapped || Main.overview.visible || Main.modalCount || icon._draggable?._dragActor || !this.allowed()) {this.reset(icon,item);continue;}
            const dock=this.magnification?.dockFor(icon);
            if(dock && !this.magnification.dockReveal(dock).allowed){this.reset(icon,item);continue;}
            if(!item.clone){
                const mag=this.magnification?.items.get(icon);
                if(mag)this.magnification.reset(icon,mag);
                icon._fmLaunchAnimating=true;
                const texture=icon.icon.icon;
                const size=texture.icon_size>0?texture.icon_size:icon.icon.iconSize;
                item.clone=texture.gicon?new St.Icon({gicon:texture.gicon,icon_size:size,reactive:false}):icon.app.create_icon_texture(size);
                Main.layoutManager.addChrome(item.clone);Shell.util_set_hidden_from_pick(item.clone,true);
                item.texture=texture;item.opacity=texture.opacity;texture.opacity=0;
            }
            const [x,y]=item.texture.get_transformed_position(),[w,h]=item.texture.get_transformed_size();
            item.clone.set_size(w,h);item.clone.set_position(x,y+bounceOffset((now-p.start)/1000,h));
        }
        if(!this.pending.size){this.timeline?.stop();this.timeline=null;}
    }
    cancel() {
        for (const source of this.startupChecks.values()) GLib.source_remove(source);
        this.startupChecks.clear();
        this.pending.clear();this.timeline?.stop();this.timeline=null;
        for(const [icon,item] of this.icons)this.reset(icon,item);
        this.redisplay();
    }
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        if (global[Symbol.for("familiarmac.dockBounce")] === this) delete global[Symbol.for("familiarmac.dockBounce")];
        this.cancel();
        for(const [object,id] of this.signals)object.disconnect(id);
        for(const [icon,item] of this.icons){icon.disconnect(item.clicked);icon.disconnect(item.signal);if(icon.animateLaunch===item.wrapper)icon.animateLaunch=item.original;}
        for(const [dash,item] of this.dashes){item.actor.disconnect(item.signal);if(dash._redisplay===item.wrapper)dash._redisplay=item.original;}
        this.icons.clear();this.dashes.clear();
    }
}
