#!/usr/bin/python3
"""Rasterize the local Apple SVG at final sizes using 4x supersampling."""
from pathlib import Path
import io
import cairo
import gi
gi.require_version('Rsvg', '2.0')
from gi.repository import Rsvg
from PIL import Image
root = Path(__file__).resolve().parents[1]
svg = Rsvg.Handle.new_from_file(str(root/'assets/apple-white.svg'))
for size in range(64, 257, 8):
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, size*4, size*4)
    context = cairo.Context(surface)
    viewport = Rsvg.Rectangle(); viewport.x=0; viewport.y=0; viewport.width=size*4; viewport.height=size*4
    svg.render_document(context, viewport)
    buffer=io.BytesIO(); surface.write_to_png(buffer); buffer.seek(0)
    image=Image.open(buffer).resize((size,size),Image.Resampling.LANCZOS)
    image.save(root/'assets/boot'/f'apple-{size}.png')
