import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Keep PopupMenu's existing grab, keyboard focus and outside-click handling.
// Only this date popup changes geometry and animation; no stage overlay.
export class NotificationDrawer {
    constructor(menu, area, calendar) {
        this.menu = menu;
        this.pointer = menu._boxPointer;
        this.area = area;
        this.calendar = calendar;
        // GNOME freezes the two-column popup's total height on non-today dates.
        // Our vertical agenda must grow below the calendar instead of squeezing
        // notifications into that old allocation.
        this.dateLayout = area.get_parent()?.layout_manager;
        if (typeof this.dateLayout?._frozen === 'boolean') {
            this.savedFrozen = this.dateLayout._frozen;
            this.dateSignal = calendar.connect_after('selected-date-changed', () => {
                this.dateLayout.frozen = false;
            });
            this.dateLayout.frozen = false;
        }
        this.saved = {open: this.pointer.open, close: this.pointer.close,
            reposition: this.pointer._reposition, style: menu.box.get_style(),
            areaStyle: area.get_style(), calendarStyle: calendar.get_style(), calendarHeight: calendar.height_set ? calendar.height : -1, expand: calendar.y_expand, align: calendar.y_align,
            homogeneous: calendar.layout_manager.column_homogeneous};
        calendar.y_expand = false;
        calendar.y_align = Clutter.ActorAlign.START;
        calendar.layout_manager.column_homogeneous = true;
        this.pointer.add_style_class_name('fm-notification-drawer');
        this.pointer._reposition = box => {
            // Native bookkeeping is required by BoxPointer's allocation code.
            this.saved.reposition.call(this.pointer, box);
            const monitor = Main.layoutManager.findMonitorForActor(menu.sourceActor);
            if (!monitor) return;
            const [, py] = Main.panel.get_transformed_position();
            const y = Math.max(monitor.y, py + Main.panel.height);
            const x = monitor.x + monitor.width - box.get_width();
            const [ok, px, ly] = this.pointer.get_parent().transform_stage_point(x, y);
            if (ok) box.set_origin(Math.floor(px), Math.floor(ly));
        };
        this.pointer.open = (animate, done) => {
            this.resize();
            this.pointer.remove_all_transitions();
            this.saved.open.call(this.pointer, 0);
            this.pointer.translation_y = 0;
            this.pointer.translation_x = this.width;
            this.pointer.ease({translation_x: 0, duration: animate === 0 ? 0 : 200,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD, onComplete: () => done?.()});
        };
        this.pointer.close = (animate, done) => {
            this.pointer.remove_all_transitions();
            // Native close releases its input state immediately. Animate only
            // while visible, then delegate its final visibility cleanup.
            this.pointer._muteInput = true;
            this.pointer._muteKeys = true;
            this.pointer.ease({translation_x: this.width || 0, duration: animate === 0 ? 0 : 160,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => this.saved.close.call(this.pointer, 0, done)});
        };
        this.monitorSignal = Main.layoutManager.connect('monitors-changed', () => {
            if (menu.isOpen) this.resize();
        });
    }
    resize() {
        const m = Main.layoutManager.findMonitorForActor(this.menu.sourceActor);
        if (!m) return;
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const [, py] = Main.panel.get_transformed_position();
        const height = Math.max(1, (m.y + m.height - Math.max(m.y, py + Main.panel.height)) / scale);
        const width = Math.min(340, m.width / scale);
        // Reserve the calendar's natural height before allocating the agenda.
        // Otherwise BoxLayout can shrink the day grid when event rows grow.
        this.calendar.set_height(this.saved.calendarHeight);
        this.calendar.set_style(this.saved.calendarStyle);
        const calendarWidth = Math.max(1, (width - 24) * scale);
        const [, naturalHeight] = this.calendar.get_preferred_height(calendarWidth);
        this.calendar.set_height(naturalHeight);
        const calendarStyle = this.saved.calendarStyle || '';
        this.calendar.set_style(`${calendarStyle}; min-height: ${Math.ceil(naturalHeight / scale)}px;`);
        this.width = width * scale;
        this.menu.box.set_style(`width: ${width}px; max-height: ${height}px;`);
        this.area.set_style(`max-height: ${Math.max(1, height - 24)}px;`);
    }
    destroy() {
        if (this.dateSignal) {
            this.calendar.disconnect(this.dateSignal);
            this.dateLayout.frozen = this.savedFrozen;
        }
        this.pointer.remove_all_transitions();
        this.saved.close.call(this.pointer, 0);
        this.pointer.open = this.saved.open;
        this.pointer.close = this.saved.close;
        this.pointer._reposition = this.saved.reposition;
        this.pointer.remove_style_class_name('fm-notification-drawer');
        this.menu.box.set_style(this.saved.style);
        this.area.set_style(this.saved.areaStyle);
        this.calendar.set_style(this.saved.calendarStyle);
        this.calendar.set_height(this.saved.calendarHeight);
        this.calendar.y_expand = this.saved.expand;
        this.calendar.y_align = this.saved.align;
        this.calendar.layout_manager.column_homogeneous = this.saved.homogeneous;
        Main.layoutManager.disconnect(this.monitorSignal);
    }
}
