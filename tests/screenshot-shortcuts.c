#include "keyd.h"
#include <assert.h>
#include <string.h>
#include <stdio.h>

static unsigned char down[256];
static int target, captured;
static void send_key(uint8_t key, uint8_t pressed) {
    down[key] = pressed;
    if (key == target && pressed) {
        assert(down[KEYD_LEFTMETA] || down[KEYD_RIGHTMETA]);
        assert(down[KEYD_LEFTCTRL] || down[KEYD_RIGHTCTRL]);
        assert(down[KEYD_LEFTSHIFT] || down[KEYD_RIGHTSHIFT]);
        captured++;
    }
}
static void layer_changed(const struct keyboard *kbd, const struct layer *layer, uint8_t active) {}
int main(int argc, char **argv) {
    struct config config;
    assert(argc == 2 && config_parse(&config, argv[1]) == 0);
    struct output output = {.send_key=send_key, .on_layer_change=layer_changed};
    for (int key=KEYD_3;key<=KEYD_4;key++) {
        for (int reverse=0;reverse<2;reverse++) {
            target=key; captured=0; memset(down,0,sizeof(down));
            struct keyboard *kbd=new_keyboard(&config,&output);
            int a=reverse ? KEYD_LEFTCTRL : KEYD_LEFTMETA;
            int b=reverse ? KEYD_LEFTMETA : KEYD_LEFTCTRL;
            struct key_event events[]={
                {a,1,1},{b,1,2},{KEYD_LEFTSHIFT,1,3},{key,1,4},
                {key,0,5},{KEYD_LEFTSHIFT,0,6},{b,0,7},{a,0,8}
            };
            kbd_process_events(kbd,events,8);
            assert(captured == 1);
            for(int i=0;i<256;i++) assert(!down[i]);
        }
    }
    puts("Cmd+Ctrl+Shift+3/4 emit clipboard shortcuts in both modifier orders: PASS");
    return 0;
}
