import {settingsCommand} from './settingsCommand.js';
import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';

// Present the real volume slider and output choices, not a second audio stack.
export class SoundSurface {
    constructor(owner, tr) {
        this.owner = owner;
        this.native = owner.panel._volumeOutput?._output;
        this.moves = [];
        this.actor = new St.BoxLayout({vertical: true, style_class: 'fm-sound', visible: false});
        this.actor.add_child(new St.Label({text: tr ? 'Ses' : 'Sound', style_class: 'fm-sound-title'}));
        this.row = new St.BoxLayout({style_class: 'fm-sound-volume'});
        this.icon = new St.Icon({icon_name: 'audio-volume-high-symbolic', style_class: 'fm-sound-icon'});
        const mute = new St.Button({child: this.icon, can_focus: true,
            accessible_name: tr ? 'Sesi kapat/aç' : 'Mute or unmute', style_class: 'fm-sound-mute'});
        mute.connect('clicked', () => this.native?.emit('icon-clicked'));
        this.row.add_child(mute); this.actor.add_child(this.row);
        this.actor.add_child(new St.BoxLayout({style_class: 'fm-battery-separator'}));
        this.actor.add_child(new St.Label({text: tr ? 'Çıkış' : 'Output', style_class: 'fm-sound-output-heading'}));
        this.devices = new St.BoxLayout({vertical: true});
        this.actor.add_child(new St.ScrollView({child: this.devices, overlay_scrollbars: true,
            hscrollbar_policy: St.PolicyType.NEVER, vscrollbar_policy: St.PolicyType.AUTOMATIC,
            style_class: 'fm-sound-devices'}));
        this.actor.add_child(new St.BoxLayout({style_class: 'fm-battery-separator'}));
        const settings = new PopupMenu.PopupMenuItem(tr ? 'Ses Ayarları…' : 'Sound Settings…');
        settings.connect('activate', () => {
            owner.panel.menu.close(); Util.spawn([settingsCommand(), 'sound']);
        });
        this.actor.add_child(settings);
        this.signal = this.native?.connect('stream-updated', () => this.sync());
        this.sync();
    }
    sync() { this.icon.icon_name = this.native?.getIcon() || 'audio-volume-muted-symbolic'; }
    move(actor, target) {
        const parent = actor.get_parent();
        this.moves.push({actor, parent, index: parent.get_children().indexOf(actor)});
        parent.remove_child(actor); target.add_child(actor);
    }
    show() {
        if (this.moves.length || !this.native?._deviceSection?.actor) return;
        this.move(this.native.slider, this.row);
        this.move(this.native._deviceSection.actor, this.devices);
        this.sync();
    }
    hide() {
        for (const {actor, parent, index} of this.moves.splice(0).reverse()) {
            actor.get_parent().remove_child(actor); parent.insert_child_at_index(actor, index);
        }
    }
    destroy() {
        this.hide();
        if (this.signal) this.native.disconnect(this.signal);
        this.signal = 0;
        this.actor.destroy();
    }
}
