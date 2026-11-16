// Physical actor coordinates; reserve native keyboard and notification space.
export function positions(width, height, stackWidth, stackHeight, clockWidth, clockHeight, keyboardHeight, scale) {
    const bottom = Math.max(0, height - keyboardHeight - Math.min(48 * scale, height * .06));
    const promptY = Math.max(0, bottom - stackHeight);
    const clockY = Math.floor(height * .10);
    const clockVisible = promptY >= clockY + clockHeight + 24 * scale;
    const notificationY = clockVisible ? clockY + clockHeight + 24 * scale : 0;
    return {promptX: Math.max(0, (width - stackWidth) / 2), promptY,
        clockX: Math.max(0, (width - clockWidth) / 2), clockY, clockVisible,
        notificationY, notificationHeight: Math.max(0, promptY - notificationY - 24 * scale)};
}
