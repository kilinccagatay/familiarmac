#include "config.h"
#include <assert.h>
#include <stdio.h>

int main(int argc, char **argv) {
    struct config config;
    assert(argc == 2);
    assert(config_parse(&config, argv[1]) == 0);
    assert(config_check_match(&config, "05ac:0262:f2d1f5c2", ID_KEYBOARD) == 2);
    assert(config_check_match(&config, "05ac:0262:799a7e74", ID_TRACKPAD | ID_MOUSE) == 0);
    assert(config_check_match(&config, "05ac:0262:799a7e74", ID_KEYBOARD) == 0);
    assert(config_check_match(&config, "1234:5678:00000000", ID_KEYBOARD) == 0);
    puts("Actual keyd device matching: keyboard included, touchpad excluded: PASS");
    return 0;
}
