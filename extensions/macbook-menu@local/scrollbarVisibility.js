import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

export class ScrollbarVisibility {
    constructor(scroll) {
        this.scroll = scroll;
        this.bar = scroll.get_vscroll_bar();
        this.timer = 0;
        this.dragging = false;
        this.bar.opacity = 0;
        this.bar.track_hover = true;
        this.signals = [
            [scroll.vadjustment, scroll.vadjustment.connect('notify::value', () => this.show())],
            [this.bar, this.bar.connect('scroll-start', () => { this.dragging = true; this.show(); })],
            [this.bar, this.bar.connect('scroll-stop', () => { this.dragging = false; this.show(); })],
            [this.bar, this.bar.connect('notify::hover', () => this.show())],
        ];
    }
    cancel() { if (this.timer) GLib.source_remove(this.timer); this.timer = 0; }
    show() {
        this.cancel();
        if (!this.scroll.mapped) return;
        this.bar.remove_all_transitions();
        this.bar.opacity = 255;
        if (this.dragging || this.bar.hover) return;
        this.timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 900, () => {
            this.timer = 0;
            this.bar.ease({opacity: 0, duration: 160, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
            return GLib.SOURCE_REMOVE;
        });
    }
    reset() { this.cancel(); this.bar.remove_all_transitions(); this.bar.opacity = 0; }
    destroy() {
        this.cancel();
        for (const [object, id] of this.signals) object.disconnect(id);
        this.signals = [];
        this.bar.remove_all_transitions();
    }
}
