/* libinput stable ABI, 1.19+: https://gitlab.freedesktop.org/libinput/libinput/-/blob/1.25.0/src/libinput.h
 * Interpose scroll distance only, in the user's GNOME Shell process.
 * No device setters, pointer motion hooks, keyboard hooks or gesture hooks.
 */
#define _GNU_SOURCE
#include <dlfcn.h>
struct libinput_event_pointer;
struct libinput_event;
typedef double (*value_fn)(struct libinput_event_pointer *, int);
typedef struct libinput_event *(*base_fn)(struct libinput_event_pointer *);
typedef int (*type_fn)(struct libinput_event *);
typedef int (*source_fn)(struct libinput_event_pointer *);
static double factor(struct libinput_event_pointer *event) {
    base_fn base = (base_fn)dlsym(RTLD_NEXT, "libinput_event_pointer_get_base_event");
    type_fn type = (type_fn)dlsym(RTLD_NEXT, "libinput_event_get_type");
    if (!base || !type) return 1.0;
    int t = type(base(event));
    /* POINTER_SCROLL_FINGER=405; legacy POINTER_AXIS=403, SOURCE_FINGER=2. */
    if (t == 405) return 0.50;
    if (t == 403) {
        source_fn source = (source_fn)dlsym(RTLD_NEXT, "libinput_event_pointer_get_axis_source");
        if (source && source(event) == 2) return 0.50;
    }
    return 1.0;
}
double libinput_event_pointer_get_scroll_value(struct libinput_event_pointer *event, int axis) {
    value_fn next = (value_fn)dlsym(RTLD_NEXT, "libinput_event_pointer_get_scroll_value");
    return next ? next(event, axis) * factor(event) : 0.0;
}
double libinput_event_pointer_get_axis_value(struct libinput_event_pointer *event, int axis) {
    value_fn next = (value_fn)dlsym(RTLD_NEXT, "libinput_event_pointer_get_axis_value");
    return next ? next(event, axis) * factor(event) : 0.0;
}
