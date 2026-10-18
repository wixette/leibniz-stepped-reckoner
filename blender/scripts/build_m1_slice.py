"""M1: three-digit carry slice of the Leibniz stepped reckoner, built from params.

Run headless:
  Blender --background --factory-startup --python build_m1_slice.py -- [--out PATH] [--blend PATH]

Per digit i (x = -digit_pitch * i, digit 0 = units on the right):
  pm.drum_shaft.i     square shaft + drive gear (+ handwheel on digit 0)   rotate about +Y: theta
    pm.drum.i         stepped drum                                         translate along +Y: setting
  pm.setting_rack.i, pm.setting_dial.i, pm.setting_plate.i                 as in M0
  pi.sum_wheel.i      result shaft, receiving gear, digit disc, Einzahn,
                      star (i >= 1, receives carries from store i-1)       rotate about +Y
  pi.carry_store.i    store shaft, Einzahn horns, Muldenrad teeth,
                      Fünfhorn, pentagon                                   rotate about +Y
  pm.lever.i          lever shaft, drive gear, Zweihorn hub                rotate about +Y: -theta
  pm.zweihorn_add.i   Zweihorn horn used when adding  (arm + pin)          rotate about +Y (runtime phase)
  pm.zweihorn_sub.i   Zweihorn horn used when subtracting                  rotate about +Y (runtime phase)
Shared: pi.window (static), frame.static.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from lib import bl, geom, params  # noqa: E402
from lib.bl import MeshBuilder  # noqa: E402

DEFAULT_OUT = os.path.join(params.MACHINE_DIR, "assets", "m1-carry-slice.glb")


def ang(dx, dz):
    return math.degrees(math.atan2(dz, dx))


def mesh_phase(teeth1_first, z1, c1, c2, z2):
    """First tooth angle of gear 2 so it meshes with gear 1 (both angles in their own frames).

    If gear 1's nearest tooth sits delta CCW from the line c1->c2, gear 2's gap sits
    delta CW from the line c2->c1 (rolling contact); gear 2's teeth are half a pitch off its gaps."""
    p1, p2 = 360.0 / z1, 360.0 / z2
    b12 = ang(c2[0] - c1[0], c2[1] - c1[1])
    b21 = ang(c1[0] - c2[0], c1[1] - c2[1])
    delta = ((teeth1_first - b12 + p1 / 2) % p1) - p1 / 2
    gap2 = b21 - delta * (z1 / z2)
    return gap2 + p2 / 2


