import {CalendarLanguage} from './calendarLanguage.js';
import {NotificationDrawer} from './notificationDrawer.js';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gettext from 'gettext';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const _ = text => Gettext.dgettext('gnome-shell', text);

// Keep GNOME's real notification sources, actions, dismissal and keyboard
// handling. Only rearrange actors; never introduce a full-screen input layer.
export class NotificationCenter {
    constructor() {
        this.date = Main.panel.statusArea.dateMenu;
        this.moves = [];
        this.hidden = [];
        this.signals = [];
        const list = this.date?._messageList;
        if (!list || !this.date._calendar || !this.date._date) return;
        this.placeholder = list._placeholder;
        if (this.placeholder) {
            this.placeholderLayout = {expand: this.placeholder.x_expand, align: this.placeholder.x_align};
            this.placeholder.x_expand = true;
            this.placeholder.x_align = Clutter.ActorAlign.FILL;
        }
        this.list = list;
        this.listLayout = {expand: list.y_expand, align: list.y_align};
        list.y_expand = false;
        list.y_align = Clutter.ActorAlign.START;
        this.area = list.get_parent();
        this.column = this.date._calendar.get_parent();
        this.originalVertical = this.area.vertical;
        this.area.vertical = true;
        this.date.menu.box.add_style_class_name('fm-notification-center');
        this.alignment = this.date.menu._boxPointer._sourceAlignment;
        this.date.menu.setSourceAlignment(1);
        this.hide(this.column);
        // Date heading, notification list, then one compact calendar widget.
        this.move(this.date._date, this.area, 0);
        this.move(this.date._calendar, this.area, 2);
        this.language = new CalendarLanguage(this.date);
        this.drawer = new NotificationDrawer(this.date.menu, this.area, this.date._calendar);
        const controls = list._dndButton.get_parent();
        for (const actor of controls.get_children())
            if (actor !== list._clearButton) this.hide(actor);
        // The date button must not contain a second, non-clickable DND icon.
        this.hide(this.date._indicator);
        this.settings = new Gio.Settings({schema_id: 'org.gnome.desktop.notifications'});
        this.button = new PanelMenu.Button(0.5, _('Do Not Disturb'));
        this.button.add_style_class_name('familiarmac-status');
        this.button.add_child(new St.Icon({icon_name: 'weather-clear-night-symbolic',
            style_class: 'system-status-icon'}));
        this.toggle = new PopupMenu.PopupSwitchMenuItem(_('Do Not Disturb'), false);
        this.button.menu.box.add_style_class_name('fm-focus-menu');
        this.button.menu.addMenuItem(this.toggle);
        this.toggle.connect('toggled', (_item, state) => this.settings.set_boolean('show-banners', !state));
        this.button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.button.menu.addAction(_('Notification Settings'), () =>
            Gio.AppInfo.create_from_commandline('gnome-control-center notifications', null,
                Gio.AppInfoCreateFlags.NONE).launch([], global.create_app_launch_context(0, -1)));
        const position = Main.panel._rightBox.get_children().indexOf(this.date.container);
        Main.panel.addToStatusArea('familiarmac-focus', this.button, position, 'right');
        this.settingSignal = this.settings.connect('changed::show-banners', () => this.sync());
        this.sync(false);
    }
    sync(animate = true) {
        const active = !this.settings.get_boolean('show-banners');
        this.toggle.setToggleState(active);
        // Like macOS's active Focus icon, it disappears after disabling Focus.
        // Control Center remains the entry point for turning it on again.
        if (!active) this.button.menu.close();
        const actor = this.button.container;
        const wasVisible = actor.visible;
        const width = wasVisible ? actor.width : 0;
        actor.remove_transition('width');
        actor.remove_transition('opacity');
        // Allocate intermediate widths so neighbours move with the icon.
        // Never animate the initial session layout or keep a hidden input actor.
        if (!animate || !St.Settings.get().enable_animations) {
            actor.visible = active;
            actor.width = -1;
            actor.opacity = 255;
            return;
        }
        if (!active && !wasVisible) return;
        const naturalWidth = this.button.get_preferred_width(-1)[1];
        actor.visible = true;
        actor.width = width;
        if (!wasVisible) actor.opacity = 0;
        actor.ease({width: active ? naturalWidth : 0, opacity: active ? 255 : 0,
            duration: 180, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                actor.visible = active;
                actor.width = -1;
                actor.opacity = 255;
            }});
    }
    hide(actor) {
        if (!actor) return;
        this.hidden.push([actor, actor.visible]);
        actor.hide();
        this.signals.push([actor, actor.connect('notify::visible', () => {
            if (actor.visible) actor.hide();
        })]);
    }
    move(actor, parent, index) {
        const original = actor.get_parent();
        this.moves.push([actor, original, original.get_children().indexOf(actor)]);
        original.remove_child(actor);
        parent.insert_child_at_index(actor, index);
    }
    destroy() {
        this.date?.menu.close();
        this.drawer?.destroy();
        if (this.placeholder) {
            this.placeholder.x_expand = this.placeholderLayout.expand;
            this.placeholder.x_align = this.placeholderLayout.align;
        }
        if (this.list) {this.list.y_expand = this.listLayout.expand; this.list.y_align = this.listLayout.align;}
        this.language?.destroy();
        if (this.settingSignal) this.settings.disconnect(this.settingSignal);
        this.settingSignal = 0;
        this.button?.container.remove_transition('width');
        this.button?.container.remove_transition('opacity');
        this.button?.destroy();
        this.button = null;
        for (const [actor, id] of this.signals.splice(0)) actor.disconnect(id);
        for (const [actor, parent, index] of this.moves.splice(0).reverse()) {
            actor.get_parent()?.remove_child(actor);
            parent.insert_child_at_index(actor, index);
        }
        for (const [actor, visible] of this.hidden.splice(0)) actor.visible = visible;
        this.date?._indicator?._sync();
        if (this.area) {
            this.area.vertical = this.originalVertical;
            this.date.menu.setSourceAlignment(this.alignment);
            this.date.menu.box.remove_style_class_name('fm-notification-center');
        }
    }
}
