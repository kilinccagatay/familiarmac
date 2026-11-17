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
        cr.scale(w / 36, h / 16);
        const rounded = (x, y, width, height, radius) => {
            cr.newSubPath();
            cr.arc(x + width-radius, y+radius, radius, -Math.PI/2, 0);
            cr.arc(x + width-radius, y+height-radius, radius, 0, Math.PI/2);
            cr.arc(x+radius, y+height-radius, radius, Math.PI/2, Math.PI);
            cr.arc(x+radius, y+radius, radius, Math.PI, 1.5*Math.PI);
            cr.closePath();
        };
        const s = this.state;
        const color = s.charging ? [0.20, 0.84, 0.38] : s.low ? [1, 0.27, 0.23] : [1, 1, 1];
        // A thin case and a permanent terminal; the charging mark belongs inside.
        rounded(0.75, 1, 31.5, 14, 3.4);
        cr.setSourceRGBA(1, 1, 1, 0.60); cr.setLineWidth(1); cr.stroke();
        rounded(33.5, 5.5, 2, 5, 0.9);
        cr.setSourceRGBA(1, 1, 1, 0.60); cr.fill();
        rounded(2, 2.25, 29, 11.5, 2.2);
        cr.setSourceRGBA(1, 1, 1, 0.20); cr.fill();
        cr.save(); rounded(2, 2.25, 29, 11.5, 2.2); cr.clip();
        cr.rectangle(2, 2.25, 29*s.percent/100, 11.5);
        cr.setSourceRGB(...color); cr.fill(); cr.restore();
        cr.selectFontFace('sans-serif', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        cr.setFontSize(9);
        const ext = cr.textExtents(s.text);
        const center = s.charging ? 20 : 16.5;
        const x = center-(ext.width/2+ext.xBearing), y = 8-(ext.height/2+ext.yBearing);
        const content = () => {
            cr.moveTo(x,y); cr.showText(s.text);
            if (s.charging) {
                cr.moveTo(9.5,3); cr.lineTo(5.5,8.4); cr.lineTo(8.1,8.4);
                cr.lineTo(6.9,13); cr.lineTo(11.3,6.8); cr.lineTo(8.8,6.8);
                cr.closePath(); cr.fill();
            }
        };
        cr.setSourceRGB(1,1,1); content();
        // Coloured states keep white digits/bolt. Only the neutral white fill
        // uses a transparent cutout, revealing the real menu bar underneath.
        if (!s.charging && !s.low) {
            cr.save(); cr.rectangle(2,2.25,29*s.percent/100,11.5); cr.clip();
            cr.setOperator(Cairo.Operator.CLEAR); content(); cr.restore();
        }
        cr.$dispose();
    }
    destroy() {
        this.proxy.disconnect(this.signal);
        this.actor.destroy();
    }
}
