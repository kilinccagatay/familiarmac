#!/usr/bin/env python3
"""Build README detail crops from the reviewed gallery PNGs; never modify originals."""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/screenshots'
CROPS = {
    'firefox-global-menu': ('firefox-global-menu', (0, 0, 1500, 850)),
    'finder-global-menu': ('finder-global-menu', (0, 0, 1500, 850)),
    'about': ('about', (780, 60, 2030, 1325)),
    'dock': ('apps', (970, 1625, 1920, 1800)),
    'apps': ('apps', (830, 400, 2060, 1390)),
    'spotlight-search': ('spotlight-search', (940, 340, 1940, 660)),
    'spotlight-calculator': ('spotlight-calculator', (940, 340, 1940, 660)),
    'control-center': ('control-center', (2060, 50, 2880, 1010)),
    'notifications': ('notifications', (2120, 75, 2870, 1150)),
    'wifi': ('wifi', (1960, 50, 2640, 535)),
    'sound': ('sound', (2010, 50, 2710, 550)),
    'keyboard': ('keyboard', (2175, 50, 2860, 270)),
    'power-menu': ('power-menu', (0, 40, 560, 840)),
    'restart-dialog': ('restart-dialog', (1060, 675, 1820, 1140)),
    'brightness-osd': ('brightness-osd', (1230, 1220, 1650, 1630)),
    'sound-osd': ('sound-osd', (1230, 1220, 1650, 1630)),
    'keyboard-osd': ('keyboard-osd', (1230, 1220, 1650, 1630)),
}
def main():
    destination = SOURCE / 'details'
    destination.mkdir(exist_ok=True)
    for name, (source, box) in CROPS.items():
        with Image.open(SOURCE / (source + '.png')) as image:
            x1, y1, x2, y2 = box
            if not (0 <= x1 < x2 <= image.width and 0 <= y1 < y2 <= image.height):
                raise ValueError(f'Invalid crop for {name}: {box}')
            image.crop(box).save(destination / (name + '.png'))
if __name__ == '__main__':
    main()
