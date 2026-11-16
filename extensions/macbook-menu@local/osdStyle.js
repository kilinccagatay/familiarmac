import Gio from 'gi://Gio';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Keep native brightness/volume handling, animation and timeout; style only OSDs.
export class OsdStyle {
    constructor() {
        this.manager = Main.osdWindowManager;
        this.saved = new Map();
        this.original = this.manager._showOsdWindow;
        this.wrapper = (index, icon, ...args) => {
            const window = this.manager._osdWindows[index];
            const hardware = /audio-volume|display-brightness|keyboard-brightness/.test(icon?.to_string?.() ?? '');
            if (hardware) this.style(window); else this.restore(window);
            this.original.call(this.manager, index, icon, ...args);
        };
        this.manager._showOsdWindow = this.wrapper;
        // Narrow session endpoint for the zero-capable brightness helper.
        this.bus = Gio.DBusExportedObject.wrapJSObject(
            '<node><interface name="org.familiarmac.HardwareOSD"><method name="ShowBrightness"><arg type="d" direction="in"/></method></interface></node>', this);
        this.bus.export(Gio.DBus.session, '/org/familiarmac/HardwareOSD');
    }
    ShowBrightness(level) {
        if (!Number.isFinite(level) || Main.sessionMode.isLocked || Main.sessionMode.isGreeter) return;
        this.manager.show(-1, Gio.ThemedIcon.new('display-brightness-symbolic'), null,
            Math.max(0, Math.min(1, level)), 1);
    }
    style(window) {
        if (this.saved.has(window)) { this.position(window); return; }
        const box = window._hbox;
        const row = new St.BoxLayout({style_class: 'fm-osd-segments'});
        const ticks = Array.from({length: 16}, () => new St.Widget({style_class: 'fm-osd-tick', x_expand: true}));
        ticks.forEach(tick => row.add_child(tick));
        const saved = {boxStyle: box.get_style(), vertical: box.vertical, style: window._level.get_style(), opacity: window._level.opacity, row};
        this.saved.set(window, saved);
        this.position(window);
        box.vertical = true;
        box.add_style_class_name('fm-hardware-osd');
        window._level.set_style('height: 0; min-height: 0; width: 0; min-width: 0; margin: 0; padding: 0;');
        window._level.opacity = 0;
        window._vbox.add_child(row);
        const sync = () => {
            row.visible = window._level.visible;
            const count = Math.round(Math.min(1, Math.max(0, window._level.value)) * 16);
            ticks.forEach((tick, index) => index < count ? tick.add_style_class_name('filled') : tick.remove_style_class_name('filled'));
        };
        saved.value = window._level.connect('notify::value', sync);
        saved.visible = window._level.connect('notify::visible', sync);
        saved.destroy = window.connect('destroy', () => this.saved.delete(window));
        sync();
    }
    position(window) {
        const monitor = Main.layoutManager.monitors[window._monitorIndex];
        if (!monitor) return;
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const bottom = Math.round(monitor.height * 0.16 / Math.max(1, scale));
        const original = this.saved.get(window).boxStyle ?? '';
        window._hbox.set_style(`${original}; margin-bottom: ${bottom}px;`);
    }
    restore(window) {
        const saved = this.saved.get(window); if (!saved) return;
        window.disconnect(saved.destroy);
        window._level.disconnect(saved.value); window._level.disconnect(saved.visible);
        window._level.set_style(saved.style);
        window._level.opacity = saved.opacity;
        window._hbox.set_style(saved.boxStyle);
        window._hbox.vertical = saved.vertical;
        window._hbox.remove_style_class_name('fm-hardware-osd'); saved.row.destroy();
        this.saved.delete(window);
    }
    destroy() {
        this.bus.unexport();
        if (this.manager._showOsdWindow === this.wrapper) this.manager._showOsdWindow = this.original;
        for (const window of [...this.saved.keys()]) this.restore(window);
    }
}
