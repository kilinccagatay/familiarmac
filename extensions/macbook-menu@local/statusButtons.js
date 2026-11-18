import {BatteryIcon} from './batteryIcon.js';
import {PanelOrder} from './panelOrder.js';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

// Separate hit targets; native hardware controls stay in their original grid.
export class StatusButtons {
    constructor(owner) {
        this.owner = owner;
        this.panel = owner.panel;
        const source=Gio.SettingsSchemaSource.new_from_directory(GLib.build_filenamev([GLib.get_user_data_dir(),'gnome-shell/extensions/familiarmac-genie@local/schemas']),Gio.SettingsSchemaSource.get_default(),false);
        this.preferences=new Gio.Settings({settings_schema:source.lookup('org.gnome.shell.extensions.familiarmac-genie',true)});
        this.buttons = [];
        this.mask = [];
        this.spans = [];
        const menu = this.panel.menu;
        this.originalClose = menu.close;
        this.closeWrapper = animate => {
            // Hide before restoring the shared grid, including submenu collapse.
            // No full Control Center frame may paint while a detail closes.
            if (this.active) menu.actor.hide();
            this.originalClose.call(menu, this.active ? BoxPointer.PopupAnimation.NONE : animate);
        };
        menu.close = this.closeWrapper;
        this.closedSignal = menu.connect('open-state-changed', (_m, open) => {
            if (!open) this.restore();
        });
        if (this.panel._system) {
            this.install();
        } else {
            // Native indicators are built asynchronously. Complete in the next
            // idle turn after insertion, not on a one-second polling timer.
            this.readySignal = this.panel._indicators.connect('child-added', () => {
                if (this.timer) return;
                this.timer = GLib.idle_add(GLib.PRIORITY_HIGH_IDLE, () => {
                    this.timer = 0;
                    if (this.panel._system) {
                        this.panel._indicators.disconnect(this.readySignal);
                        this.readySignal = 0;
                        this.install();
                    }
                    return GLib.SOURCE_REMOVE;
                });
            });
        }
    }