def build(p):
    bl.reset_scene()
    col = bpy.context.scene.collection
    root = bl.empty("lsr_m1", col)

    G, M1 = "geometry.", "geometry.m1."
    n = p.v(M1 + "digits")
    pitch_x = p.v("layout.digit_pitch")
    X = [-pitch_x * i for i in range(n)]
    zd = p.v(G + "drum.axis_z")
    L = p.v(G + "drum.length")
    step = p.v(G + "drum.rib_length_step")
    m = p.v(G + "drum.module")
    add, ded = p.v(G + "drum.tooth_addendum"), p.v(G + "drum.tooth_dedendum")
    drum_gear = geom.GearSpec(p.v(G + "drum.virtual_teeth"), m, p.v(G + "drum.rib_thickness_factor"), add, ded)
    rg = geom.GearSpec(p.v(G + "receiving_gear.teeth"), p.v(G + "receiving_gear.module"), 1.0, add, ded)
    zs = zd + drum_gear.rp + rg.rp
    y_gear = p.v(G + "receiving_gear.y")
    g_th = p.v(G + "receiving_gear.thickness")
    Fdx, Fdz = p.v(G + "carry_store.offset_xz")
    zf = zs + Fdz
    dxL, zL = p.v(M1 + "lever_axis_dx"), p.v(M1 + "lever_axis_z")
    F = [(x + Fdx, zf) for x in X]
    Lv = [(x + dxL, zL) for x in X]
    D = [(x, zd) for x in X]
    S = [(x, zs) for x in X]

    # Drive gears (equal): centre distance drum <-> lever.
    cdl = math.hypot(Lv[0][0] - D[0][0], Lv[0][1] - D[0][1])
    zg = p.v(M1 + "drive_gear_teeth")
    dg = geom.GearSpec(zg, cdl / zg)
    gy0, gy1 = p.v(M1 + "drive_gear_y")
    # Chain phases: drum0 -> lever0 -> drum1 -> lever1 -> ...
    drum_first, lever_first = [0.0] * n, [0.0] * n
    drum_first[0] = ang(Lv[0][0] - D[0][0], Lv[0][1] - D[0][1])
    for i in range(n):
        lever_first[i] = mesh_phase(drum_first[i], zg, D[i], Lv[i], zg)
        if i + 1 < n:
            drum_first[i + 1] = mesh_phase(lever_first[i], zg, Lv[i], D[i + 1], zg)

    # Muldenrad teeth and stars.
    t_add = p.v(M1 + "transfer_tooth_addendum")
    mr = geom.GearSpec(p.v(M1 + "muldenrad_virtual_teeth"), p.v(M1 + "muldenrad_module"), 1.0, t_add, ded)
    star = geom.GearSpec(p.v(M1 + "star_teeth"), p.v(M1 + "muldenrad_module"), 1.0, t_add, ded)
    cross = p.v(M1 + "muldenrad_crossing_store_angle")
    planes = p.v(M1 + "muldenrad_y_planes")

    sq = 3.0
    first = p.v(G + "drum.rib_first_angle")
    rib_pitch = p.v("pars_mobilis.drum.rib_pitch")
    x_pl = p.v(G + "setting.rack_pitch_line_x")
    pm_ = p.v(G + "setting.pinion_module")
    pin_g = geom.GearSpec(p.v(G + "setting.pinion_teeth"), pm_)
    py = p.v(G + "setting.pinion_y")
    z_plate = 108.0
    R = "geometry.result."
    rd = p.v(R + "disc_radius")
    dy0, dy1 = p.v(R + "disc_y")
    re, rpin = p.v(R + "einzahn_radius"), p.v(R + "einzahn_pin_radius")
    psi = p.v(R + "einzahn_angle")
    ey0, ey1 = p.v(R + "einzahn_pin_y")
    C = "geometry.carry_store."
    hl, hw = p.v(C + "horn_length"), p.v(C + "horn_width")
    hy0, hy1 = p.v(C + "horn_y")
    pr = p.v(C + "pentagon_circumradius")
    pa, pb = p.v(M1 + "pentagon_y")
    rs0, rs1 = p.v(M1 + "result_shaft_y")
    ss0, ss1 = p.v(M1 + "store_shaft_y")
    fy0, fy1 = p.v(M1 + "fuenfhorn_y")
    fh_len, fh_r, fh_hub = p.v(M1 + "fuenfhorn_horn_length"), p.v(M1 + "fuenfhorn_horn_radius"), p.v(M1 + "fuenfhorn_hub_radius")
    zw_y0, zw_y1 = p.v(M1 + "zweihorn_arm_y")
    zp_y0, zp_y1 = p.v(M1 + "zweihorn_pin_y")
    zR, zpr, zaw = p.v(M1 + "zweihorn_pin_path_radius"), p.v(M1 + "zweihorn_pin_radius"), p.v(M1 + "zweihorn_arm_width")
    wall0, wall1 = p.v(M1 + "rear_wall_y")

    objs = {"root": root}
    for i in range(n):
        x = X[i]
        # ------------------------------------------------ drum shaft + drive gear (+ handwheel)
        mb = MeshBuilder()
        # The square part only has to carry the drum (front >= -18, flange -22); it stays
        # behind the setting pinion of digit i + 1 (10.6 mm to the left, y <= py + 7.6).
        # Shaft 0 carries the handwheel: it reaches the front as a round shaft (r 3) that
        # clears that pinion.
        sq_front = p.v(G + "setting.pinion_y") + 7.9
        mb.prism(geom.rect(-sq, -sq, sq, sq), "XZ", sq_front, gy1, "steel")
        if i == 0:
            mb.prism(geom.circle(sq, 24), "XZ", -76.0, sq_front + 0.01, "steel", smooth=True)
            mb.prism(geom.circle(14, 48), "XZ", -73.5, -70.5, "brass_satin", smooth=True)
            mb.prism(geom.circle(4.5, 24), "XZ", -70.5, -66.5, "brass_satin", smooth=True)
            mb.prism([(u, w + 11.0) for u, w in geom.circle(1.6, 16)], "XZ", -85, -73.5, "steel_dark", smooth=True)
        mb.prism(geom.gear_outline(dg, drum_first[i]), "XZ", gy0, gy1, "brass_satin")
        mb.prism(geom.circle(3.5, 24), "XZ", gy0 - 1.0, gy0, "brass_satin", smooth=True)
        shaft = mb.build(f"pm.drum_shaft.{i}", col, (x, 0, zd))
        bl.set_motion(shaft, "rotate", (0, 1, 0), f"Drum shaft {i} with drive gear", f"Staffelwalzenwelle {i} mit Antriebsrad")
        bl.parent(shaft, root)

        # ------------------------------------------------ stepped drum
        mb = MeshBuilder()
        mb.prism(geom.circle(drum_gear.rf, 64), "XZ", 0, L, "brass_polished", smooth=True)
        mb.prism(geom.circle(sq + 0.4, 4, 45), "XZ", -0.01, L + 0.01, "steel_dark")
        for k in range(1, 10):
            tooth = geom.tooth_polygon(drum_gear, first + (k - 1) * rib_pitch, root_r=drum_gear.rf - 0.3)
            mb.prism(tooth, "XZ", L - k * step, L, "brass_polished")
        mb.prism(geom.circle(9.0, 40), "XZ", -4.0, -3.0, "brass_satin", smooth=True)
        mb.prism(geom.circle(7.0, 40), "XZ", -3.0, -1.0, "brass_satin", smooth=True)
        mb.prism(geom.circle(9.0, 40), "XZ", -1.0, 0.0, "brass_satin", smooth=True)
        drum = mb.build(f"pm.drum.{i}", col, (x, 0, zd))
        drum["core_radius_mm"] = drum_gear.rf
        drum["rib_tip_radius_mm"] = drum_gear.ra
        bl.set_motion(drum, "translate", (0, 1, 0), f"Stepped drum {i}", f"Staffelwalze {i}", unit="mm")
        bl.parent(drum, shaft)

        # ------------------------------------------------ setting rack, dial, plate
        mb = MeshBuilder()
        for poly in geom.rack_teeth(x_pl, pm_, [-2.0 - 4.0 * j for j in range(13)], back_u=x_pl - 5.0):
            mb.prism(poly, "XY", -4.0, 4.0, "steel")
        mb.prism(geom.rect(7.2, -2.7, x_pl - 4.0, -1.3), "XY", -2.5, 2.5, "steel")
        rack = mb.build(f"pm.setting_rack.{i}", col, (x, 0, zd))
        bl.set_motion(rack, "translate", (0, 1, 0), f"Setting rack {i}", f"Einstellzahnstange {i}", unit="mm")
        bl.parent(rack, root)

        px = x + x_pl + pin_g.rp
        mb = MeshBuilder()
        mb.prism(geom.gear_outline(pin_g, 0.0), "XY", zd - 4.0, zd + 4.0, "brass_polished")
        mb.prism(geom.circle(1.5, 16), "XY", 6.0, z_plate + 10.0, "steel", smooth=True)
        mb.prism(geom.circle(5.0, 32), "XY", z_plate + 2.0, z_plate + 4.0, "brass_satin", smooth=True)
        pointer_len = 8.5
        mb.prism(geom.radial_bar(0, pointer_len, 2.2, -90.0), "XY", z_plate + 2.0, z_plate + 3.2, "steel_dark")
        mb.prism(geom.rect(-1.5, -4.0, 1.5, 4.0), "XY", z_plate + 4.0, z_plate + 12.0, "brass_polished")
        dial = mb.build(f"pm.setting_dial.{i}", col, (px, py, 0))
        bl.set_anchors(dial, "pointer_tip", [(0.0, -pointer_len, z_plate + 2.6)])
        bl.set_motion(dial, "rotate", (0, 0, 1), f"Setting knob {i}", f"Stellgriff {i}")
        bl.parent(dial, root)

        mb = MeshBuilder()
        mb.prism(geom.circle(17.0, 48), "XY", z_plate, z_plate + 2.0, "brass_satin", smooth=True)
        glyphs = []
        for s in range(10):
            a = math.radians(-90.0 + 36.0 * s)
            cx, cy = 12.8 * math.cos(a), 12.8 * math.sin(a)
            glyphs.append((cx, cy, z_plate + 2.25))
            verts, faces = bl.glyph_mesh(str(s), 3.8, 0.3)
            mb.add_mesh_data(verts, faces, bl.frame_matrix((cx, cy, z_plate + 2.1), (1, 0, 0), (0, 1, 0)), "ink_black")
        plate = mb.build(f"pm.setting_plate.{i}", col, (px, py, 0))
        bl.set_anchors(plate, "glyph_anchors", glyphs)
        plate["motion"] = "static"
        bl.parent(plate, root)

        # ------------------------------------------------ result wheel (+ star for carry-in)
        mb = MeshBuilder()
        mb.prism(geom.circle(1.5, 16), "XZ", rs0, rs1, "steel", smooth=True)
        mb.prism(geom.gear_outline(rg, 18.0), "XZ", y_gear - g_th / 2, y_gear + g_th / 2, "brass_polished")
        mb.prism(geom.circle(3.0, 24), "XZ", y_gear - g_th / 2 - 2, y_gear + g_th / 2 + 2, "brass_satin", smooth=True)
        mb.prism(geom.circle(rd, 72), "XZ", dy0, dy1, "enamel_white", smooth=True)
        mb.prism(geom.circle(rd + 0.6, 72), "XZ", dy0 - 0.8, dy0, "brass_polished", smooth=True)
        mb.prism(geom.circle(rd + 0.6, 72), "XZ", dy1, dy1 + 0.8, "brass_polished", smooth=True)
        disc_glyphs = []
        for d in range(10):
            a = math.radians(90.0 - 36.0 * d)
            nrm = (math.cos(a), 0.0, math.sin(a))
            tan = (math.sin(a), 0.0, -math.cos(a))
            o = (nrm[0] * (rd + 0.12), (dy0 + dy1) / 2.0, nrm[2] * (rd + 0.12))
            disc_glyphs.append(o)
            verts, faces = bl.glyph_mesh(str(d), 6.2, 0.25)
            mb.add_mesh_data(verts, faces, bl.frame_matrix(o, tan, (0, 1, 0)), "ink_black")
        mb.prism(geom.radial_bar(0.0, re, 3.0, psi), "XZ", 70.8, 73.5, "steel")
        mb.prism(geom.circle(3.0, 24), "XZ", 70.5, 73.5, "steel", smooth=True)
        ex, ez = re * math.cos(math.radians(psi)), re * math.sin(math.radians(psi))
        mb.prism([(u + ex, w + ez) for u, w in geom.circle(rpin, 20)], "XZ", ey0, ey1, "steel_dark", smooth=True)
        if i >= 1:
            # Star receives carries from the Muldenrad of store i-1; tooth centres at the
            # direction towards that store (+36 k), so a gap faces it mid-crossing.
            b_sf = ang(F[i - 1][0] - S[i][0], F[i - 1][1] - S[i][1])
            sy0, sy1 = planes[(i - 1) % 2]
            mb.prism(geom.gear_outline(star, b_sf), "XZ", sy0, sy1, "brass_polished")
            mb.prism(geom.circle(2.5, 24), "XZ", sy0 - 0.5, sy1 + 0.5, "brass_satin", smooth=True)
        wheel = mb.build(f"pi.sum_wheel.{i}", col, (x, 0, zs))
        bl.set_anchors(wheel, "glyph_anchors", disc_glyphs)
        bl.set_anchors(wheel, "gear_center", [(0.0, y_gear, 0.0)])
        bl.set_motion(wheel, "rotate", (0, 1, 0), f"Result wheel {i}", f"Zählrad {i}")
        bl.parent(wheel, root)

        # ------------------------------------------------ carry store
        fx, fz = F[i]
        h_rest = ang(S[i][0] - fx, S[i][1] - fz)            # Einzahn horns point at the result shaft
        b_fl = ang(Lv[i][0] - fx, Lv[i][1] - fz)            # Fünfhorn rest: bisected by store -> lever
        b_fs = ang(x - pitch_x - fx, zs - fz)               # Muldenrad teeth: towards the next result shaft
        mb = MeshBuilder()
        mb.prism(geom.circle(1.5, 16), "XZ", ss0, ss1, "steel", smooth=True)
        mb.prism(geom.circle(3.0, 24), "XZ", hy0, hy1, "brass_polished", smooth=True)
        for j in range(5):
            mb.prism(geom.capsule(hl, hw / 2.0, h_rest + 72.0 * j), "XZ", hy0, hy1, "brass_polished")
        my0, my1 = planes[i % 2]
        mb.prism(geom.circle(mr.rf, 72), "XZ", my0, my1, "brass_satin", smooth=True)
        for j in range(5):
            mb.prism(geom.tooth_polygon(mr, b_fs + cross + 72.0 * j, root_r=mr.rf - 0.3), "XZ", my0, my1, "brass_satin")
        mb.prism(geom.circle(fh_hub, 24), "XZ", fy0, fy1, "brass_polished", smooth=True)
        for j in range(5):
            mb.prism(geom.capsule(fh_len, fh_r, b_fl + 36.0 + 72.0 * j), "XZ", fy0, fy1, "brass_polished")
        mb.prism(geom.regular_polygon(pr, 5, 54.0), "XZ", pa, pb, "steel")
        store = mb.build(f"pi.carry_store.{i}", col, (fx, 0, fz))
        bl.set_anchors(store, "pentagon_corners", [(u, pb, w) for u, w in geom.regular_polygon(pr, 5, 54.0)])
        bl.set_motion(store, "rotate", (0, 1, 0), f"Carry store {i}: Fünfhorn, Muldenrad, pentagon",
                      f"Übertragsspeicher {i}: Fünfhorn, Muldenrad, Pentagon")
        bl.parent(store, root)

        # ------------------------------------------------ lever (drive gear + Zweihorn hub) and the two horns
        lx, lz = Lv[i]
        mb = MeshBuilder()
        mb.prism(geom.circle(1.5, 16), "XZ", gy0 - 0.5, wall0 + 1.5, "steel", smooth=True)
        mb.prism(geom.gear_outline(dg, lever_first[i]), "XZ", gy0, gy1, "brass_satin")
        mb.prism(geom.circle(3.4, 24), "XZ", zw_y0, zw_y1, "steel", smooth=True)
        lever = mb.build(f"pm.lever.{i}", col, (lx, 0, lz))
        bl.set_motion(lever, "rotate", (0, 1, 0), f"Carry lever shaft {i} (turns against the drums)",
                      f"Zweihornwelle {i} (gegenläufig zu den Walzen)")
        bl.parent(lever, root)
        for kind, label_en, label_de in (("add", "Zweihorn: adding horn", "Zweihorn: Additionshorn"),
                                         ("sub", "Zweihorn: subtracting horn", "Zweihorn: Subtraktionshorn")):
            mb = MeshBuilder()
            mb.prism(geom.radial_bar(3.6, zR, zaw, 0.0), "XZ", zw_y0, zw_y1, "steel_dark")
            mb.prism([(u + zR, w) for u, w in geom.circle(zpr, 20)], "XZ", zp_y0, zw_y1, "steel_dark", smooth=True)
            horn = mb.build(f"pm.zweihorn_{kind}.{i}", col, (lx, 0, lz))
            bl.set_motion(horn, "rotate", (0, 1, 0), f"{label_en} {i}", f"{label_de} {i}")
            bl.parent(horn, root)
        objs.update({f"shaft{i}": shaft, f"drum{i}": drum, f"rack{i}": rack, f"dial{i}": dial, f"plate{i}": plate,
                     f"wheel{i}": wheel, f"store{i}": store, f"lever{i}": lever})

    # ---------------------------------------------------- reading window (one plate, n openings)
    zw = zs + rd + 2.0
    wy0, wy1 = p.v(M1 + "window_y")
    xl, xr = X[-1] - 20.0, X[0] + 20.0
    mb = MeshBuilder()
    mb.prism(geom.rect(xl, wy0, xr, 62.5), "XY", zw, zw + 1.5, "brass_satin")
    mb.prism(geom.rect(xl, 69.5, xr, wy1), "XY", zw, zw + 1.5, "brass_satin")
    edges = [xl] + [v for x in reversed(X) for v in (x - 5.0, x + 5.0)] + [xr]
    for a, b in zip(edges[0::2], edges[1::2]):
        mb.prism(geom.rect(a, 62.5, b, 69.5), "XY", zw, zw + 1.5, "brass_satin")
    mb.prism(geom.rect(xr - 3, wy0, xr, wy1), "XY", 4.0, zw, "brass_satin")
    mb.prism(geom.rect(xl, wy0, xl + 3, wy1), "XY", 4.0, zw, "brass_satin")
    window = mb.build("pi.window", col)
    bl.set_anchors(window, "read_points", [(x, 66.0, zw + 3.0) for x in X])
    window["read_half_size_mm"] = [4.0, 2.5]
    window["motion"] = "static"
    bl.parent(window, root)

    # ---------------------------------------------------- frame
    x0, x1 = X[-1] - 50.0, X[0] + 50.0
    mb = MeshBuilder()
    mb.prism(geom.rect(x0, -88, x1, 110), "XY", 0.0, 4.0, "oak")
    for i, x in enumerate(X):
        if i == 0:  # front bearing only for the handwheel shaft
            mb.prism(geom.rect(x - 4, -66.5, x + 4, -62.5), "XY", 4.0, zd, "brass_satin")
            mb.prism(geom.circle(5, 24), "XZ", -66.5, -62.5, "brass_satin", smooth=True, offset=(x, 0, zd))
        mb.prism(geom.rect(x - 4, 74.0, x + 4, 78.0), "XY", 4.0, zd, "brass_satin")
        mb.prism(geom.circle(5, 24), "XZ", 74.0, 78.0, "brass_satin", smooth=True, offset=(x, 0, zd))
        px = x + x_pl + pin_g.rp
        mb.prism(geom.circle(4.5, 24), "XY", 4.0, 8.0, "brass_satin", smooth=True, offset=(px, py, 0))
        mb.prism(geom.rect(px - 2.0, py - 16.0, px + 2.0, py - 12.0), "XY", 4.0, z_plate, "brass_satin")
    mb.prism(geom.rect(X[-1] - 45, zs - 4.5, X[0] + 45, zs + 4.5), "XZ", 10.0, 13.0, "brass_satin")   # front bar
    mb.prism(geom.rect(X[-1] - 45, 10.0, X[-1] - 41, 13.0), "XY", 4.0, zs - 4.5, "brass_satin")
    mb.prism(geom.rect(X[0] + 41, 10.0, X[0] + 45, 13.0), "XY", 4.0, zs - 4.5, "brass_satin")
    mb.prism(geom.rect(X[-1] - 45, 4.0, X[0] + 45, 85.0), "XZ", wall0, wall1, "brass_satin")            # rear wall
    frame = mb.build("frame.static", col)
    frame["motion"] = "static"
    bl.parent(frame, root)

    root["machine"] = "leibniz-stepped-reckoner"
    root["milestone"] = "M1 three-digit carry slice"
    root["digits"] = n
    root["params_version"] = p.raw.get("version", "")
    objs.update({"window": window, "frame": frame})
    return objs


def export(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_extras=True,
                              export_apply=True, export_cameras=False, export_lights=False, **bl.EXPORT_IMAGES)


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
    build(params.load())
    export(out)
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=blend)
    tris = sum(sum(len(f.vertices) - 2 for f in o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
    print(f"M1_BUILD_OK out={out} objects={len(bpy.data.objects)} triangles~{tris}")
