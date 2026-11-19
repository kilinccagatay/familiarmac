#!/usr/bin/env python3
"""Opt-in GNOME 46 experiment. Apply only to a disposable Mutter source tree."""
from pathlib import Path
import sys
root=Path(sys.argv[1]);p=root/'src/compositor/meta-shaped-texture.c';h=root/'src/meta/meta-shaped-texture.h'
s=p.read_text()
assert 'familiar_radius' not in s, 'Already patched'
s=s.replace('#include <math.h>', '#include <math.h>\n#include <string.h>')
s=s.replace('  MtkRegion *opaque_region;', '  MtkRegion *opaque_region;\n  MtkRegion *familiar_opaque_region;\n  float familiar_bounds[4];\n  float familiar_radius;\n  float familiar_exponent;',1)
s=s.replace('  g_clear_pointer (&stex->opaque_region, mtk_region_unref);','  g_clear_pointer (&stex->familiar_opaque_region, mtk_region_unref);\n  g_clear_pointer (&stex->opaque_region, mtk_region_unref);',1)
start=s.index('static CoglPipeline *\nget_base_pipeline')
helper=r'''
/* Blend the rounded edge while sampling the original client buffer. Unlike an
 * actor OffscreenEffect, this needs no full-window intermediate framebuffer. */
static void
familiar_add_rounding (MetaShapedTexture *stex, CoglPipeline *pipeline)
{
  CoglSnippet *vertex, *fragment;
  int loc;
  if (stex->familiar_radius <= 0.0f)
    return;
  vertex = cogl_snippet_new (COGL_SNIPPET_HOOK_VERTEX,
      "varying vec2 fm_position; uniform vec2 fm_size;", "fm_position = cogl_tex_coord0_in.xy * fm_size;");
  fragment = cogl_snippet_new (COGL_SNIPPET_HOOK_FRAGMENT,
      "varying vec2 fm_position; uniform vec4 fm_bounds; uniform float fm_radius; uniform float fm_exponent;",
      "vec2 p = fm_position;"
      "float coverage = 0.0;"
      "if (p.x >= fm_bounds.x && p.y >= fm_bounds.y && p.x <= fm_bounds.z && p.y <= fm_bounds.w) {"
      " if ((p.x >= fm_bounds.x+fm_radius && p.x <= fm_bounds.z-fm_radius) || (p.y >= fm_bounds.y+fm_radius && p.y <= fm_bounds.w-fm_radius)) {coverage=1.0;} else {"
      " vec2 center = clamp(p, fm_bounds.xy + vec2(fm_radius), fm_bounds.zw - vec2(fm_radius));"
      " vec2 delta = abs(p - center);"
      " float distance;"
      " if (fm_exponent == 4.0) {vec2 d2 = delta * delta; distance = sqrt(sqrt(dot(d2,d2)));}"
      " else {distance = pow(pow(delta.x,fm_exponent)+pow(delta.y,fm_exponent),1.0/fm_exponent);}"
      " coverage = clamp(fm_radius-distance+0.5,0.0,1.0);}"
      "}"
      "cogl_color_out *= coverage;");
  cogl_pipeline_set_blend (pipeline, "RGBA = ADD (SRC_COLOR, DST_COLOR * (1-SRC_COLOR[A]))", NULL);
  cogl_pipeline_add_snippet (pipeline, vertex);
  cogl_pipeline_add_snippet (pipeline, fragment);
  g_object_unref (vertex);
  g_object_unref (fragment);
  float size[2] = {stex->dst_width, stex->dst_height};
  loc = cogl_pipeline_get_uniform_location (pipeline, "fm_size");
  cogl_pipeline_set_uniform_float (pipeline, loc, 2, 1, size);
  loc = cogl_pipeline_get_uniform_location (pipeline, "fm_bounds");
  cogl_pipeline_set_uniform_float (pipeline, loc, 4, 1, stex->familiar_bounds);
  loc = cogl_pipeline_get_uniform_location (pipeline, "fm_radius");
  cogl_pipeline_set_uniform_1f (pipeline, loc, stex->familiar_radius);
  loc = cogl_pipeline_get_uniform_location (pipeline, "fm_exponent");
  cogl_pipeline_set_uniform_1f (pipeline, loc, stex->familiar_exponent);
}

static void
familiar_update_opaque (MetaShapedTexture *stex)
{
  MtkRectangle horizontal, vertical;
  int x1, y1, x2, y2, radius;
  g_clear_pointer (&stex->familiar_opaque_region, mtk_region_unref);
  if (stex->familiar_radius <= 0 || !stex->opaque_region)
    return;
  x1 = ceilf (stex->familiar_bounds[0]);
  y1 = ceilf (stex->familiar_bounds[1]);
  x2 = floorf (stex->familiar_bounds[2]);
  y2 = floorf (stex->familiar_bounds[3]);
  radius = ceilf (stex->familiar_radius + 1.0f);
  horizontal = (MtkRectangle) {x1, y1 + radius, MAX (0,x2-x1), MAX (0,y2-y1-2*radius)};
  vertical = (MtkRectangle) {x1 + radius, y1, MAX (0,x2-x1-2*radius), MAX (0,y2-y1)};
  stex->familiar_opaque_region = mtk_region_create_rectangle (&horizontal);
  mtk_region_union_rectangle (stex->familiar_opaque_region, &vertical);
  mtk_region_intersect (stex->familiar_opaque_region, stex->opaque_region);
}

void
meta_shaped_texture_set_familiar_rounding (MetaShapedTexture *stex,
                                         float x1, float y1, float x2, float y2,
                                         float radius, float exponent)
{
  float bounds[4] = {x1,y1,x2,y2};
  g_return_if_fail (META_IS_SHAPED_TEXTURE (stex));
  g_return_if_fail (isfinite(x1) && isfinite(y1) && isfinite(x2) && isfinite(y2) && isfinite(radius) && isfinite(exponent));
  radius = MAX (0.0f, MIN (radius, MIN (x2-x1,y2-y1)*0.5f));
  exponent = CLAMP (exponent, 2.0f, 12.0f);
  if (memcmp (bounds, stex->familiar_bounds, sizeof(bounds)) == 0 &&
      radius == stex->familiar_radius && exponent == stex->familiar_exponent)
    return;
  memcpy (stex->familiar_bounds, bounds, sizeof(bounds));
  stex->familiar_radius = radius;
  stex->familiar_exponent = exponent;
  familiar_update_opaque (stex);
  meta_shaped_texture_reset_pipelines (stex);
  clutter_content_invalidate (CLUTTER_CONTENT (stex));
}

'''
s=s[:start]+helper+s[start:]
for name in ['unmasked_pipeline','unmasked_tower_pipeline','masked_pipeline','masked_tower_pipeline']:
 needle=f'      stex->{name} = pipeline;'
 assert s.count(needle)==1,name
 s=s.replace(needle,'      familiar_add_rounding (stex, pipeline);\n'+needle)