    install() {
        const box = this.panel._indicators;
        for (const [key, title] of [['_network', 'Network'], ['_bluetooth', 'Bluetooth'],
            ['_volumeOutput', 'Sound'], ['_system', 'Battery']]) {
            const indicator = this.panel[key];
            if (!indicator || indicator.get_parent() !== box) continue;
            const index = box.get_children().indexOf(indicator);
            const button = new PanelMenu.Button(0.5, title, true);
            button.add_style_class_name('familiarmac-status-single');
            box.remove_child(indicator);
            const content = new St.BoxLayout();
            button.add_child(content);
            content.add_child(indicator);
            let batteryIcon = null;
            const powerProxy = key === '_system' ? indicator._systemItem?.powerToggle?._proxy : null;
            if (powerProxy) {
                batteryIcon = new BatteryIcon(powerProxy, present => { button.visible = present; });
                content.add_child(batteryIcon.actor);
                indicator.hide();
            }
            let wirelessIcon = null;
            const wireless = key === '_network' ? indicator._wirelessToggle : null;
            const bindings = [];
            const networkBindings = [];
            if (key === '_network') {
                const ethernetIcon = new Gio.FileIcon({file:Gio.File.new_for_path(`${this.owner.path}/ethernet-symbolic.svg`)});
                // Follow the native primary-route icon; retain Wi-Fi access in the menu.
                indicator.hide();
                wirelessIcon = new St.Icon({style_class: 'system-status-icon'});
                content.add_child(wirelessIcon);
                const updateWifi = () => {
                    const primary = indicator._primaryIndicator;
                    const name = primary?.visible ? primary.icon_name : wireless?.icon_name;
                    // Keep native disconnected/acquiring/error symbols intact.
                    if (name === 'network-wired-symbolic') {
                        wirelessIcon.add_style_class_name('fm-ethernet-icon');
                        wirelessIcon.gicon = ethernetIcon;
                    } else {
                        wirelessIcon.remove_style_class_name('fm-ethernet-icon');
                        wirelessIcon.icon_name = name ?? 'network-offline-symbolic';
                    }
                    wirelessIcon.visible = Boolean(primary?.visible || wireless?.visible);
                    indicator.hide();
                    button.visible = wirelessIcon.visible && this.preferences.get_boolean('wifi-panel-icon');
                };
                if (wireless) bindings.push(wireless.connect('notify::icon-name', updateWifi),
                    wireless.connect('notify::visible', updateWifi));
                if (indicator._primaryIndicator) {
                    for (const name of ['notify::icon-name', 'notify::visible'])
                        networkBindings.push([indicator._primaryIndicator, indicator._primaryIndicator.connect(name, updateWifi)]);
                }
                networkBindings.push([this.preferences,this.preferences.connect('changed::wifi-panel-icon',updateWifi)]);
                updateWifi();
            }
            let bluetoothIcon=null;
            if(key==='_bluetooth'){
                bluetoothIcon=new St.Icon({style_class:'system-status-icon',icon_name:'bluetooth-active-symbolic'});content.add_child(bluetoothIcon);
            }
            const sync = () => {
                if(bluetoothIcon){
                    const native=indicator.quickSettingsItems?.[0];
                    bluetoothIcon.icon_name=native?.icon_name??'bluetooth-disabled-symbolic';
                    bluetoothIcon.visible=!indicator.visible;
                    button.visible=this.preferences.get_boolean('bluetooth-panel-icon');
                    return;
                }
                if (wirelessIcon) {
                    button.visible = wirelessIcon.visible && this.preferences.get_boolean('wifi-panel-icon');
                    if (indicator.visible) indicator.hide();
                    return;
                }
                if (batteryIcon) {
                    button.visible = batteryIcon.state.present;
                    if (indicator.visible) indicator.hide();
                    return;
                }
                button.visible = Boolean(wireless?.visible || indicator.visible);
                if (wireless?.visible && indicator.visible) indicator.hide();
            };
            if(bluetoothIcon){
                networkBindings.push([this.preferences,this.preferences.connect('changed::bluetooth-panel-icon',sync)]);
                const native=indicator.quickSettingsItems?.[0];
                if(native)networkBindings.push([native,native.connect('notify::icon-name',sync)]);
            }
            const signal = indicator.connect('notify::visible', sync);
            sync();
            // PanelMenu dispatches both mouse press and touch to menu.toggle.
            button.menu.toggle = () => this.open(key, button);
            button.connect('key-press-event', (_a, event) => {
                if (![Clutter.KEY_Return, Clutter.KEY_space, Clutter.KEY_Down].includes(event.get_key_symbol()))
                    return Clutter.EVENT_PROPAGATE;
                this.open(key, button); return Clutter.EVENT_STOP;
            });
            const position = Main.panel._rightBox.get_children().indexOf(this.panel.container);
            Main.panel.addToStatusArea(`familiarmac-status-${key}`, button, Math.max(0, position), 'right');
            this.buttons.push({indicator, index, button, signal, wireless, bindings, networkBindings, wirelessIcon, batteryIcon});
        }
        this.panelOrder = new PanelOrder();
    }

