#!/usr/bin/python3
"""Render the hardware catalog without modifying any source illustration.

Requires python3-gi, gir1.2-rsvg-2.0 and python3-cairo.
"""
import json
from pathlib import Path
import cairo
import gi

gi.require_version('Rsvg', '2.0')
from gi.repository import Rsvg

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / 'assets/hardware/categories.json').read_text())
columns, cell_width, cell_height = 4, 320, 245
rows = (len(catalog) + columns - 1) // columns
surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, columns * cell_width, rows * cell_height)
context = cairo.Context(surface)
context.set_source_rgb(.13, .14, .16)
context.paint()
labels = {'pro-unibody': 'MacBook Pro Unibody 15″', 'pro-unibody-13': 'MacBook Pro Unibody 13″'}
for index, (key, item) in enumerate(catalog.items()):
    x, y = index % columns * cell_width, index // columns * cell_height
    rect = Rsvg.Rectangle()
    rect.x, rect.y, rect.width, rect.height = x + 22, y + 15, cell_width - 44, 184
    Rsvg.Handle.new_from_file(str(ROOT / 'assets/hardware' / item['asset'])).render_document(context, rect)
    context.select_font_face('sans-serif', cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
    context.set_font_size(14)
    context.set_source_rgb(.88, .89, .91)
    label = labels.get(key, item['label'])
    extents = context.text_extents(label)
    context.move_to(x + (cell_width - extents.width) / 2 - extents.x_bearing, y + 224)
    context.show_text(label)
out = ROOT / 'docs/screenshots/hardware-categories.png'
surface.write_to_png(str(out))
print(f'Rendered {len(catalog)} categories: {out}')
