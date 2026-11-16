import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Native tray still owns queueing, DND, actions, focus and animation/input bounds.
export class NotificationBanner {
    constructor() {
        this.tray = Main.messageTray;
        this.bin = this.tray?._bannerBin;
        if (!this.bin) return;
        this.alignment = this.tray.bannerAlignment;
        this.tray.bannerAlignment = Clutter.ActorAlign.END;
        this.bin.add_style_class_name('fm-notification-banners');
    }
    destroy() {
        if (!this.bin) return;
        this.bin.remove_style_class_name('fm-notification-banners');
        this.tray.bannerAlignment = this.alignment;
        this.bin = null;
    }
}