    open(key, button) {
        if(!button?.visible||!button?.mapped)button=this.panel;
        const menu = this.panel.menu;
        const same = this.active === button && menu.isOpen;
        menu.close();
        this.restore();
        if (same) return;
        this.owner.detail = key;
        this.owner.arrange();
        this.owner.syncSurface?.();
        const wireless = key === '_network' ? this.panel._network?._wirelessToggle : null;
        const customWifi = Boolean(wireless?.visible && this.owner.wifi);
        const customSound = key === '_volumeOutput' && Boolean(this.owner.sound?.native);
        const customKeyboard = key === '_backlight' && Boolean(this.owner.keyboard?.native);
        const customBluetooth=key==='_bluetooth'&&Boolean(this.owner.bluetooth);
        const selected = new Set(customBluetooth || key === '_system' || customWifi || customSound || customKeyboard ? [] : wireless?.visible ? [wireless] : this.panel[key]?.quickSettingsItems ?? []);
        for (const {label, item} of this.owner.labels) if (selected.has(item)) selected.add(label);
        // GNOME 46 QuickSettingsLayout computes (rows.length - 1) * spacing.
        // Hiding every child produces a negative preferred height and a fatal
        // Clutter warning, even while the grid parent is hidden. Custom surfaces
        // already hide the parent in syncSurface(); keep its rows intact.
        for (const item of selected.size ? menu._grid.get_children() : []) {
            if (selected.has(item) || item === menu._grid.layout_manager._overlay) continue;
            const saved = {item, visible: item.visible, guard: false};
            saved.signal = item.connect('notify::visible', () => {
                if (saved.guard) return;
                saved.visible = item.visible;
                saved.guard = true; item.hide(); saved.guard = false;
            });
            saved.guard = true; item.hide(); saved.guard = false;
            this.mask.push(saved);
        }
        // All status details share the native controls, but their popup anchor
        // and focus return target must be the button actually used to open it.
        this.anchor = {source: menu.sourceActor, focus: menu.focusActor,
            alignment: menu._arrowAlignment};
        menu.sourceActor = button;
        menu.focusActor = button;
        menu._arrowAlignment = 0.5;
        for (const item of selected) {
            if (item.get_parent() !== menu._grid) continue;
            const meta = menu._grid.layout_manager.get_child_meta(menu._grid, item);
            this.spans.push({meta, span: meta.column_span});
            meta.column_span = 2;
        }
        this.active = button;
        button.add_style_pseudo_class('active');
        menu.box.add_style_class_name('familiarmac-status-detail');
        menu.open();
        if (customBluetooth) this.owner.bluetooth.show();
        if (customKeyboard) this.owner.keyboard.show();
        if (customSound) this.owner.sound.show();
        if (customWifi) this.owner.wifi.show();
        else if (wireless?.visible && wireless.menu) wireless.menu.open(BoxPointer.PopupAnimation.NONE);
        // Native QuickSettings marks its source active even for our detail view.
        // Only the independently clicked status button should be highlighted.
        this.panel.remove_style_pseudo_class('active');
    }

    restore() {
        this.owner.keyboard?.hide();
        this.owner.sound?.hide();
        this.owner.wifi?.hide();
        this.owner.bluetooth?.hide();
        for (const {item, signal, visible} of this.mask) {
            item.disconnect(signal); item.visible = visible;
        }
        this.mask = [];
        for (const {meta, span} of this.spans) meta.column_span = span;
        this.spans = [];
        if (this.anchor) {
            const menu = this.panel.menu;
            menu.sourceActor = this.anchor.source;
            menu.focusActor = this.anchor.focus;
            menu._arrowAlignment = this.anchor.alignment;
            this.anchor = null;
        }
        this.active?.remove_style_pseudo_class('active');
        this.active = null;
        this.owner.detail = false;
        this.owner.syncSurface?.();
        this.panel.menu.box.remove_style_class_name('familiarmac-status-detail');
    }

    destroy() {
        this.panelOrder?.destroy();
        this.panelOrder = null;
        if (this.readySignal) this.panel._indicators.disconnect(this.readySignal);
        this.readySignal = 0;
        if (this.timer) GLib.source_remove(this.timer);
        this.timer = 0;
        this.panel.menu.close();
        this.panel.menu.disconnect(this.closedSignal);
        if (this.panel.menu.close === this.closeWrapper) this.panel.menu.close = this.originalClose;
        this.restore();
        const box = this.panel._indicators;
        for (const {indicator, index, button, signal, wireless, bindings, networkBindings, wirelessIcon, batteryIcon} of this.buttons.reverse()) {
            for (const [actor, id] of networkBindings) actor.disconnect(id);
            for (const id of bindings) wireless.disconnect(id);
            if (wirelessIcon) indicator.show();
            indicator.disconnect(signal);
            if (batteryIcon) {
                indicator.visible = batteryIcon.state.present;
                batteryIcon.destroy();
            }
            indicator.get_parent().remove_child(indicator);
            box.insert_child_at_index(indicator, Math.min(index, box.get_n_children()));
            button.destroy();
        }
        this.buttons = [];
    }
}
