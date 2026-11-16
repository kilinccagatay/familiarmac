import {settingsCommand} from './settingsCommand.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import {Slider} from 'resource:///org/gnome/shell/ui/slider.js';

// Presentation adapters only: original hardware controls own the actual state.
export class ControlSurface {
    constructor(owner, tr) {
        this.owner = owner;
        this.signals = [];
        this.actor = new St.BoxLayout({vertical: true, style_class: 'fm-controls'});
        const top = new St.BoxLayout({style_class: 'fm-controls-top'});
        const left = new St.BoxLayout({vertical: true, x_expand: true, style_class: 'fm-card fm-connections'});
        const right = new St.BoxLayout({vertical: true, x_expand: true, style_class: 'fm-control-right'});
        top.add_child(left); top.add_child(right); this.actor.add_child(top);
        const p = owner.panel;
        this.row(left, p._network?._wirelessToggle, 'Wi-Fi', () => this.detail('_network'));
        this.row(left, p._bluetooth?.quickSettingsItems?.[0], 'Bluetooth', () => this.detail('_bluetooth'));
        this.row(left, p._network?._wiredToggle, 'Ethernet', () => this.settings('network'));
        this.row(right, owner.focus, tr ? 'Rahatsız Etmeyin' : 'Do Not Disturb', () => { owner.focus.checked = !owner.focus.checked; owner.focus.emit('clicked', 1); }, 'fm-card fm-focus');
        const small = new St.BoxLayout({style_class: 'fm-control-small'}); right.add_child(small);
        this.row(small, p._backlight?.quickSettingsItems?.[0], tr ? 'Klavye Işığı' : 'Keyboard Brightness', () => this.detail('_backlight'), 'fm-card fm-small-tile');
        const displays = this.button(tr ? 'Ekranlar' : 'Displays', 'video-display-symbolic', () => this.settings('display'));
        displays.get_child().vertical = true;
        displays.add_style_class_name('fm-card'); displays.add_style_class_name('fm-small-tile'); small.add_child(displays);
        this.slider(p._brightness?.quickSettingsItems?.find(i => i.slider), tr ? 'Ekran' : 'Display', 'display-brightness-symbolic', 'display');
        this.slider(p._volumeOutput?.quickSettingsItems?.find(i => i.slider), tr ? 'Ses' : 'Sound', 'audio-volume-high-symbolic', 'sound');
        this.media = new St.BoxLayout({style_class: 'fm-card fm-media'});
        this.media.add_child(new St.Icon({icon_name: 'audio-x-generic-symbolic', style_class: 'fm-media-icon'}));
        this.mediaTitle = new St.Label({text: tr ? 'Çalınmıyor' : 'Not Playing', x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        this.media.add_child(this.mediaTitle);
        this.play = this.button('', 'media-playback-start-symbolic', () => this.player?.playPause());
        this.next = this.button('', 'media-skip-forward-symbolic', () => this.player?.next());
        this.media.add_child(this.play); this.media.add_child(this.next); this.actor.add_child(this.media);
        this.emptyMedia = this.mediaTitle.text;
    }
    watch(object, signal, callback) { this.signals.push([object, object.connect(signal, callback)]); }
    button(title, iconName, callback) {
        const button = new St.Button({can_focus: true, x_expand: Boolean(title), style_class: 'fm-control-row', accessible_name: title});
        const box = new St.BoxLayout({x_expand: true, x_align: Clutter.ActorAlign.FILL, style_class: 'fm-control-row-content'});
        const icon = new St.Icon({icon_name: iconName, x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER, style_class: 'fm-control-symbol'});
        box.add_child(icon);
        const label = title ? new St.Label({text: title, x_expand: true, y_align: Clutter.ActorAlign.CENTER}) : null;
        if (title) box.add_child(label);
        button.set_child(box); button.connect('clicked', callback);
        button.fmIcon = icon; button.fmLabel = label;
        return button;
    }
    row(parent, native, title, action, style = '') {
        if (!native) return;
        const button = this.button(title, native.icon_name || 'preferences-system-symbolic', action);
        if (style) button.set_style_class_name(`fm-control-row ${style}`);
        if (style.includes('fm-small-tile')) {
            button.get_child().vertical = true;
            button.fmLabel.clutter_text.line_wrap = true;
        }
        const sync = () => {
            button.visible = native.visible;
            button.fmIcon.icon_name = native.icon_name || 'preferences-system-symbolic';
            button.fmLabel.text = native.subtitle ? `${title}\n${native.subtitle}` : title;
            if (native.checked) button.fmIcon.add_style_class_name('enabled');
            else button.fmIcon.remove_style_class_name('enabled');
        };
        this.watch(native, 'notify', sync); sync(); parent.add_child(button);
    }
    slider(native, title, iconName, settings) {
        if (!native) return;
        const card = new St.BoxLayout({vertical: true, style_class: 'fm-card fm-slider-card'});
        card.add_child(new St.Label({text: title, style_class: 'fm-card-heading'}));
        const row = new St.BoxLayout({style_class: 'fm-slider-row'});
        row.add_child(new St.Icon({icon_name: iconName, style_class: 'fm-slider-symbol'}));
        const slider = new Slider(native.slider.value); slider.x_expand = true; slider.accessible_name = title;
        let syncing = false;
        this.watch(native.slider, 'notify::value', () => { syncing = true; slider.value = native.slider.value; syncing = false; });
        slider.connect('notify::value', () => { if (!syncing) native.slider.value = slider.value; });
        slider.connect('drag-begin', () => native.slider.emit('drag-begin'));
        slider.connect('drag-end', () => native.slider.emit('drag-end'));
        row.add_child(slider);
        row.add_child(this.button('', settings === 'sound' ? 'audio-speakers-symbolic' : 'video-display-symbolic', () => this.settings(settings)));
        card.add_child(row); this.actor.add_child(card);
        const sync = () => {card.visible = native.visible;}; this.watch(native, 'notify::visible', sync); sync();
    }
    detail(key) {
        const button = this.owner.statusButtons.buttons.find(b => b.indicator === this.owner.panel[key])?.button ?? this.owner.panel;
        this.owner.statusButtons.open(key, button);
        if (key !== '_network' && !(key === '_backlight' && this.owner.keyboard?.native)) this.owner.panel[key]?.quickSettingsItems?.find(i => i.visible && i.menu)?.menu.open();
    }
    settings(panel) { this.owner.panel.menu.close(); Util.spawn([settingsCommand(), panel]); }
    syncMedia() {
        if (this.playerSignal) this.player.disconnect(this.playerSignal);
        if (this.playerClosedSignal) this.player.disconnect(this.playerClosedSignal);
        this.playerSignal = 0; this.playerClosedSignal = 0;
        const players = Main.panel.statusArea.dateMenu?._messageList?._mediaSection?._players;
        this.player = [...(players?.values() ?? [])].find(p => p.status === 'Playing') ?? [...(players?.values() ?? [])][0];
        const sync = () => {
            this.mediaTitle.text = this.player?.trackTitle || this.emptyMedia;
            this.play.reactive = Boolean(this.player);
            this.next.reactive = Boolean(this.player?.canGoNext);
            this.play.fmIcon.icon_name = this.player?.status === 'Playing' ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
        };
        if (this.player) {
            this.playerSignal = this.player.connect('changed', sync);
            this.playerClosedSignal = this.player.connect('closed', () => {
                this.player.disconnect(this.playerSignal);
                this.player.disconnect(this.playerClosedSignal);
                this.playerSignal = 0; this.playerClosedSignal = 0; this.player = null;
                sync();
            });
        }
        sync();
    }
    destroy() {
        if (this.playerSignal) this.player.disconnect(this.playerSignal);
        if (this.playerClosedSignal) this.player.disconnect(this.playerClosedSignal);
        for (const [object, id] of this.signals) object.disconnect(id);
        this.signals = []; this.actor.destroy();
    }
}
