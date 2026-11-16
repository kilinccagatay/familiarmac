import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Cairo from 'cairo';

export function batteryDisplay(proxy) {
    const raw = Number(proxy?.Percentage);
    const present = Boolean(proxy?.IsPresent);
    const known = present && Number.isFinite(raw);
    const percent = known ? Math.max(0, Math.min(100, Math.round(raw))) : 0;
    return {present, percent, text: known ? String(percent) : '—',
        charging: present && proxy.State === 1,
        low: known && percent <= 20 && [2, 3, 6].includes(proxy.State)};
}

// Vector drawing at the monitor's scale; no generated files or polling.
export class BatteryIcon {
    constructor(proxy, changed) {
        this.proxy = proxy;
        this.changed = changed;
        this.actor = new St.DrawingArea({style_class: 'fm-panel-battery',
            y_align: Clutter.ActorAlign.CENTER});
        this.actor.connect('repaint', () => this.paint());
        this.signal = proxy.connect('g-properties-changed', () => this.sync());
        this.sync();
    }
    sync() {
        this.state = batteryDisplay(this.proxy);
        this.actor.visible = this.state.present;
        this.actor.accessible_name = `${this.state.text}%`;
        this.actor.queue_repaint();
        this.changed?.(this.state.present);
    }
    paint() {
        const cr = this.actor.get_context();
        const [w, h] = this.actor.get_surface_size();
        cr.scale(w / 38, h / 18);
        const rounded = (x, y, width, height, radius) => {
            cr.newSubPath();
            cr.arc(x + width-radius, y+radius, radius, -Math.PI/2, 0);
            cr.arc(x + width-radius, y+height-radius, radius, 0, Math.PI/2);
            cr.arc(x+radius, y+height-radius, radius, Math.PI/2, Math.PI);
            cr.arc(x+radius, y+radius, radius, Math.PI, 1.5*Math.PI);
            cr.closePath();
        };
        const s = this.state;
        const color = s.charging ? [0.35, 0.9, 0.48] : s.low ? [1, 0.3, 0.3] : [1, 1, 1];
        rounded(1, 1, 32, 16, 4);
        cr.setSourceRGBA(1, 1, 1, 0.4); cr.setLineWidth(1); cr.stroke();
        if (s.charging) {
            cr.moveTo(37,3); cr.lineTo(33.5,9); cr.lineTo(35.5,9);
            cr.lineTo(34.5,15); cr.lineTo(38,8); cr.lineTo(36,8); cr.closePath();
            cr.setSourceRGB(...color); cr.fill();
        } else {
            rounded(35, 6, 2, 6, 1); cr.setSourceRGBA(1, 1, 1, 0.65); cr.fill();
        }
        rounded(2, 2, 30, 14, 3); cr.setSourceRGBA(1, 1, 1, 0.22); cr.fill();
        cr.save(); rounded(2, 2, 30, 14, 3); cr.clip();
        cr.rectangle(2, 2, 30*s.percent/100, 14); cr.setSourceRGB(...color); cr.fill(); cr.restore();
        cr.selectFontFace('sans-serif', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        cr.setFontSize(10);
        const ext = cr.textExtents(s.text);
        const x = 17-(ext.width/2+ext.xBearing), y = 9-(ext.height/2+ext.yBearing);
        cr.moveTo(x,y); cr.setSourceRGB(1,1,1); cr.showText(s.text);
        // Dark digits over the filled portion, white over the empty portion.
        cr.save(); cr.rectangle(2,2,30*s.percent/100,14); cr.clip();
        cr.moveTo(x,y); cr.setSourceRGB(0.12,0.15,0.17); cr.showText(s.text); cr.restore();
        cr.$dispose();
    }
    destroy() {
        this.proxy.disconnect(this.signal);
        this.actor.destroy();
    }
}
