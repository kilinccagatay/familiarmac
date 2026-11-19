import GLib from 'gi://GLib';
import St from 'gi://St';
import Gettext from 'gettext';
import Clutter from 'gi://Clutter';
import {dateNameFormatters} from './panelClock.js';

export class CalendarLanguage {
    constructor(dateMenu) {
        this.date = dateMenu._date;
        this.calendar = dateMenu._calendar;
        this.dateAlignments = [this.date._dayLabel, this.date._dateLabel].map(label => [label, label.x_align]);
        for (const [label] of this.dateAlignments) label.x_align = Clutter.ActorAlign.CENTER;
        const names = dateNameFormatters(GLib.get_language_names_with_category('LC_MESSAGES'));
        const locale = names.day.resolvedOptions().locale;
        this.day = new Intl.DateTimeFormat(locale, {weekday: 'long'});
        this.weekday = new Intl.DateTimeFormat(locale, {weekday: 'narrow'});
        this.full = new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'long', year: 'numeric'});
        this.month = new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric'});
        this.setDate = this.date.setDate;
        this.update = this.calendar._update;
        this.header = this.calendar._buildHeader;
        this.date.setDate = date => {
            this.setDate.call(this.date, date);
            this.date._dayLabel.text = this.day.format(date);
            this.date._dateLabel.text = this.full.format(date);
        };
        this.calendar._update = (...args) => { this.update.apply(this.calendar, args); this.localize(); };
        this.calendar._buildHeader = (...args) => { this.header.apply(this.calendar, args); this.localize(); };
        this.date.setDate(new Date());
        this.localize();
    }
    localize() {
        const c = this.calendar;
        // The native header is rebuilt on locale/settings changes.
        if (c._topBox && this.todayHeader !== c._topBox) {
            this.todayHeader = c._topBox;
            this.todayButton = new St.Button({
                label: Gettext.dgettext('gnome-shell', 'Today'),
                style_class: 'fm-calendar-today-button',
                can_focus: true, y_align: Clutter.ActorAlign.CENTER,
            });
            this.todayButton.connect('clicked', () => c.setDate(new Date()));
            // A separate control row keeps the month truly centered even with
            // long month names, without competing with the right-hand buttons.
            for (const actor of [c._backButton, c._monthLabel, c._forwardButton])
                c._topBox.remove_child(actor);
            c._topBox.vertical = true;
            c._topBox.add_child(c._monthLabel);
            const controls = new St.BoxLayout({style_class: 'fm-calendar-navigation',
                x_align: Clutter.ActorAlign.END, y_align: Clutter.ActorAlign.CENTER});
            controls.add_child(c._backButton);
            controls.add_child(this.todayButton);
            controls.add_child(c._forwardButton);
            c._topBox.add_child(controls);
        }
        if (c._monthLabel) c._monthLabel.text = this.month.format(c._selectedDate);
        const rtl = c.get_text_direction() === Clutter.TextDirection.RTL;
        for (let index = 0; index < 7; index++) {
            const col = index + (rtl ? 0 : Number(c._useWeekdate));
            const label = c.layout_manager.get_child_at(col, 1);
            if (!label) continue;
            const offset = rtl ? 6 - col : index;
            const day = (c._weekStart + offset) % 7;
            const sample = new Date(2024, 0, 7 + day, 12);
            label.text = this.weekday.format(sample);
            label.accessible_name = this.day.format(sample);
        }
    }
    destroy() {
        for (const [label, align] of this.dateAlignments) label.x_align = align;
        this.todayButton?.destroy();
        this.todayButton = null;
        this.todayHeader = null;
        this.date.setDate = this.setDate;
        this.calendar._update = this.update;
        this.calendar._buildHeader = this.header;
        this.date.setDate(new Date());
        this.calendar._buildHeader();
        this.calendar._rebuildCalendar();
        this.calendar._update();
    }
}
