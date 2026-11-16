// Physical actor coordinates; GTK/Clutter already apply monitor scaling.
export function panelRanges(width, leftNatural, rightNatural, gap, rtl = false) {
    const right = Math.min(width, Math.max(0, rightNatural));
    const left = Math.min(Math.max(0, leftNatural), Math.max(0, width - right - gap));
    return rtl ? {left: [width - left, width], right: [0, right]}
        : {left: [0, left], right: [width - right, width]};
}
