#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cat > "$tmp/mock.c" <<'C'
struct event {int type,source;double value;};
void *libinput_event_pointer_get_base_event(void *p){return p;}
int libinput_event_get_type(struct event *p){return p->type;}
int libinput_event_pointer_get_axis_source(struct event *p){return p->source;}
double libinput_event_pointer_get_scroll_value(struct event *p,int axis){return p->value;}
double libinput_event_pointer_get_axis_value(struct event *p,int axis){return p->value;}
C
cat > "$tmp/test.c" <<'C'
#include <assert.h>
#include <math.h>
struct event {int type,source;double value;};
double libinput_event_pointer_get_scroll_value(struct event*,int);
double libinput_event_pointer_get_axis_value(struct event*,int);
int main(void){
 struct event e={405,2,100};
 assert(fabs(libinput_event_pointer_get_scroll_value(&e,0)-50)<0.0001);
 e.value=-100;assert(fabs(libinput_event_pointer_get_scroll_value(&e,1)+50)<0.0001);
 e.value=0;assert(libinput_event_pointer_get_scroll_value(&e,0)==0);
 e.type=404;e.value=100;assert(libinput_event_pointer_get_scroll_value(&e,0)==100);
 e.type=406;assert(libinput_event_pointer_get_scroll_value(&e,0)==100);
 e.type=403;assert(fabs(libinput_event_pointer_get_axis_value(&e,0)-50)<0.0001);
 e.source=1;assert(libinput_event_pointer_get_axis_value(&e,0)==100);
}
C
gcc -shared -fPIC "$tmp/mock.c" -o "$tmp/libmock.so"
gcc "$tmp/test.c" -L"$tmp" -lmock -Wl,-rpath,"$tmp" -o "$tmp/test"
gcc -shared -fPIC -Wall -Wextra -Werror native/scroll-scale.c -ldl -o "$tmp/scale.so"
LD_PRELOAD="$tmp/scale.so" "$tmp/test"
echo 'Finger-only 50% scaling, both axes/signs, stop event and unmodified wheel/continuous events: PASS'
