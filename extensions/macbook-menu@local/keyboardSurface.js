import St from 'gi://St';

// Reuse GNOME's actual backlight control and its hardware bindings. The native
// submenu lives outside the styled menu box, so CSS alone cannot restyle it.
export class KeyboardSurface {
    constructor(owner, tr) {
        this.native = owner.panel._backlight?.quickSettingsItems?.find(i => i._sliderItem?._slider);
        this.actor = new St.BoxLayout({vertical: true, style_class: 'fm-sound fm-keyboard', visible: false});
        this.actor.add_child(new St.Label({text: tr ? 'Klavye Parlaklığı' : 'Keyboard Brightness',
            style_class: 'fm-sound-title'}));
        this.row = new St.BoxLayout({style_class: 'fm-sound-volume'});
        this.icon = new St.Icon({icon_name: 'keyboard-brightness-symbolic', style_class: 'fm-sound-icon'});
        this.row.add_child(this.icon);
        this.actor.add_child(this.row);
        this.open = false;
        this.moved = null;
        this.signal = this.native?._sliderItem.connect('notify::visible', () => {
            if (this.open) { this.restore(); this.present(); }
        });
    }
    present() {
        const continuous = this.native._sliderItem.visible;
        const actor = continuous ? this.native._sliderItem._slider : this.native._discreteItem;
        if (!actor || this.moved) return;
        const parent = actor.get_parent();
        if (!parent) return;
        this.moved = {actor, parent, index: parent.get_children().indexOf(actor)};
        parent.remove_child(actor);
        this.row.add_child(actor);
        this.icon.visible = continuous;
    }
    show() {
        if (!this.native) return;
        this.open = true;
        this.present();
    }
    restore() {
        if (!this.moved) return;
        const {actor, parent, index} = this.moved;
        actor.get_parent()?.remove_child(actor);
        parent.insert_child_at_index(actor, index);
        this.moved = null;
    }
    hide() { this.open = false; this.restore(); }
    destroy() {
        this.hide();
        if (this.signal) this.native._sliderItem.disconnect(this.signal);
        this.signal = 0;
        this.actor.destroy();
    }
}
