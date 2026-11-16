import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export function secondsRemaining(value) {
    return Math.max(0, Math.ceil(value));
}

// Keep the session manager's timer, inhibitors, update actions and cancellation.
// Only replace the rounded presentation, never the restart/shutdown machinery.
export class SessionDialog {
    constructor() {
        this.dialog = Main.endSessionDialog;
        if (!this.dialog) return;
        this.originalSync = this.dialog._sync;
        const owner = this;
        this.wrapper = function (...args) {
            owner.originalSync.apply(this, args);
            this.dialogLayout.add_style_class_name('familiarmac-session-dialog');
            if (this._type > 2 || this._checkBox.checked || this._secondsLeft <= 0) return;
            const content = this._messageDialogContent;
            const seconds = secondsRemaining(this._secondsLeft);
            // GNOME's translations contain a single countdown at the end; user
            // names may contain digits, so replace only the final numeric token.
            content.description = content.description.replace(/\d+(?![\s\S]*\d)/, String(seconds));
            const language = GLib.get_language_names()[0];
            if (language.startsWith('en') || language === 'C' || language.startsWith('tr')) {
                const tr = language.startsWith('tr');
                const titles = tr
                    ? ['Oturumu kapatmak istediğine emin misin?', 'Bilgisayarı kapatmak istediğine emin misin?', 'Bilgisayarı yeniden başlatmak istediğine emin misin?']
                    : ['Are you sure you want to log out?', 'Are you sure you want to shut down your computer now?', 'Are you sure you want to restart your computer now?'];
                content.title = titles[this._type];
            }
        };
        this.dialog._sync = this.wrapper;
    }

    destroy() {
        if (this.dialog?._sync === this.wrapper) this.dialog._sync = this.originalSync;
        this.dialog?.dialogLayout.remove_style_class_name('familiarmac-session-dialog');
        this.dialog = null;
    }
}
