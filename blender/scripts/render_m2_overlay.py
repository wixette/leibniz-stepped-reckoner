"""Photo overlay for M2: the model's front elevation drawn as edges over a reference photo.

  Blender --background --factory-startup --python render_m2_overlay.py -- [--offset K] [--no-case]
      [--photo PATH --px-per-mm S --knob0 X Y] [--out PATH]

Renders an orthographic front elevation (looking along +Y) of the M2 model at 2 px/mm,
with the carriage at offset K. With --photo, the photo is scaled to the render and its
outline edges are replaced by the model's (red). The photo is aligned on carriage
features, so the ruler is the 37 mm digit pitch:
  --px-per-mm  photo scale in the plane of the carriage front (from the knob pitch)
  --knob0 X Y  photo pixel of the units knob's axis (x) and the carriage's top front edge (y)
Writes PNGs to blender/out/overlay/ (git-ignored). The overlay is for checking only; it is
not a tracing (design/m2-notes.md, Proportions).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import build_m2  # noqa: E402
from lib import params  # noqa: E402
from lib.bl import MM  # noqa: E402

OUT = os.path.join(params.MACHINE_DIR, "blender", "out", "overlay")
PX_PER_MM = 2.0
VIEW = (-680.0, -60.0, 230.0, 160.0)  # x0, z0, x1, z1 (mm) of the elevation


def arg(argv, name, n=1, default=None):
    if name not in argv:
        return default
    i = argv.index(name)
    vals = argv[i + 1:i + 1 + n]
    return vals[0] if n == 1 else vals


def render_elevation(path):
    x0, z0, x1, z1 = VIEW
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "FLAT"
    sc.display.shading.color_type = "RANDOM"  # one flat colour per part: edges where parts meet
    sc.view_settings.view_transform = "Standard"
    sc.render.resolution_x = int((x1 - x0) * PX_PER_MM)
    sc.render.resolution_y = int((z1 - z0) * PX_PER_MM)
    sc.render.film_transparent = True
    cam_data = bpy.data.cameras.new("elev")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = (x1 - x0) * MM
    cam_data.clip_start, cam_data.clip_end = 0.01, 5.0
    cam = bpy.data.objects.new("elev", cam_data)
    sc.collection.objects.link(cam)
    cam.location = Vector(((x0 + x1) / 2 * MM, -2.0, (z0 + z1) / 2 * MM))
    cam.rotation_euler = (Vector((0, 1, 0))).to_track_quat("-Z", "Z").to_euler()
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def pixels(path):
    im = bpy.data.images.load(path)
    w, h = im.size
    return np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1].copy()  # top row first


def save(arr, path):
    h, w = arr.shape[:2]
    im = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    im.pixels[:] = arr[::-1].ravel()
    im.filepath_raw, im.file_format = path, "PNG"
    im.save()


def edges(rgba):
    """Silhouette and colour-change edges of a flat-shaded render."""
    a = rgba[..., 3] > 0.5
    c = rgba[..., :3]
    e = np.zeros(a.shape, bool)
    for ax in (0, 1):
        da = a != np.roll(a, 1, ax)
        dc = np.abs(c - np.roll(c, 1, ax)).sum(-1) > 0.02
        e |= da | (dc & a)
    return e


def overlay(model_png, photo, s_ph, knob0, offset, out):
    p = params.load()
    pitch = p.v("layout.digit_pitch")
    m2 = "geometry.m2."
    # model reference point: units knob axis (x) and the carriage's top front edge (z)
    knob_dx = p.v("geometry.setting.rack_pitch_line_x") + p.v("geometry.setting.pinion_teeth") * p.v("geometry.setting.pinion_module") / 2
    xr_mm = knob_dx - pitch * offset
    zr_mm = p.v(m2 + "casing")["carriage_cover_z"][1]
    m = pixels(model_png)
    ph = pixels(photo)
    h, w = m.shape[:2]
    x0, z0, x1, z1 = VIEW
    jj, ii = np.meshgrid(np.arange(w), np.arange(h))
    xmm = x0 + (jj + 0.5) / PX_PER_MM
    zmm = z1 - (ii + 0.5) / PX_PER_MM
    u = np.round(knob0[0] + (xmm - xr_mm) * s_ph).astype(int)
    v = np.round(knob0[1] - (zmm - zr_mm) * s_ph).astype(int)
    ok = (u >= 0) & (u < ph.shape[1]) & (v >= 0) & (v < ph.shape[0])
    img = np.ones((h, w, 4), np.float32)
    img[ok] = ph[v[ok], u[ok]]
    img[..., :3] = 0.35 + 0.65 * img[..., :3]  # fade the photo so the model lines stand out
    e = edges(m)
    img[e] = (0.9, 0.05, 0.05, 1.0)
    save(img, out)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    offset = int(arg(argv, "--offset", default="0"))
    os.makedirs(OUT, exist_ok=True)
    build_m2.build(params.load())
    car = bpy.data.objects["pm.carriage"]
    car.location.x -= params.load().v("layout.digit_pitch") * offset * MM
    if "--no-case" in argv:
        for n in ("frame.case", "frame.register_cover", "pm.carriage_cover"):
            bpy.data.objects[n].hide_render = True
    model_png = os.path.join(OUT, f"m2-front-offset{offset}.png")
    render_elevation(model_png)
    photo = arg(argv, "--photo")
    if photo:
        s = float(arg(argv, "--px-per-mm"))
        k0 = [float(v) for v in arg(argv, "--knob0", 2)]
        out = arg(argv, "--out", default=os.path.join(OUT, f"overlay-{os.path.splitext(os.path.basename(photo))[0]}.png"))
        overlay(model_png, photo, s, k0, offset, out)
        print(f"OVERLAY_OK {out}")
    print(f"ELEVATION_OK {model_png}")
