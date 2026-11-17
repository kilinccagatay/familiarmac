import Clutter from 'gi://Clutter';
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';

// Resolve the initial actor synchronously when ModalDialog requests it. Do not
// move an already visible focus, dispatch actions, or override native key handling.
export class DialogFocus {
    constructor() {
        const proto = Dialog.Dialog.prototype;
        this.descriptor = Object.getOwnPropertyDescriptor(proto, 'initialKeyFocus');
        if (!this.descriptor?.get || !this.descriptor.configurable)
            return; // An incompatible Shell must retain its native behavior.
        this.records = new WeakMap();
        this.original = proto.addButton;
        const owner = this;
        this.wrapper = function (info) {
            const button = owner.original.call(this, info);
            let buttons = owner.records.get(this);
            if (!buttons) {
                buttons = new WeakMap();
                owner.records.set(this, buttons);
            }
            buttons.set(button, {key: info.key, default: info.default});
            return button;
        };
        this.getter = function () {
            const nativeFocus = owner.descriptor.get.call(this);
            const buttons = owner.records.get(this);
            if (!buttons) return nativeFocus;
            const visible = this.buttonLayout.get_children().filter(b => b.visible);
            if (visible.length !== 2) return nativeFocus;
            const [cancel, confirm] = visible;
            const first = buttons.get(cancel);
            const second = buttons.get(confirm);
            if (!first || !second || nativeFocus !== cancel ||
                first.key !== Clutter.KEY_Escape || first.default !== undefined ||
                second.default !== undefined || second.key ||
                !confirm.reactive || !confirm.can_focus)
                return nativeFocus;
            return confirm;
        };
        proto.addButton = this.wrapper;
        Object.defineProperty(proto, 'initialKeyFocus', {
            ...this.descriptor, get: this.getter,
        });
    }

    destroy() {
        const proto = Dialog.Dialog.prototype;
        if (this.wrapper && proto.addButton === this.wrapper)
            proto.addButton = this.original;
        if (this.getter && Object.getOwnPropertyDescriptor(proto, 'initialKeyFocus')?.get === this.getter)
            Object.defineProperty(proto, 'initialKeyFocus', this.descriptor);
        // WeakMaps do not keep destroyed dialogs or their actors alive.
    }
}
