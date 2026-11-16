import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export function dateNameFormatters(languages) {
    for (const language of languages) {
        const locale = /^(C|POSIX)(\.|$)/.test(language) ? 'en' : language.split(/[.@]/)[0].replace(/_/g, '-');
        try {
            if (!Intl.DateTimeFormat.supportedLocalesOf([locale]).length) continue;
            return {
                day: new Intl.DateTimeFormat(locale, {weekday: 'short', timeZone: 'UTC'}),
                month: new Intl.DateTimeFormat(locale, {month: 'short', timeZone: 'UTC'}),
            };
        } catch (_) { /* Try the next UI language fallback. */ }
    }
    return dateNameFormatters(['en']);
}
export function formatPanelDate(date, names) {
    // Names follow the message/UI language, never the regional LC_TIME setting.
    const day = new Date(Date.UTC(date.get_year(), date.get_month() - 1, date.get_day_of_month()));
    return `${names.day.format(day)} ${date.get_day_of_month()} ${names.month.format(day)} ${date.format('%H:%M:%S')}`;
}
export class PanelClock {
    constructor() {
        this.names = dateNameFormatters(GLib.get_language_names_with_category('LC_MESSAGES'));
        this.label = Main.panel.statusArea.dateMenu._clockDisplay;
        this.clock = Main.panel.statusArea.dateMenu._clock;
        // Keep seconds local to the panel: the global preference also controls
        // the lock-screen clock. Reuse the native ticker without another timer.
        new Gio.Settings({schema_id: 'org.gnome.desktop.interface'}).set_boolean('clock-show-seconds', false);
        this.previousForceSeconds = this.clock.force_seconds;
        this.clock.force_seconds = true;
        this.signal = this.label.connect('notify::text', () => this.update());
        this.update();
    }
    update() {
        const value = formatPanelDate(GLib.DateTime.new_now_local(), this.names);
        if (this.label.text !== value) this.label.text = value;
    }
    destroy() {
        this.label.disconnect(this.signal);
        this.clock.force_seconds = this.previousForceSeconds;
        this.label.text = this.clock.clock;
    }
}
