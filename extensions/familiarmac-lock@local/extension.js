import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {UnlockDialog} from 'resource:///org/gnome/shell/ui/unlockDialog.js';
import {positions} from './geometry.js';

const LoginLayout = GObject.registerClass(class FamiliarMacUnlockLayout extends Clutter.LayoutManager {
    _init(original, dialog, clock) { super._init(); this.original = original; this.dialog = dialog; this.clock = clock; }
    vfunc_get_preferred_width(actor, h) { return this.original.vfunc_get_preferred_width(actor, h); }
    vfunc_get_preferred_height(actor, w) { return this.original.vfunc_get_preferred_height(actor, w); }
    vfunc_allocate(actor, box) {
        this.original.vfunc_allocate(actor, box);
        const d = this.dialog;
        const [w, h] = box.get_size();
        const [, , sw, sh] = d._stack.get_preferred_size();
        const [, , cw, ch] = this.clock.get_preferred_size();
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const keyboard = Main.keyboard.visible ? Main.layoutManager.keyboardBox.height : 0;
        const p = positions(w, h, sw, sh, cw, ch, keyboard, scale);
        const allocate = (a, x, y, width, height) => {
            const b = new Clutter.ActorBox(); b.x1=x; b.y1=y; b.x2=x+width; b.y2=y+height; a.allocate(b);
        };
        allocate(d._stack, p.promptX, p.promptY, sw, sh);
        this.clock.visible = p.clockVisible;
        allocate(this.clock, p.clockX, p.clockY, cw, ch);
        const [, , nw, nh] = d._notificationsBox.get_preferred_size();
        allocate(d._notificationsBox, Math.max(0,(w-nw)/2), p.notificationY, nw, Math.min(nh,p.notificationHeight));
    }
});

export default class FamiliarMacLock extends Extension {
    enable() {
        this._records = new Map();
        this._injections = new InjectionManager();
        const extension = this;
        this._injections.overrideMethod(UnlockDialog.prototype, 'open', original => function (...args) {
            // Preserve native authentication, grabs, transitions and return value.
            const result = original.apply(this, args);
            if (result) extension._safeAttach(this);
            return result;
        });
        this._modeSignal = Main.sessionMode.connect('updated', () => this._syncPanel());
        // Panel rebuilds can show the clock after the session-mode callback.
        this._panelActor = Main.panel.statusArea.dateMenu?.container;
        this._panelVisibleSignal = this._panelActor?.connect('notify::visible', () => {
            if (Main.sessionMode.currentMode === 'unlock-dialog') this._syncPanel();
        });
        this._syncPanel();
        const dialog = Main.screenShield?._dialog;
        if (dialog instanceof UnlockDialog) this._safeAttach(dialog);
    }
    _syncPanel() {
        const actor = Main.panel.statusArea.dateMenu?.container;
        if (!actor) return;
        if (Main.sessionMode.currentMode === 'unlock-dialog') {
            if (!this._panelClock) this._panelClock = {actor, visible: actor.visible};
            actor.hide();
        } else if (this._panelClock) {
            this._panelClock.actor.visible = this._panelClock.visible;
            this._panelClock = null;
        }
    }
    _safeAttach(dialog) {
        try { this._attach(dialog); } catch (error) {
            this._detach(dialog);
            console.error('FamiliarMac lock appearance: retaining native unlock screen', error);
        }
    }
    _attach(dialog) {
        if (this._records.has(dialog)) return;
        const parent = dialog._stack?.get_parent();
        if (!parent || !dialog._clock?._wallClock || !dialog._notificationsBox || !parent.layout_manager) return;
        const clock = new St.BoxLayout({vertical:true, style_class:'fm-lock-clock', reactive:false});
        const date = new St.Label({x_align:Clutter.ActorAlign.CENTER});
        const time = new St.Label({x_align:Clutter.ActorAlign.CENTER, style_class:'fm-lock-time'});
        clock.add_child(date); clock.add_child(time);
        let locale = 'en';
        for (const lang of GLib.get_language_names_with_category('LC_MESSAGES')) {
            const candidate = /^(C|POSIX)(\.|$)/.test(lang) ? 'en' : lang.split(/[.@]/)[0].replace(/_/g,'-');
            try { if (Intl.DateTimeFormat.supportedLocalesOf([candidate]).length) { locale=candidate; break; } } catch (_) {}
        }
        const day = new Intl.DateTimeFormat(locale,{weekday:'short',timeZone:'UTC'});
        const month = new Intl.DateTimeFormat(locale,{month:'short',timeZone:'UTC'});
        const update = () => {
            const now = GLib.DateTime.new_now_local();
            const value = new Date(Date.UTC(now.get_year(),now.get_month()-1,now.get_day_of_month()));
            date.text = `${day.format(value)} ${now.get_day_of_month()} ${month.format(value)}`;
            time.text = now.format('%H:%M');
        };
        const record = {parent, original:parent.layout_manager, clock, opacity:dialog._clock.opacity,
            clockLabels: [dialog._clock._time, dialog._clock._date].filter(Boolean).map(actor => ({actor, opacity:actor.opacity}))};
        this._records.set(dialog, record);
        parent.add_child(clock);
        parent.layout_manager = new LoginLayout(record.original, dialog, clock);
        dialog.add_style_class_name('fm-lock');
        // Keep the native clock/transition actor in place, but draw only our clock.
        record.opacitySignal = dialog._clock.connect('notify::opacity', () => {
            if (dialog._clock.opacity !== 0) dialog._clock.opacity = 0;
        });
        dialog._clock.opacity = 0;
        // Native transition animations modify the parent opacity, never these labels.
        for (const {actor} of record.clockLabels) actor.opacity = 0;
        record.tickSignal = dialog._clock._wallClock.connect('notify::clock', update);
        record.keyboardSignal = Main.layoutManager.keyboardBox.connect('notify::height', () => parent.queue_relayout());
        record.destroySignal = dialog.connect('destroy', () => this._detach(dialog, true));
        update();
    }
    _detach(dialog, destroying=false) {
        const r = this._records.get(dialog); if (!r) return;
        this._records.delete(dialog);
        if (r.keyboardSignal) Main.layoutManager.keyboardBox.disconnect(r.keyboardSignal);
        if (r.tickSignal) dialog._clock._wallClock.disconnect(r.tickSignal);
        if (r.opacitySignal) dialog._clock.disconnect(r.opacitySignal);
        if (!destroying) {
            if (r.destroySignal) dialog.disconnect(r.destroySignal);
            r.parent.layout_manager = r.original;
            dialog._clock.opacity = r.opacity;
            for (const {actor, opacity} of r.clockLabels) actor.opacity = opacity;
            dialog.remove_style_class_name('fm-lock');
            r.clock.destroy();
        }
    }
    disable() {
        this._injections?.clear();
        if (this._panelVisibleSignal) this._panelActor.disconnect(this._panelVisibleSignal);
        this._panelVisibleSignal = 0;
        this._panelActor = null;
        if (this._modeSignal) Main.sessionMode.disconnect(this._modeSignal);
        this._modeSignal = 0;
        for (const dialog of [...this._records.keys()]) this._detach(dialog);
        if (this._panelClock) this._panelClock.actor.visible = this._panelClock.visible;
        this._panelClock = null;
    }
}
