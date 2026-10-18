"""M0: one-digit slice of the Leibniz stepped reckoner, built from params.

Run headless:
  Blender --background --factory-startup --python build_m0_slice.py -- [--out PATH] [--blend PATH]

Builds (all in mm, slice origin at the base centre; shafts along +Y, +Z up):
  frame.static        base plate, posts, brackets            (static)
  pm.drum_shaft.0     square shaft + handwheel                (rotate about +Y: crank angle)
    pm.drum.0         stepped drum with 9 graduated ribs      (translate along +Y: setting)
  pm.setting_rack.0   rack + fork                             (translate along +Y: setting)
  pm.setting_dial.0   knob, pointer, pinion, vertical shaft   (rotate about +Z: setting)
  pm.setting_plate.0  fixed dial plate with digits 0-9        (static)
  pi.sum_wheel.0      result shaft, receiving gear, digit disc, Einzahn (rotate about +Y)
  pi.carry_store.0    store shaft, Fünfhorn, Muldenrad, pentagon disc   (rotate about +Y)
  pi.window.0         reading window above the digit disc     (static)
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from lib import bl, geom, params  # noqa: E402
from lib.bl import MeshBuilder  # noqa: E402

DEFAULT_OUT = os.path.join(params.MACHINE_DIR, "assets", "m0-digit-slice.glb")


def build(p):
    bl.reset_scene()
    col = bpy.context.scene.collection
    root = bl.empty("lsr_m0", col)

    G = "geometry."
    zd = p.v(G + "drum.axis_z")
    L = p.v(G + "drum.length")
    step = p.v(G + "drum.rib_length_step")
    m = p.v(G + "drum.module")
    add, ded = p.v(G + "drum.tooth_addendum"), p.v(G + "drum.tooth_dedendum")
    drum_gear = geom.GearSpec(p.v(G + "drum.virtual_teeth"), m, p.v(G + "drum.rib_thickness_factor"), add, ded)
    rg = geom.GearSpec(p.v(G + "receiving_gear.teeth"), p.v(G + "receiving_gear.module"), 1.0, add, ded)
    cd = drum_gear.rp + rg.rp                      # drum-to-result-shaft centre distance
    zs = zd + cd                                   # result shaft height
    y_gear = p.v(G + "receiving_gear.y")
    g_th = p.v(G + "receiving_gear.thickness")
    Fx, Fz = p.v(G + "carry_store.offset_xz")
    zf = zs + Fz
    xf = Fx

    # ---------------------------------------------------------------- drum shaft (rotates)
    mb = MeshBuilder()
    sq = 3.0
    mb.prism(geom.rect(-sq, -sq, sq, sq), "XZ", -76, 78, "steel")
    mb.prism(geom.circle(14, 48), "XZ", -73.5, -70.5, "brass_satin", smooth=True)        # handwheel
    mb.prism(geom.circle(4.5, 24), "XZ", -70.5, -66.5, "brass_satin", smooth=True)       # hub
    hx, hz = geom.circle(1.6, 16), 11.0
    mb.prism([(u, w + hz) for u, w in hx], "XZ", -85, -73.5, "steel_dark", smooth=True)  # handle pin
    shaft = mb.build("pm.drum_shaft.0", col, (0, 0, zd))
    bl.set_motion(shaft, "rotate", (0, 1, 0), "Drum shaft (turned by the crank)", "Staffelwalzenwelle (von der Kurbel gedreht)")
    bl.parent(shaft, root)

    # ---------------------------------------------------------------- stepped drum (slides)
    # Local frame: origin on the axis at the drum's front face; the drum spans y = 0..L.
    mb = MeshBuilder()
    mb.prism(geom.circle(drum_gear.rf, 64), "XZ", 0, L, "brass_polished", smooth=True)
    mb.prism(geom.circle(sq + 0.4, 4, 45), "XZ", -0.01, L + 0.01, "steel_dark")          # square bore look
    first = p.v(G + "drum.rib_first_angle")
    pitch = p.v("pars_mobilis.drum.rib_pitch")
    for k in range(1, 10):
        tooth = geom.tooth_polygon(drum_gear, first + (k - 1) * pitch, root_r=drum_gear.rf - 0.3)
        mb.prism(tooth, "XZ", L - k * step, L, "brass_polished")
    # collar with a groove for the setting fork, in front of the drum
    mb.prism(geom.circle(9.0, 40), "XZ", -4.0, -3.0, "brass_satin", smooth=True)
    mb.prism(geom.circle(7.0, 40), "XZ", -3.0, -1.0, "brass_satin", smooth=True)
    mb.prism(geom.circle(9.0, 40), "XZ", -1.0, 0.0, "brass_satin", smooth=True)
    drum = mb.build("pm.drum.0", col, (0, 0, zd))
    drum["core_radius_mm"] = drum_gear.rf
    drum["rib_tip_radius_mm"] = drum_gear.ra
    bl.set_motion(drum, "translate", (0, 1, 0), "Stepped drum (Staffelwalze)", "Staffelwalze", unit="mm")
    bl.parent(drum, shaft)

    # ---------------------------------------------------------------- setting rack (slides with the drum)
    # Local frame: same origin as the drum (front face, on the axis); y measured from the drum front.
    x_pl = p.v(G + "setting.rack_pitch_line_x")
    pm_ = p.v(G + "setting.pinion_module")
    centres = [-2.0 - 4.0 * j for j in range(13)]
    mb = MeshBuilder()
    for poly in geom.rack_teeth(x_pl, pm_, centres, back_u=x_pl - 5.0):
        mb.prism(poly, "XY", -4.0, 4.0, "steel")
    mb.prism(geom.rect(7.2, -2.7, x_pl - 4.0, -1.3), "XY", -2.5, 2.5, "steel")           # fork arm into the collar groove
    rack = mb.build("pm.setting_rack.0", col, (0, 0, zd))
    bl.set_motion(rack, "translate", (0, 1, 0), "Setting rack", "Einstellzahnstange", unit="mm")
    bl.parent(rack, root)

    # ---------------------------------------------------------------- setting dial (rotates about Z)
    pin_g = geom.GearSpec(p.v(G + "setting.pinion_teeth"), pm_)
    px, py = x_pl + pin_g.rp, p.v(G + "setting.pinion_y")
    z_plate = 108.0
    mb = MeshBuilder()
    mb.prism(geom.gear_outline(pin_g, 0.0), "XY", zd - 4.0, zd + 4.0, "brass_polished")
    mb.prism(geom.circle(1.5, 16), "XY", 6.0, z_plate + 10.0, "steel", smooth=True)        # vertical shaft
    mb.prism(geom.circle(5.0, 32), "XY", z_plate + 2.0, z_plate + 4.0, "brass_satin", smooth=True)
    pointer_len = 8.5
    mb.prism(geom.radial_bar(0, pointer_len, 2.2, -90.0), "XY", z_plate + 2.0, z_plate + 3.2, "steel_dark")  # pointer
    mb.prism(geom.rect(-1.5, -4.0, 1.5, 4.0), "XY", z_plate + 4.0, z_plate + 12.0, "brass_polished")  # grip
    dial = mb.build("pm.setting_dial.0", col, (px, py, 0))
    bl.set_anchors(dial, "pointer_tip", [(0.0, -pointer_len, z_plate + 2.6)])
    bl.set_motion(dial, "rotate", (0, 0, 1), "Setting knob and pinion", "Stellgriff mit Ritzel")
    bl.parent(dial, root)

    mb = MeshBuilder()
    mb.prism(geom.circle(17.0, 48), "XY", z_plate, z_plate + 2.0, "brass_satin", smooth=True)
    plate_glyphs = []
    for s in range(10):
        a = -90.0 + 36.0 * s
        cx, cy = 12.8 * math.cos(math.radians(a)), 12.8 * math.sin(math.radians(a))
        plate_glyphs.append((cx, cy, z_plate + 2.25))
        verts, faces = bl.glyph_mesh(str(s), 3.8, 0.3)
        mtx = bl.frame_matrix((cx, cy, z_plate + 2.1), (1, 0, 0), (0, 1, 0))
        mb.add_mesh_data(verts, faces, mtx, "ink_black")
    plate = mb.build("pm.setting_plate.0", col, (px, py, 0))
    bl.set_anchors(plate, "glyph_anchors", plate_glyphs)
    plate["motion"] = "static"
    bl.parent(plate, root)

    # ---------------------------------------------------------------- result wheel (rotates)
    R = "geometry.result."
    rd = p.v(R + "disc_radius")
    dy0, dy1 = p.v(R + "disc_y")
    re, rpin = p.v(R + "einzahn_radius"), p.v(R + "einzahn_pin_radius")
    psi = p.v(R + "einzahn_angle")
    py0, py1 = p.v(R + "einzahn_pin_y")
    mb = MeshBuilder()
    mb.prism(geom.circle(1.5, 16), "XZ", 6.0, 99.0, "steel", smooth=True)                 # result shaft
    mb.prism(geom.gear_outline(rg, 18.0), "XZ", y_gear - g_th / 2, y_gear + g_th / 2, "brass_polished")
    mb.prism(geom.circle(3.0, 24), "XZ", y_gear - g_th / 2 - 2, y_gear + g_th / 2 + 2, "brass_satin", smooth=True)
    mb.prism(geom.circle(rd, 72), "XZ", dy0, dy1, "enamel_white", smooth=True)            # digit disc
    mb.prism(geom.circle(rd + 0.6, 72), "XZ", dy0 - 0.8, dy0, "brass_polished", smooth=True)
    mb.prism(geom.circle(rd + 0.6, 72), "XZ", dy1, dy1 + 0.8, "brass_polished", smooth=True)
    disc_glyphs = []
    for d in range(10):
        a = math.radians(90.0 - 36.0 * d)
        n = (math.cos(a), 0.0, math.sin(a))
        t = (math.sin(a), 0.0, -math.cos(a))
        o = (n[0] * (rd + 0.12), (dy0 + dy1) / 2.0, n[2] * (rd + 0.12))
        disc_glyphs.append(o)
        verts, faces = bl.glyph_mesh(str(d), 6.2, 0.25)
        mb.add_mesh_data(verts, faces, bl.frame_matrix(o, t, (0, 1, 0)), "ink_black")
    # Einzahn: arm behind the disc + pin reaching into the horn plane
    mb.prism(geom.radial_bar(0.0, re, 3.0, psi), "XZ", 70.8, 73.5, "steel")
    mb.prism(geom.circle(3.0, 24), "XZ", 70.5, 73.5, "steel", smooth=True)
    cx, cz = re * math.cos(math.radians(psi)), re * math.sin(math.radians(psi))
    mb.prism([(u + cx, w + cz) for u, w in geom.circle(rpin, 20)], "XZ", py0, py1, "steel_dark", smooth=True)
    wheel = mb.build("pi.sum_wheel.0", col, (0, 0, zs))
    bl.set_anchors(wheel, "glyph_anchors", disc_glyphs)
    bl.set_anchors(wheel, "gear_center", [(0.0, y_gear, 0.0)])
    bl.set_motion(wheel, "rotate", (0, 1, 0), "Result wheel with digit disc and Einzahn", "Zählrad mit Ziffernscheibe und Einzahn")
    bl.parent(wheel, root)

    # ---------------------------------------------------------------- carry store (rotates)
    C = "geometry.carry_store."
    hl, hw = p.v(C + "horn_length"), p.v(C + "horn_width")
    hy0, hy1 = p.v(C + "horn_y")
    h_rest = math.degrees(math.atan2(-Fz, -Fx))
    mb = MeshBuilder()
    mb.prism(geom.circle(1.5, 16), "XZ", 73.8, 104.0, "steel", smooth=True)
    mb.prism(geom.circle(3.0, 24), "XZ", hy0, hy1, "brass_polished", smooth=True)
    for j in range(5):
        mb.prism(geom.capsule(hl, hw / 2.0, h_rest + 72.0 * j), "XZ", hy0, hy1, "brass_polished")
    mb.prism(geom.scalloped_wheel(8.5, 5, 2.6, 2.2, h_rest + 18.0), "XZ", 82.0, 85.0, "brass_satin")  # Muldenrad
    mb.prism(geom.regular_polygon(p.v(C + "pentagon_circumradius"), 5, 54.0),
             "XZ", *p.v(C + "pentagon_y"), "steel")
    store = mb.build("pi.carry_store.0", col, (xf, 0, zf))
    pr, (pa, pb) = p.v(C + "pentagon_circumradius"), p.v(C + "pentagon_y")
    bl.set_anchors(store, "pentagon_corners",
                   [(u, pb, w) for u, w in geom.regular_polygon(pr, 5, 54.0)])
    bl.set_motion(store, "rotate", (0, 1, 0), "Carry store: Fünfhorn and pentagon indicator", "Übertragsspeicher: Fünfhorn und Pentagonscheibe")
    bl.parent(store, root)

    # ---------------------------------------------------------------- reading window (static)
    zw = zs + rd + 2.0
    mb = MeshBuilder()
    for r in (geom.rect(-20, 58, 20, 62.5), geom.rect(-20, 69.5, 20, 74),
              geom.rect(-20, 62.5, -5, 69.5), geom.rect(5, 62.5, 20, 69.5)):
        mb.prism(r, "XY", zw, zw + 1.5, "brass_satin")
    mb.prism(geom.rect(17, 58, 20, 74), "XY", 4.0, zw, "brass_satin")                     # post (beyond the disc)
    window = mb.build("pi.window.0", col)
    bl.set_anchors(window, "read_point", [(0.0, 66.0, zw + 3.0)])
    window["read_half_size_mm"] = [4.0, 2.5]
    window["motion"] = "static"
    bl.parent(window, root)

    # ---------------------------------------------------------------- frame (static)
    mb = MeshBuilder()
    mb.prism(geom.rect(-50, -88, 45, 108), "XY", 0.0, 4.0, "oak")
    mb.prism(geom.rect(-4, -66.5, 4, -62.5), "XY", 4.0, zd, "brass_satin")                 # drum shaft posts
    mb.prism(geom.circle(5, 24), "XZ", -66.5, -62.5, "brass_satin", smooth=True, offset=(0, 0, zd))
    mb.prism(geom.rect(-4, 74.0, 4, 78.0), "XY", 4.0, zd, "brass_satin")
    mb.prism(geom.circle(5, 24), "XZ", 74.0, 78.0, "brass_satin", smooth=True, offset=(0, 0, zd))
    mb.prism(geom.rect(-45, 10, -39, 13), "XY", 4.0, zs + 4.5, "brass_satin")              # front bracket for result shaft
    mb.prism(geom.rect(-45, zs - 4.5, 4, zs + 4.5), "XZ", 10.0, 13.0, "brass_satin")
    mb.prism(geom.rect(-45, 4.0, 8, zf + 6.0), "XZ", 96.0, 99.0, "brass_satin")             # rear bracket
    mb.prism(geom.circle(4.5, 24), "XY", 4.0, 8.0, "brass_satin", smooth=True, offset=(px, py, 0))  # pinion foot
    mb.prism(geom.rect(px + 12.0, py - 2.0, px + 16.0, py + 2.0), "XY", 4.0, z_plate, "brass_satin")  # plate post
    frame = mb.build("frame.static", col)
    frame["motion"] = "static"
    bl.parent(frame, root)

    root["machine"] = "leibniz-stepped-reckoner"
    root["milestone"] = "M0 one-digit slice"
    root["params_version"] = p.raw.get("version", "")
    return {
        "root": root, "shaft": shaft, "drum": drum, "rack": rack, "dial": dial, "plate": plate,
        "wheel": wheel, "store": store, "window": window, "frame": frame,
    }


def export(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_extras=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        **bl.EXPORT_IMAGES,
    )


def _args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out, blend = DEFAULT_OUT, None
    for i, a in enumerate(argv):
        if a == "--out":
            out = argv[i + 1]
        if a == "--blend":
            blend = argv[i + 1]
    return out, blend


if __name__ == "__main__":
    out, blend = _args()
    objs = build(params.load())
    export(out)
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=blend)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
    print(f"M0_BUILD_OK out={out} objects={len(bpy.data.objects)} triangles~{tris}")
