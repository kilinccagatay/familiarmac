import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';

// Reuse Shell's UPower proxy. No polling or invented per-app energy estimates.
export class BatterySurface {
    constructor(owner, tr) {
        this.owner = owner;
        this.tr = tr;
        this.proxy = owner.panel._system?._systemItem?.powerToggle?._proxy;
        this.actor = new St.BoxLayout({vertical: true, style_class: 'fm-battery', visible: false});
        const header = new St.BoxLayout({style_class: 'fm-battery-header'});
        header.add_child(new St.Label({text: tr ? 'Pil' : 'Battery', x_expand: true}));
        this.percent = new St.Label(); header.add_child(this.percent); this.actor.add_child(header);
        this.source = new St.Label({style_class: 'fm-battery-status'});
        this.state = new St.Label({style_class: 'fm-battery-status'});
        this.actor.add_child(this.source); this.actor.add_child(this.state);
        const settings = new St.Button({label: tr ? 'Pil Ayarları…' : 'Battery Settings…',
            can_focus: true, x_align: Clutter.ActorAlign.FILL, style_class: 'fm-battery-settings'});
        settings.connect('clicked', () => { owner.panel.menu.close(); Util.spawn(['gnome-control-center', 'power']); });
        this.actor.add_child(settings);
        if (this.proxy) this.signal = this.proxy.connect('g-properties-changed', () => this.sync());
        this.sync();
    }
    sync() {
        const p = this.proxy, tr = this.tr;
        const present = Boolean(p?.IsPresent);
        this.percent.text = present ? `${Math.round(p.Percentage)}%` : '—';
        const onBattery = [2, 3, 6].includes(p?.State);
        this.source.text = !present ? (tr ? 'Pil bulunamadı' : 'No battery detected') :
            onBattery ? (tr ? 'Güç Kaynağı: Pil' : 'Power Source: Battery') :
                (tr ? 'Güç Kaynağı: Güç Adaptörü' : 'Power Source: Power Adapter');
        const states = tr ? {1: 'Şarj oluyor', 2: 'Pil kullanılıyor', 3: 'Pil boş', 4: 'Tam dolu', 5: 'Şarj bekleniyor', 6: 'Pil kullanımı bekleniyor'} :
            {1: 'Charging', 2: 'On Battery', 3: 'Empty', 4: 'Fully Charged', 5: 'Charging on Hold', 6: 'Pending Discharge'};
        this.state.text = present ? states[p.State] ?? (tr ? 'Durum bilinmiyor' : 'Status Unknown') : '';
        // Some Shell proxy versions omit TimeToFull; don't fabricate an estimate.
        if (p?.State === 1 && p.TimeToFull > 0) {
            const minutes = Math.ceil(p.TimeToFull / 60);
            this.state.text += tr ? ` · Yaklaşık ${minutes} dk kaldı` : ` · About ${minutes} min until full`;
        }
    }
    destroy() {
        if (this.signal) this.proxy.disconnect(this.signal);
        this.actor.destroy();
    }
}
