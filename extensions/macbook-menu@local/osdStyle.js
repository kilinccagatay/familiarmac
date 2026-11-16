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
    }
    style(window) {
        if (this.saved.has(window)) return;
        const box = window._hbox;
        const row = new St.BoxLayout({style_class: 'fm-osd-segments'});
        const ticks = Array.from({length: 16}, () => new St.Widget({style_class: 'fm-osd-tick', x_expand: true}));
        ticks.forEach(tick => row.add_child(tick));
        const saved = {vertical: box.vertical, style: window._level.get_style(), opacity: window._level.opacity, row};
        this.saved.set(window, saved);
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
    restore(window) {
        const saved = this.saved.get(window); if (!saved) return;
        window.disconnect(saved.destroy);
        window._level.disconnect(saved.value); window._level.disconnect(saved.visible);
        window._level.set_style(saved.style);
        window._level.opacity = saved.opacity;
        window._hbox.vertical = saved.vertical;
        window._hbox.remove_style_class_name('fm-hardware-osd'); saved.row.destroy();
        this.saved.delete(window);
    }
    destroy() {
        if (this.manager._showOsdWindow === this.wrapper) this.manager._showOsdWindow = this.original;
        for (const window of [...this.saved.keys()]) this.restore(window);
    }
}
