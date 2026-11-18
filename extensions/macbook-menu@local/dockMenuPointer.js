import St from 'gi://St';

// Place the tail near the leading edge, not in the middle of a wide menu.
// At screen edges the body moves, while the tail keeps pointing at the icon.
export function pointerPlacement(center, width, left, right, inset, padding) {
    const x = Math.max(left + padding, Math.min(center - inset, right - padding - width));
    return {x, tip: Math.max(inset, Math.min(width - inset, center - x))};
}

export function drawDockOutline(cr, width, height, radius, rise, tip, halfBase, border) {
    const l = border / 2, t = l, r = width - l, b = height - rise - l;
    const rad = Math.min(radius, (r - l) / 2, (b - t) / 2);
    cr.moveTo(l + rad, t);
    cr.lineTo(r - rad, t); cr.arc(r - rad, t + rad, rad, -Math.PI / 2, 0);
    cr.lineTo(r, b - rad); cr.arc(r - rad, b - rad, rad, 0, Math.PI / 2);
    if (rise > 0) {
        cr.lineTo(tip + halfBase, b);
        cr.curveTo(tip + halfBase * .55, b, tip + rise * .4, b + rise, tip, b + rise);
        cr.curveTo(tip - rise * .4, b + rise, tip - halfBase * .55, b, tip - halfBase, b);
    }
    cr.lineTo(l + rad, b); cr.arc(l + rad, b - rad, rad, Math.PI / 2, Math.PI);
    cr.lineTo(l, t + rad); cr.arc(l + rad, t + rad, rad, Math.PI, Math.PI * 1.5);
    cr.closePath();
}

export function installDockMenuPointer(menu, icon) {
    const pointer = menu._boxPointer;
    menu.actor.add_style_class_name('fm-dock-pointed');
    // Keep the native allocation and modal input handling; replace only paint.
    // BoxPointer.vfunc_allocate explicitly allocates only _border and bin.
    // An extra child with BindConstraint never receives an allocation here.
    const nativeBorder = pointer._border;
    const area = new St.DrawingArea({reactive: false});
    pointer.remove_child(nativeBorder);
    pointer._border = area;
    pointer.add_child(area);
    pointer.set_child_below_sibling(area, pointer.bin);
    area.connect('repaint', () => {
        const node = pointer.get_theme_node();
        const [w, h] = area.get_surface_size();
        const rise = pointer._arrowSide === St.Side.BOTTOM ? node.get_length('-arrow-rise') : 0;
        const cr = area.get_context();
        drawDockOutline(cr, w, h, node.get_length('-arrow-border-radius'), rise,
            pointer._fmTailOrigin ?? w / 2, node.get_length('-arrow-base') / 2,
            node.get_length('-arrow-border-width'));
        cr.setSourceColor(node.get_color('-arrow-background-color')); cr.fillPreserve();
        cr.setSourceColor(node.get_color('-arrow-border-color'));
        cr.setLineWidth(node.get_length('-arrow-border-width')); cr.stroke(); cr.$dispose();
    });
    const original = pointer._reposition;
    const reposition = function (box) {
        original.call(this, box);
        if (this._arrowSide !== St.Side.BOTTOM) return;
        const texture = icon.icon?.icon ?? icon.child ?? icon;
        const [x, y] = texture.get_transformed_position();
        const [w] = texture.get_transformed_size();
        const bounds = icon._fmMagnifiedBounds;
        const center = bounds ? bounds[0] + bounds[2] / 2 : x + w / 2;
        const parent = this.get_parent();
        const work = this._workArea;
        const [ok, cx] = parent.transform_stage_point(center, work.y);
        const [okL, left] = parent.transform_stage_point(work.x, work.y);
        const [okR, right] = parent.transform_stage_point(work.x + work.width, work.y);
        if (!ok || !okL || !okR) return;
        const node = this.get_theme_node();
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const inset = node.get_length('-arrow-border-radius') + node.get_length('-arrow-base') / 2 + 4 * scale;
        const placement = pointerPlacement(cx, box.get_width(), left, right, inset, 8 * scale);
        // Anchor the tail to the visible texture, not the padded Dock button.
        // Native positioning otherwise adds the button padding to our gap.
        const [okY, , iconTop] = parent.transform_stage_point(center, bounds ? bounds[1] : y);
        const [okTop, , workTop] = parent.transform_stage_point(work.x, work.y);
        const menuY = okY && okTop
            ? Math.max(workTop, iconTop - node.get_length('-boxpointer-gap') - box.get_height())
            : box.y1;
        box.set_origin(placement.x, menuY);
        this._fmTailOrigin = placement.tip;
        area.queue_repaint();
    };
    pointer._reposition = reposition;
    const styleSignal = pointer.connect('style-changed', () => area.queue_repaint());
    let destroyed = false;
    const destroySignal = pointer.connect('destroy', () => {
        destroyed = true;
        nativeBorder.destroy();
    });
    return () => {
        if (destroyed) return;
        pointer.disconnect(styleSignal); pointer.disconnect(destroySignal);
        if (pointer._reposition === reposition) pointer._reposition = original;
        pointer._border = nativeBorder;
        pointer.add_child(nativeBorder);
        pointer.set_child_below_sibling(nativeBorder, pointer.bin);
        delete pointer._fmTailOrigin;
        area.destroy();
        menu.actor.remove_style_class_name('fm-dock-pointed');
    };
}
