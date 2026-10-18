"""Workbench preview renders of the M0 slice at characteristic poses.

  Blender --background --factory-startup --python render_m0_previews.py -- [--outdir DIR]
Writes PNGs to blender/out/previews/ (git-ignored).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import build_m0_slice  # noqa: E402
from lib import kinematics, params, pose  # noqa: E402
from lib.bl import MM  # noqa: E402

OUT = os.path.join(params.MACHINE_DIR, "blender", "out", "previews")


def camera(name, loc_mm, target_mm, lens=50):
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam_data.clip_start = 0.002
    cam = bpy.data.objects.new(name, cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = Vector(loc_mm) * MM
    d = (Vector(target_mm) - Vector(loc_mm))
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return cam


def setup_render(res=(1200, 800)):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.display.shading.show_shadows = True
    sc.display.shading.show_cavity = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    world = bpy.data.worlds.new("w")
    world.color = (0.93, 0.93, 0.95)
    sc.world = world


def render(cam, path):
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    p = params.load()
    objs = build_m0_slice.build(p)
    kin = kinematics.Kin(p)
    setup_render()
    os.makedirs(OUT, exist_ok=True)
    over = camera("over", (190, -230, 200), (0, 5, 55), 45)
    gear = camera("gear", (70, -40, 95), (0, 20, 58), 70)
    carry = camera("carry", (-60, 150, 110), (-12, 78, 68), 55)
    shots = [
        ("01_overview_s0_rest", over, dict(setting=0, digit_start=0, theta=0)),
        ("02_overview_s7_mid", over, dict(setting=7, digit_start=3, theta=200)),
        ("03_gear_s5_theta190", gear, dict(setting=5, digit_start=0, theta=190)),
        ("04_gear_s9_theta100", gear, dict(setting=9, digit_start=0, theta=100)),
        ("05_carry_before", carry, dict(setting=1, digit_start=9, theta=250)),
        ("06_carry_mid", carry, dict(setting=1, digit_start=9, theta=270)),
        ("07_carry_stored", carry, dict(setting=1, digit_start=9, theta=283)),
        ("08_carry_executed", carry, dict(setting=1, digit_start=9, theta=360)),
    ]
    for name, cam, st in shots:
        v = pose.apply(objs, kin, **st)
        render(cam, os.path.join(OUT, name + ".png"))
        print(f"PREVIEW {name} v={v:.3f}")
