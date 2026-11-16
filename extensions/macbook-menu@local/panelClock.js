import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export function formatPanelDate(date) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.get_day_of_week() - 1]} ${date.get_day_of_month()} ${months[date.get_month() - 1]} ${date.format('%H:%M:%S')}`;
}
export class PanelClock {
    constructor() {
        this.label = Main.panel.statusArea.dateMenu._clockDisplay;
        this.clock = Main.panel.statusArea.dateMenu._clock;
        // Reuse GNOME's wall-clock tick and timezone updates, not another timer.
        new Gio.Settings({schema_id: 'org.gnome.desktop.interface'}).set_boolean('clock-show-seconds', true);
        this.signal = this.label.connect('notify::text', () => this.update());
        this.update();
    }
    update() {
        const value = formatPanelDate(GLib.DateTime.new_now_local());
        if (this.label.text !== value) this.label.text = value;
    }
    destroy() {
        this.label.disconnect(this.signal);
        this.label.text = this.clock.clock;
    }
}