a=s.index('static void\ndo_paint_content');b=s.index('\nstatic ',a+20)
chunk=s[a:b].replace('stex->opaque_region','effective_opaque')
chunk=chunk.replace('  gboolean use_opaque_region;','  gboolean use_opaque_region;\n  MtkRegion *effective_opaque = meta_shaped_texture_get_opaque_region (stex);')
s=s[:a]+chunk+s[b:]
s=s.replace('    stex->opaque_region = mtk_region_ref (opaque_region);','    stex->opaque_region = mtk_region_ref (opaque_region);\n  familiar_update_opaque (stex);')
s=s.replace('  return stex->opaque_region;','  return stex->familiar_radius > 0 ? stex->familiar_opaque_region : stex->opaque_region;')
a=s.index('meta_shaped_texture_is_opaque (');b=s.index('{',a)
s=s[:b+1]+'\n  if (stex->familiar_radius > 0)\n    return FALSE;\n'+s[b+1:]
p.write_text(s)
text=h.read_text();text=text.replace('G_END_DECLS','''/* Experimental opt-in single-pass compositor rounding. Radius 0 disables. */
META_EXPORT
void meta_shaped_texture_set_familiar_rounding (MetaShapedTexture *stex,
                                               float x1, float y1, float x2, float y2,
                                               float radius, float exponent);

G_END_DECLS''');h.write_text(text)
print('Patched opt-in native rounding and conservative opaque-region handling.')
