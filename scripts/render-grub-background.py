#!/usr/bin/python3
"""Render our vector logo on black, aligned with the Plymouth boot layout."""
from pathlib import Path
import sys
import cairo
import gi
gi.require_version('Rsvg', '2.0')
from gi.repository import Rsvg
root = Path(__file__).resolve().parents[1]
width, height = 1600, 1000
size = int(height * .115 / 8) * 8
surface = cairo.ImageSurface(cairo.FORMAT_RGB24, width, height)
context = cairo.Context(surface)
context.set_source_rgb(0, 0, 0)
context.paint()
viewport = Rsvg.Rectangle()
viewport.x, viewport.y = (width-size)/2, (height-size)/2
viewport.width = viewport.height = size
Rsvg.Handle.new_from_file(str(root/'assets/apple-white.svg')).render_document(context, viewport)
surface.write_to_png(sys.argv[1])
