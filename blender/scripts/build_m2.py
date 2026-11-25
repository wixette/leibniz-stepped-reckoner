"""M2: the full Leibniz stepped reckoner (16-digit register, 8-digit carriage).

Run headless:
  Blender --background --factory-startup --python build_m2.py -- [--out PATH] [--blend PATH]

Register (fixed), digit k at x = -36.5 k:
  pi.sum_wheel.k     result shaft, receiving gear, digit disc, Einzahn, small ten-wheel (k >= 1)
  pi.carry_store.k   intermediate shaft half-way to the next result shaft: five-horn p (pushed by
                     the Einzahn, turning the next ten-wheel), detent wheel, five-horn s (struck by
                     the Zweihorn), pentagon. The carry parts are the original's (BADUR2026, lib/carry.py)
  pi.window          16 reading windows (static)
  frame.static       brass frame: side walls 610 apart, rear wall, front bar, brackets (static)
  frame.lead_screw   36.5 mm lead screw + end crank outside the case (rotate about +X)
Carriage pm.carriage (translate along +X), carriage digit j at x = -36.5 j (offset 0):
  pm.carriage_panel  front panel (static; hideable for a cut-away view)
  pm.drum_shaft.j / pm.drum.j / pm.setting_rack.j / pm.setting_dial.j / pm.setting_plate.j / pm.setting_stop.j
  pm.lever.j / pm.zweihorn_add.j / pm.zweihorn_sub.j
  Front to back (Abb. II 9): large gears, the bearing bar, the drum axes' heads (pm.setting_rack.j:
  a sleeve with the rack teeth on an upright wall, meshing the knob's pinion), the drive row
  (17 gears: each drum's gear slides with the drum along the long gear on the lever shaft to
  its left), the drums; pm.counter_shaft, the 17th, half a place right of the units drum, will
  drive the revolution counter (its train is not modelled yet).
  pm.large_gear_a / _b / _c: B on drum 4's shaft (the crank's axis), A and C on levers 6 and 1
  pm.magna_rota (rotate about +Y, with the crank), pm.counter_plate (static), pm.counter_ring and
  pm.counter_pin (rotate about +Z), pm.counter_pin_park (static),
  pm.main_crank (rotate about +Y, 360 deg per turn; sits in the middle of the Magna Rota)
Casing (all static; the page hides them together to show the mechanism):
  frame.base             oak base board and the two bearers under it (woodwork, hidden with the case)
  frame.case             oak case: floor, rear and end walls, low front wall
  frame.register_cover   brass top plate over the register, openings over the 16 windows
  pm.carriage_cover      brass top plates and end walls of the carriage, counter dial plate (moves with it)
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from lib import bl, carry, geom, kinematics, params  # noqa: E402
from lib.bl import MeshBuilder  # noqa: E402

DEFAULT_OUT = os.path.join(params.MACHINE_DIR, "assets", "m2-full-machine.glb")


def ang(dx, dz):
    return math.degrees(math.atan2(dz, dx))


def mesh_phase(teeth1_first, z1, c1, c2, z2):
    p1, p2 = 360.0 / z1, 360.0 / z2
    b12 = ang(c2[0] - c1[0], c2[1] - c1[1])
    b21 = ang(c1[0] - c2[0], c1[1] - c2[1])
    delta = ((teeth1_first - b12 + p1 / 2) % p1) - p1 / 2
    return b21 - delta * (z1 / z2) + p2 / 2


def annulus_half(r_out, r_in, start_deg, n=48):
    """Half an annulus as one simple polygon (two halves make a ring with a hole)."""
    a = [math.radians(start_deg + 180.0 * i / n) for i in range(n + 1)]
    return [(r_out * math.cos(t), r_out * math.sin(t)) for t in a] + [(r_in * math.cos(t), r_in * math.sin(t)) for t in reversed(a)]


def plate_with_hole_row(mb, x0, y0, x1, y1, hy0, hy1, holes, z0, z1, mat):
    """Flat plate (XY, z0..z1) with a row of rectangular holes (x ranges) in the band hy0..hy1."""
    mb.prism(geom.rect(x0, y0, x1, hy0), "XY", z0, z1, mat)
    mb.prism(geom.rect(x0, hy1, x1, y1), "XY", z0, z1, mat)
    edges = [x0] + [v for a, b in sorted(holes) for v in (a, b)] + [x1]
    for a, b in zip(edges[0::2], edges[1::2]):
        if b > a:
            mb.prism(geom.rect(a, hy0, b, hy1), "XY", z0, z1, mat)


def static(obj):
    obj["motion"] = "static"
    return obj


def build(p):
    bl.reset_scene()
    col = bpy.context.scene.collection
    root = bl.empty("lsr_m2", col)

    G, M1, M2 = "geometry.", "geometry.m1.", "geometry.m2."
    R, C = p.v(M2 + "register_digits"), p.v(M2 + "carriage_digits")
    pitch_x = p.v("layout.digit_pitch")
    X = [-pitch_x * k for k in range(R)]
    zd = p.v(G + "drum.axis_z")
    L = p.v(G + "drum.length")
    step = p.v(G + "drum.rib_length_step")
    add, ded = p.v(G + "drum.tooth_addendum"), p.v(G + "drum.tooth_dedendum")
    drum_gear = geom.GearSpec(p.v(G + "drum.virtual_teeth"), p.v(G + "drum.module"), p.v(G + "drum.rib_thickness_factor"), add, ded)
    RG = G + "receiving_gear."
    rg = geom.GearSpec(p.v(RG + "teeth"), p.v(RG + "module"), 1.0, p.v(RG + "addendum"), p.v(RG + "dedendum"),
                       p.v(RG + "profile_shift"))
    zs = zd + p.v(RG + "centre_distance")
    kin = kinematics.Kin(p)
    y_gear, g_th = p.v(G + "receiving_gear.y"), p.v(G + "receiving_gear.thickness")
    Fdx, Fdz = p.v(G + "carry_store.offset_xz")
    zf = zs + Fdz
    dxL, zL = p.v(M1 + "lever_axis_dx"), p.v(M1 + "lever_axis_z")
    F = [(x + Fdx, zf) for x in X]
    S = [(x, zs) for x in X]

    # the carry of the original (BADUR2026; lib/carry.py, design/v1.3-notes.md)
    cg = p.v(G + "carry")
    cp = p.v(M2 + "carry_planes")
    pair, ov = cp["pair"], cp["mesh_overhang"]
    dl = p.v(M2 + "digit_labels")  # enlarged for teaching (see params: not a documented size)
    dy0, dy1 = dl["result_disc_y"]
    rd = dl["result_disc_r"]                    # the disc, without its rim
    rim_dr, rim_t = dl["result_rim"]
    pent = p.v(M2 + "pentagon")  # the original's size, in two staggered rows (even digits in front)
    pr = pent["circumradius"]
    wall0, wall1 = p.v(M2 + "rear_wall_y")
    dr = p.v(M2 + "drive_row")
    gy0, gy1 = dr["long_gear_y"]

    # =========================================================== register (fixed)
    for k in range(R):
        x = X[k]
        mb = MeshBuilder()
        mb.prism(geom.circle(1.5, 16), "XZ", dy0 - rim_t - 0.5, wall0 + 1.5, "steel", smooth=True)   # the disc at its front end
        mb.prism(geom.gear_outline(rg, 18.0), "XZ", y_gear - g_th / 2, y_gear + g_th / 2, "brass_polished")
        mb.prism(geom.circle(3.0, 24), "XZ", y_gear - g_th / 2 - 2, y_gear + g_th / 2 + 2, "brass_satin", smooth=True)
        # the result disc, a dish (BADUR2026 Pos. 32): the rim ring (digits on its outer face),
        # open to the front round the hub, a thin face plate at its back
        dish = dl["result_dish"]
        r_out = rd + rim_dr
        mb.prism_holes(geom.circle(r_out, 96), [geom.circle(dish["recess_r"], 96)], "XZ", dy0, dy1, "brass_polished")
        mb.prism(geom.circle(dish["recess_r"] + 0.05, 96), "XZ", dy1 - dish["face"], dy1 - 0.05, "brass_satin", smooth=True)
        mb.prism(geom.circle(dish["hub_r"], 32), "XZ", dy0 + 0.5, dy1 - dish["face"], "brass_satin", smooth=True)
        glyphs = []
        for d in range(10):
            a = math.radians(90.0 - 36.0 * d)
            nrm, tan = (math.cos(a), 0.0, math.sin(a)), (math.sin(a), 0.0, -math.cos(a))
            o = (nrm[0] * (r_out + 0.12), (dy0 + dy1) / 2.0, nrm[2] * (r_out + 0.12))
            glyphs.append(o)
            verts, faces = bl.glyph_mesh(str(d), dl["result_glyph_size"], 0.25)
            mb.add_mesh_data(verts, faces, bl.frame_matrix(o, tan, (0, 1, 0)), "ink_black")
        # the Einzahn (one pointed tooth on a ring) in the plane of its own store's five-horn p,
        # and the small ten-wheel in the plane of the store below (k - 1), which turns it
        ea, eb = pair[k % 2]
        mb.prism(carry.einzahn(p, cg["einzahn"]["tooth_local"]), "XZ", ea - ov, eb + ov, "brass_polished")
        if k >= 1:
            ta, tb = pair[(k - 1) % 2]
            mb.prism(carry.ten_wheel(p, cg["ten_wheel"]["first_tooth"]), "XZ", ta - ov, tb + ov, "brass_polished")
            mb.prism(geom.circle(3.0, 24), "XZ", tb + ov, tb + ov + 1.0, "brass_satin", smooth=True)
        wheel = mb.build(f"pi.sum_wheel.{k}", col, (x, 0, zs))
        bl.set_anchors(wheel, "glyph_anchors", glyphs)
        bl.set_anchors(wheel, "gear_center", [(0.0, y_gear, 0.0)])
        bl.set_motion(wheel, "rotate", (0, 1, 0), f"Result wheel {k}", f"Zählrad {k}")
        bl.parent(wheel, root)

        pa, pb = pent["y_rows"][k % 2]
        fx, fz = F[k]
        # the intermediate shaft: the five-horn p (pushed by the Einzahn, turning the next
        # ten-wheel), the detent wheel, the five-horn s (struck by the Zweihorn), the pentagon
        mb = MeshBuilder()
        mb.prism(geom.circle(1.5, 16), "XZ", cp["store_shaft_front"], pb + 1.0, "steel", smooth=True)
        qa, qb = pair[k % 2]
        hub = cg["five_horn"]["hub_radius"]
        mb.prism(carry.five_horn(p, cg["p_phase"]), "XZ", qa, qb, "brass_polished")
        mb.prism(geom.circle(hub, 32), "XZ", qa - 0.8, qb + 1.0, "brass_satin", smooth=True)
        da, db = cp["detent"]
        mb.prism(carry.detent_wheel(p, 90.0), "XZ", da, db, "brass_satin")
        sa, sb = cp["s"]
        mb.prism(carry.five_horn(p, cg["s_phase"]), "XZ", sa, sb, "brass_polished")
        mb.prism(geom.circle(hub, 32), "XZ", sb, sb + 1.0, "brass_satin", smooth=True)
        mb.prism(geom.regular_polygon(pr, 5, 54.0), "XZ", pa, pb, "steel")
        store = mb.build(f"pi.carry_store.{k}", col, (fx, 0, fz))
        bl.set_anchors(store, "pentagon_corners", [(u, pb, w) for u, w in geom.regular_polygon(pr, 5, 54.0)])
        bl.set_motion(store, "rotate", (0, 1, 0), f"Carry store {k}", f"Übertragsspeicher {k}")
        bl.parent(store, root)

    # window plate (hung from the rear wall at both ends), between the frame's side walls
    fx_ = p.v(M2 + "frame_x")
    in_x0, in_x1 = X[-1] - fx_["inner_left"], X[0] + fx_["inner_right"]
    zw = zs + rd + 2.0
    xl, xr = in_x0, in_x1 - 3.0
    mb = MeshBuilder()
    (wy0, wy1), (ry0w, ry1w) = dl["window_y"], dl["window_rail_y"]
    mb.prism(geom.rect(xl, ry0w, xr, wy0), "XY", zw, zw + 1.5, "brass_satin")
    mb.prism(geom.rect(xl, wy1, xr, ry1w), "XY", zw, zw + 1.5, "brass_satin")
    whx = dl["window_half_x"]
    edges = [xl] + [v for x in reversed(X) for v in (x - whx, x + whx)] + [xr]
    for a, b in zip(edges[0::2], edges[1::2]):
        mb.prism(geom.rect(a, wy0, b, wy1), "XY", zw, zw + 1.5, "brass_satin")
    for bx in (xr - 3.0, xl):
        mb.prism(geom.rect(bx, ry1w, bx + 3.0, wall0), "XY", zw, zw + 1.5, "brass_satin")
    window = static(mb.build("pi.window", col))
    bl.set_anchors(window, "read_points", [(x, (wy0 + wy1) / 2.0, zw + 3.0) for x in X])
    window["read_half_size_mm"] = dl["read_half_size"]
    bl.parent(window, root)

    # frame: base (the replica's lower frame), side walls 610 apart, rear wall and front bar
    # between them; the lead screw runs in a notch in each wall's low front part
    ls = p.v(M2 + "lead_screw")
    fr = p.v(M2 + "frame")
    sw = fx_["side_wall"]
    base_x0, base_x1 = in_x0 - fx_["end_bar_left"], in_x1 + fx_["end_bar_right"]
    mb = MeshBuilder()
    mb.prism(geom.rect(in_x0, 4.0, in_x1, 85.0), "XZ", wall0, wall1, "brass_satin")
    mb.prism(geom.rect(in_x0, zs - 4.5, in_x1, zs + 4.5), "XZ", 10.0, 13.0, "brass_satin")
    for bx in (in_x0, in_x1 - 3.0):
        mb.prism(geom.rect(bx, 13.0, bx + 3.0, wall0), "XY", zs - 4.5, zs + 4.5, "brass_satin")
    ny0, ny1, nz = ls["y"] - ls["radius"] - 2.5, ls["y"] + ls["radius"] + 2.5, ls["z"] - ls["radius"] - 2.5
    ysp, zlow = fr["side_wall_y_split"], fr["side_wall_low_z"]
    for wx0 in (in_x0 - sw, in_x1):
        for r0 in (geom.rect(fr["y"][0], 4.0, ysp, nz), geom.rect(fr["y"][0], nz, ny0, zlow),
                   geom.rect(ny1, nz, ysp, zlow), geom.rect(ysp, 4.0, wall0, fr["side_wall_top_z"])):
            mb.prism(r0, "YZ", wx0, wx0 + sw, "brass_satin")
    # the detent springs of the intermediate shafts (assembly drawing, section N-O: a leaf with a
    # V tip over each detent wheel, from a stud on the register frame); drawn just clear of the
    # wheel's points (the model does not bend them)
    det = cg["detent"]
    tip_z = det["radius"] + det["spring_gap"]
    leaf = [(8.2, 11.9), (8.2, 12.9), (0.7, 11.9), (0.0, tip_z), (0.9, 11.3)]
    da, db = cp["detent"]
    fb = cp["frame_bar"]
    # the register frame's bar (BADUR2026 Zaehlwerkrahmen): the shafts pass through it, the
    # springs' studs stand in it
    mb.prism(geom.rect(in_x0, fb["z"][0], in_x1, fb["z"][1]), "XZ", fb["y"][0], fb["y"][1], "brass_satin")
    for fxk, fzk in F:
        mb.prism([(u + fxk, w + fzk) for u, w in leaf], "XZ", da + 0.5, db - 0.5, "steel")
        mb.prism([(u + fxk + 8.6, w + fzk + 12.4) for u, w in geom.circle(1.0, 16)], "XZ", da - 0.3, fb["y"][0] + 0.6, "brass_satin", smooth=True)
    frame = static(mb.build("frame.static", col))
    bl.parent(frame, root)

    # woodwork under the mechanism: the oak base board, and two oak bearers that lift it
    # off the case floor (so the carriage front hangs below the base). A separate node so
    # the page hides it with the case and leaves only the mechanism.
    cs = p.v(M2 + "casing")
    mb = MeshBuilder()
    mb.prism(geom.rect(base_x0, fr["y"][0], base_x1, fr["y"][1]), "XY", 0.0, 4.0, "oak")
    for a in (base_x0, base_x1 - cs["bearer_length"]):
        mb.prism(geom.rect(a, fr["y"][0] + 4.0, a + cs["bearer_length"], fr["y"][1] - 4.0), "XY", cs["floor_top_z"], 0.0, "oak")
    base = static(mb.build("frame.base", col))
    bl.parent(base, root)

    # lead screw with a helical ridge, and the end crank (left end, outside the case wall)
    sx0, sx1 = base_x0 + fr["screw_start_dx"], in_x1 + sw
    mb = MeshBuilder()
    mb.prism(geom.circle(ls["radius"], 24), "YZ", 0.0, sx1 - sx0, "steel", smooth=True)
    turns = (sx1 - sx0) / pitch_x
    nseg = int(turns * 16)
    for i in range(nseg):
        a = 2 * math.pi * i / 16
        xa = (sx1 - sx0) * i / nseg
        cy, cz = (ls["radius"] + 0.6) * math.cos(a), (ls["radius"] + 0.6) * math.sin(a)
        mb.prism(geom.rect(cy - 0.9, cz - 0.9, cy + 0.9, cz + 0.9), "YZ", xa, xa + (sx1 - sx0) / nseg + 0.3, "steel")
    # crank arm (along +Y) outside the case: its knob sweeps z 20 +- 55, above the case's underside (z -42)
    arm = 55.0
    mb.prism(geom.rect(-4.0, -2.5, arm + 4.0, 2.5), "YZ", -6.0, -3.0, "brass_satin")
    mb.prism(geom.circle(4.0, 20), "YZ", -6.0, 0.0, "brass_satin", smooth=True)
    mb.prism([(u + arm, w) for u, w in geom.circle(4.0, 20)], "YZ", -32.0, -6.0, "wood_dark", smooth=True)
    screw = mb.build("frame.lead_screw", col, (sx0, ls["y"], ls["z"]))
    bl.set_motion(screw, "rotate", (1, 0, 0), "Lead screw and end crank (shifts the carriage)",
                  "Schraube und Seitenkurbel (verschiebt den Schlitten)")
    bl.parent(screw, root)

    # =========================================================== carriage
    fl = p.v(M2 + "carriage_floor")
    cx0, cx1 = X[C - 1] - fl["x_margin_left"], X[0] + fl["x_margin_right"]
    cs_ = p.v(M2 + "carriage_counter_section")
    xt, zt = X[0] + cs_["top_dx"], cs_["top_z"]
    xs, xr, zn = X[0] + cs_["step_dx"], X[0] + cs_["end_dx"], cs_["step_z"]
    mb = MeshBuilder()
    mb.prism(geom.rect(cx0, fl["y"][0], cx1, fl["y"][1]), "XY", fl["z"][0], fl["z"][1], "brass_satin")
    # the carriage frame's front wall (Badur's sheet 9, 333 long): the bearing bar of the drive
    # row's 17 shafts and the crank's, standing on a post at its left end over the floor (its
    # right end passes over the frame's right side wall)
    by0, by1 = dr["bearing_bar_y"]
    bz0, bz1 = dr["bearing_bar_z"]
    bx0, bx1 = X[C - 1] - dr["bearing_bar_x_margins"][0], X[0] + dr["bearing_bar_x_margins"][1]
    mb.prism(geom.rect(bx0, bz0, bx1, bz1), "XZ", by0, by1, "brass_satin")
    mb.prism(geom.rect(bx0, fl["z"][1], bx0 + 4.0, bz0), "XZ", by0, by1, "brass_satin")
    # nut around the lead screw (four bars leave a square hole), between the units drum's and
    # the tens drum's setting heads
    nx0, nx1, ny, nz, hole = X[0] - 30.0, X[0] - 6.0, ls["y"], ls["z"], ls["radius"] + 2.0
    for r0 in (geom.rect(ny - hole - 4, nz - hole - 4, ny + hole + 4, nz - hole),
               geom.rect(ny - hole - 4, nz + hole, ny + hole + 4, nz + hole + 4),
               geom.rect(ny - hole - 4, nz - hole, ny - hole, nz + hole),
               geom.rect(ny + hole, nz - hole, ny + hole + 4, nz + hole)):
        mb.prism(r0, "YZ", nx0, nx1, "brass_satin")
    mb.prism(geom.rect(nx0, ny - hole - 4, nx1, ny + hole + 4), "XY", fl["z"][1], nz - hole - 4, "brass_satin")
    x_pl = p.v(G + "setting.rack_pitch_line_x")
    pm_ = p.v(G + "setting.pinion_module")
    pin_g = geom.GearSpec(p.v(G + "setting.pinion_teeth"), pm_)
    py = p.v(G + "setting.pinion_y")
    z_plate = p.v(M2 + "knob_plate_z")
    for j in range(C):
        x = X[j]
        rb0, rb1 = p.v(M2 + "carriage_rear")["bearing_y"]
        mb.prism(geom.rect(x - 4, rb0, x + 4, rb1), "XY", fl["z"][1], zd, "brass_satin")
        mb.prism(geom.circle(5, 24), "XZ", rb0, rb1, "brass_satin", smooth=True, offset=(x, 0, zd))
    carriage = mb.build("pm.carriage", col)
    bl.set_motion(carriage, "translate", (1, 0, 0), "Carriage (pars mobilis)", "Schlitten (pars mobilis)", unit="mm")
    bl.parent(carriage, root)

    # front panel (hideable)
    pnl0, pnl1 = p.v(M2 + "carriage_front_panel_y")
    pz0, pz1 = p.v(M2 + "carriage_front_panel_z")
    crank_drum = p.v(M2 + "magna_rota_center")["drum"]
    mx, mz = X[crank_drum], zd   # the crank turns drum 4 directly
    mb = MeshBuilder()
    # full height to the step (lower top from xt), then only the upper part (it passes over
    # the frame's right end)
    for r0 in (geom.rect(cx0, pz0, xt, mz - 4.0), geom.rect(cx0, mz + 4.0, xt, pz1),
               geom.rect(cx0, mz - 4.0, mx - 4.0, mz + 4.0), geom.rect(mx + 4.0, mz - 4.0, xt, mz + 4.0),
               geom.rect(xt, pz0, xs, zt - 2.0), geom.rect(xs, zn, xr, zt - 2.0)):
        mb.prism(r0, "XZ", pnl0, pnl1, "brass_polished")
    panel = static(mb.build("pm.carriage_panel", col))
    bl.parent(panel, carriage)

    # drive chain phases
    Lv = [(X[j] + dxL, zL) for j in range(C)]
    D = [(X[j], zd) for j in range(C)]
    cdl = math.hypot(Lv[0][0] - D[0][0], Lv[0][1] - D[0][1])
    zg = p.v(M1 + "drive_gear_teeth")
    dg = geom.GearSpec(zg, cdl / zg, p.v(M1 + "drive_gear_thickness_factor"),
                       (p.v(M1 + "drive_gear_tip_diameter") - cdl) / 2.0 / (cdl / zg))  # pitch diameter = centre distance
    drum_first, lever_first = [0.0] * C, [0.0] * C
    drum_first[0] = ang(Lv[0][0] - D[0][0], Lv[0][1] - D[0][1])
    for j in range(C):
        lever_first[j] = mesh_phase(drum_first[j], zg, D[j], Lv[j], zg)
        if j + 1 < C:
            drum_first[j + 1] = mesh_phase(lever_first[j], zg, Lv[j], D[j + 1], zg)

    first = p.v(G + "drum.rib_first_angle")
    rib_pitch = p.v("pars_mobilis.drum.rib_pitch")
    sq = 3.0
    za0, za1 = cp["zweihorn_add"]
    zs0, zs1 = cp["zweihorn_sub"]
    # one horn of the Zweihorn with its hub (a ring round the lever shaft), along +u
    zh = cg["zweihorn"]
    hub_r, hw0 = zh["hub_radius"], zh["root_half_width"]
    horn = carry.zweihorn_horn(p)
    a_root = math.degrees(math.asin(hw0 / hub_r))
    hub_arc = [geom._polar(hub_r, a_root + (360.0 - 2 * a_root) * i / 40) for i in range(41)]
    horn_outline = hub_arc + horn[1:-1]   # the arc ends where the horn's flanks meet the hub
    lever_r = cp["lever_shaft_radius"]
    # The drive row: the drum's gear (on a sleeve in front of the drum, sliding with it) has its
    # front face at drum_gear_y_at_9 at setting 9 and is 28.35 mm further back at setting 0;
    # the long gears on the lever shafts cover that travel.
    dgw = dr["drum_gear_width"]
    g_lo = dr["drum_gear_y_at_9"] - kin.drum_front_y(9)   # in the drum's frame (front face = 0)
    sleeve_r, shaft_front = dr["drum_sleeve_radius"], dr["shaft_front_y"]
    sh = p.v(M2 + "setting_head")
    lg = p.v(M2 + "large_gears")
    lgy0, lgy1 = lg["y"]
    big_levers = {lg["lever_shafts"]["A"]: "a", lg["lever_shafts"]["C"]: "c"}
    for j in range(C):
        x = X[j]
        mb = MeshBuilder()
        # The drum axis, a round shaft (Abb. II 9) from the bearing bar to the rear bearing
        # (y 74-78); the drum and the axis's head slide along it, and the drum is turned by its
        # own gear in the drive row. The crank's drum shaft reaches forward through the large
        # gear B and the front panel to the Magna Rota.
        y_front = p.v(M2 + "magna_rota_plates")["y"][-1][1] + 0.1 if j == crank_drum else shaft_front
        mb.prism(geom.circle(sq, 32), "XZ", y_front, p.v(M2 + "carriage_rear")["drum_shaft_back"], "steel", smooth=True)
        shaft = mb.build(f"pm.drum_shaft.{j}", col, (x, 0, zd))
        bl.set_motion(shaft, "rotate", (0, 1, 0), f"Drum shaft {j} with drive gear", f"Staffelwalzenwelle {j}")
        bl.parent(shaft, carriage)

        mb = MeshBuilder()
        mb.prism(geom.circle(drum_gear.rf, 64), "XZ", 0, L, "brass_polished", smooth=True)
        # the bore ends inside the front flange and the boss, not 0.01 mm from the core's end
        # faces, where the two would flicker (A2-14)
        mb.prism(geom.circle(sq + 0.4, 32), "XZ", -0.5, L + 0.5, "steel_dark", smooth=True)
        for kk in range(1, 10):
            tooth = geom.tooth_polygon(drum_gear, first + (kk - 1) * rib_pitch, root_r=drum_gear.rf - 0.3)
            mb.prism(tooth, "XZ", 0.0, kk * step, "brass_polished")   # all ribs start at the front face (Abb. II 1)
        mb.prism(geom.circle(9.0, 40), "XZ", -4.0, -3.0, "brass_satin", smooth=True)
        mb.prism(geom.circle(7.0, 40), "XZ", -3.0, -1.0, "brass_satin", smooth=True)
        mb.prism(geom.circle(9.0, 40), "XZ", -1.0, 0.0, "brass_satin", smooth=True)
        boss = p.v(G + "drum.boss")
        mb.prism(geom.circle(boss["diameter"] / 2.0, 40), "XZ", L - 0.01, L + boss["length"], "brass_polished", smooth=True)
        # the sleeve forward to the drum's gear in the drive row (it ends inside the flange)
        mb.prism(geom.circle(sleeve_r, 32), "XZ", g_lo + dgw - 0.5, -3.5, "brass_satin", smooth=True)
        mb.prism(geom.gear_outline(dg, drum_first[j]), "XZ", g_lo, g_lo + dgw, "steel_dark")
        drum = mb.build(f"pm.drum.{j}", col, (x, 0, zd))
        drum["core_radius_mm"], drum["rib_tip_radius_mm"] = drum_gear.rf, drum_gear.ra
        bl.set_motion(drum, "translate", (0, 1, 0), f"Stepped drum {j}", f"Staffelwalze {j}", unit="mm")
        bl.parent(drum, shaft)

        # The head of the drum axis (Abb. II 9 'v'): a sleeve sliding with the drum, in front of
        # its gear, with an upright wall whose top carries the rack teeth (pointing right, to
        # the knob's pinion). It slides along the drum axis and does not turn.
        mb = MeshBuilder()
        rack_c = kin.rack_centres()
        v_lo, v_hi = min(rack_c) - kin.rack_pitch / 2.0 - 1.5, g_lo - sh["gap_to_drum_gear"]
        tz0, tz1 = sh["teeth_z"][0] - zd, sh["teeth_z"][1] - zd
        mb.prism(geom.circle(sh["sleeve_radius"], 32), "XZ", v_lo, v_hi, "brass_satin", smooth=True)
        mb.prism(geom.rect(sh["wall_x0"], 0.0, x_pl - 1.25 * pm_ - 0.2, tz1), "XZ", v_lo, v_hi, "brass_satin")
        for poly in geom.rack_teeth(x_pl, pm_, rack_c, back_u=sh["wall_x0"]):
            mb.prism(poly, "XY", tz0, tz1, "brass_satin")
        rack = mb.build(f"pm.setting_rack.{j}", col, (x, 0, zd))
        bl.set_motion(rack, "translate", (0, 1, 0), f"Setting rack {j}", f"Einstellzahnstange {j}", unit="mm")
        bl.parent(rack, carriage)

        px = x + x_pl + pin_g.rp
        mb = MeshBuilder()
        mb.prism(geom.gear_outline(pin_g, 0.0), "XY", sh["teeth_z"][0], sh["teeth_z"][1], "steel_dark")
        mb.prism(geom.circle(1.5, 16), "XY", sh["teeth_z"][0] + 0.5, z_plate + 10.0, "steel", smooth=True)
        mb.prism(geom.circle(5.0, 32), "XY", z_plate + 2.0, z_plate + 4.0, "brass_satin", smooth=True)
        mb.prism(geom.radial_bar(0, dl["pointer_r"], 2.2, -90.0), "XY", z_plate + 2.05, z_plate + 3.2, "steel_dark")  # not flush with the hub
        mb.prism(geom.rect(-1.5, -4.0, 1.5, 4.0), "XY", z_plate + 4.0, z_plate + 12.0, "brass_polished")
        dial = mb.build(f"pm.setting_dial.{j}", col, (px, py, 0))
        bl.set_anchors(dial, "pointer_tip", [(0.0, -dl["pointer_r"], z_plate + 2.6)])
        bl.set_motion(dial, "rotate", (0, 0, 1), f"Setting knob {j}", f"Stellgriff {j}")
        bl.parent(dial, carriage)

        mb = MeshBuilder()
        mb.prism(geom.circle(dl["setting_plate_r"], 48), "XY", z_plate, z_plate + 2.0, "brass_satin", smooth=True)
        pg = []
        for s in range(10):
            a = math.radians(-90.0 - kin.dial_step * s)   # clockwise, as the knob turns
            gx, gy = dl["setting_glyph_r"] * math.cos(a), dl["setting_glyph_r"] * math.sin(a)
            pg.append((gx, gy, z_plate + 2.25))
            verts, faces = bl.glyph_mesh(str(s), dl["setting_glyph_size"], 0.3)
            mb.add_mesh_data(verts, faces, bl.frame_matrix((gx, gy, z_plate + 2.1), (1, 0, 0), (0, 1, 0)), "ink_black")
        plate = static(mb.build(f"pm.setting_plate.{j}", col, (px, py, 0)))
        bl.set_anchors(plate, "glyph_anchors", pg)
        bl.parent(plate, carriage)
        # stop: a lug in the pointer's plane, filling the blank sector between 9 and 0 (NL183/465 p. 38)
        mb = MeshBuilder()
        # the blank sector runs anticlockwise from 0 (at 270 deg) to 9 (270 + 360 - 9 divisions)
        mb.prism(geom.stop_lug(5.6, dl["pointer_r"] - 1.0, 270.0, 270.0 + 360.0 - kin.dial_step * 9, 1.1 + 0.15), "XY", z_plate + 2.0, z_plate + 3.4, "steel")
        stop = static(mb.build(f"pm.setting_stop.{j}", col, (px, py, 0)))
        bl.parent(stop, carriage)

        lx, lz = Lv[j]
        mb = MeshBuilder()
        # from the bearing bar (or the large gear A or C in front of it) to the rear wall
        y_front = lgy0 + 0.2 if j in big_levers else shaft_front
        mb.prism(geom.circle(lever_r, 16), "XZ", y_front, wall0 - 0.3, "steel", smooth=True)
        mb.prism(geom.gear_outline(dg, lever_first[j]), "XZ", gy0, gy1, "steel_dark")   # the long drive gear
        lever = mb.build(f"pm.lever.{j}", col, (lx, 0, lz))
        bl.set_motion(lever, "rotate", (0, 1, 0), f"Carry lever shaft {j}", f"Zweihornwelle {j}")
        bl.parent(lever, carriage)
        for kind, (ay0, ay1), le, ld in (("add", (za0, za1), "Zweihorn: adding horn", "Zweihorn: Additionshorn"),
                                         ("sub", (zs0, zs1), "Zweihorn: subtracting horn", "Zweihorn: Subtraktionshorn")):
            mb = MeshBuilder()
            mb.prism_holes(horn_outline, [geom.circle(lever_r + 0.15, 16)], "XZ", ay0, ay1, "steel_dark")
            horn = mb.build(f"pm.zweihorn_{kind}.{j}", col, (lx, 0, lz))
            bl.set_motion(horn, "rotate", (0, 1, 0), f"{le} {j}", f"{ld} {j}")
            bl.parent(horn, carriage)

    # The 17th shaft of the drive row, half a place right of the units drum at the levers'
    # height: its long gear meshes the units drum's gear; it will drive the revolution counter.
    P17 = (X[0] - dxL, zL)
    mb = MeshBuilder()
    mb.prism(geom.circle(1.5, 16), "XZ", shaft_front, dr["counter_shaft_back_y"], "steel", smooth=True)
    mb.prism(geom.gear_outline(dg, mesh_phase(drum_first[0], zg, D[0], P17, zg)), "XZ", gy0, gy1, "steel_dark")
    cshaft = mb.build("pm.counter_shaft", col, (P17[0], 0, P17[1]))
    bl.set_motion(cshaft, "rotate", (0, 1, 0), "Counter drive shaft (the 17th of the drive row)",
                  "Antriebswelle des Umdrehungszählers (die 17. der Antriebsreihe)")
    bl.parent(cshaft, carriage)

    # The three large gears behind the Magna Rota: B on the crank's drum shaft, A and C on two
    # lever shafts 2.5 places either side; each with three spokes.
    lc = Lv[lg["lever_shafts"]["C"]]
    cdb = math.hypot(lc[0] - D[crank_drum][0], lc[1] - D[crank_drum][1])   # 91.455 (A is as far on the other side)
    big = geom.GearSpec(lg["teeth"], cdb / lg["teeth"], 0.95)

    def spoked_gear(first_deg):
        m_ = MeshBuilder()
        r1, r0 = big.rf - lg["rim_width"], lg["hub_radius"]
        holes = []
        for s in range(lg["spokes"]):
            a0, a1 = 360.0 / lg["spokes"] * s, 360.0 / lg["spokes"] * (s + 1)
            d1 = math.degrees(math.asin(lg["spoke_width"] / 2.0 / r1))
            d0 = math.degrees(math.asin(min(0.95, lg["spoke_width"] / 2.0 / r0)))
            outer = [(r1, a0 + d1 + (a1 - a0 - 2 * d1) * i / 24) for i in range(25)]
            inner = [(r0 + 2.0, a1 - d0 - (a1 - a0 - 2 * d0) * i / 12) for i in range(13)]
            holes.append([(r * math.cos(math.radians(a)), r * math.sin(math.radians(a))) for r, a in outer + inner])
        m_.prism_holes(geom.gear_outline(big, first_deg, samples=4, root_samples=2), holes, "XZ", lgy0, lgy1, "brass_satin")
        m_.prism(geom.circle(r0, 32), "XZ", lgy1, lgy1 + 0.3, "brass_polished", smooth=True)   # boss on the back
        return m_

    for key, centre, first_deg, sign_en, sign_de in (
            ("b", D[crank_drum], 0.0, "on the crank's axis, turns drum 4", "auf der Kurbelachse, dreht Walze 4"),
            ("a", Lv[lg["lever_shafts"]["A"]], mesh_phase(0.0, big.z, D[crank_drum], Lv[lg["lever_shafts"]["A"]], big.z),
             "on carry lever shaft 6", "auf der Welle des Übertragshebels 6"),
            ("c", Lv[lg["lever_shafts"]["C"]], mesh_phase(0.0, big.z, D[crank_drum], Lv[lg["lever_shafts"]["C"]], big.z),
             "on carry lever shaft 1", "auf der Welle des Übertragshebels 1")):
        g = spoked_gear(first_deg).build(f"pm.large_gear_{key}", col, (centre[0], 0, centre[1]))
        bl.set_motion(g, "rotate", (0, 1, 0), f"Large gear {key.upper()} ({sign_en})", f"Großes Zahnrad {key.upper()} ({sign_de})")
        bl.parent(g, carriage)

    # Magna Rota: three plates of the owner's drawing (design/drawings/magna-rota.svg), fixed to
    # the crank and turning with it: the pierced brass plate in front, two steel plates behind.
    from lib.svgplate import read_plate
    mr_cfg = p.v(M2 + "magna_rota_plates")
    mrad = p.v(M2 + "magna_rota_radius")
    drawing = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", mr_cfg["drawing"])
    mb = MeshBuilder()
    for pid, (y0, y1), mat in zip(mr_cfg["ids"], mr_cfg["y"], mr_cfg["materials"]):
        rim, holes = read_plate(drawing, pid, 2.0 * mrad, mr_cfg["tolerance"])
        # the drawing's x right and y up are the machine's x and z, seen from the front
        mb.prism_holes(rim, holes, "XZ", y0, y1, mat)
    mrota = mb.build("pm.magna_rota", col, (mx, 0, mz))
    bl.set_motion(mrota, "rotate", (0, 1, 0), "Magna Rota (turns with the crank)", "Magna Rota (dreht sich mit der Kurbel)")
    bl.parent(mrota, carriage)

    # main crank: shaft through the Magna Rota's centre hole, arm in front of it,
    # pointing down at rest; the knob stays above the case floor.
    ck = p.v(M2 + "main_crank")
    mb = MeshBuilder()
    mb.prism(geom.circle(3.0, 24), "XZ", ck["arm_y"][0], pnl0 - 2.6, "steel", smooth=True)
    mb.prism(geom.circle(6.0, 32), "XZ", ck["arm_y"][0] - 1.0, ck["arm_y"][1], "brass_satin", smooth=True)
    mb.prism(geom.radial_bar(4.0, ck["radius"], 6.0, -90.0), "XZ", ck["arm_y"][0], ck["arm_y"][1], "brass_satin")
    mb.prism([(u, w - ck["radius"]) for u, w in geom.circle(ck["knob_radius"], 24)], "XZ", ck["knob_y"], ck["arm_y"][0], "wood_dark", smooth=True)
    crank = mb.build("pm.main_crank", col, (mx, 0, mz))
    bl.set_motion(crank, "rotate", (0, 1, 0), "Main crank (one turn = one addition or subtraction)", "Hauptkurbel")
    bl.parent(crank, carriage)

    # =========================================================== casing
    cs = p.v(M2 + "casing")
    wt, cz0, cz1 = cs["wall"], cs["register_cover_z"][0], cs["register_cover_z"][1]
    ix0, ix1, iy0, iy1 = cs["inner_x"][0], cs["inner_x"][1], cs["inner_y"][0], cs["inner_y"][1]
    ft, wtop = cs["floor_top_z"], cs["wall_top_z"]
    mb = MeshBuilder()
    mb.prism(geom.rect(ix0 - wt, iy0 - wt, ix1 + wt, iy1 + wt), "XY", ft - cs["floor"], ft, "oak")
    mb.prism(geom.rect(ix0 - wt, iy1, ix1 + wt, iy1 + wt), "XY", ft, wtop, "oak")                   # rear
    mb.prism(geom.rect(ix0 - wt, iy0 - wt, ix1 + wt, iy0), "XY", ft, ft + cs["front_height"], "oak")  # front (low)
    mb.prism(geom.rect(ix1, iy0, ix1 + wt, iy1), "XY", ft, wtop, "oak")                              # right end
    # left end: the lead screw passes through a hole to the end crank outside
    hy, hz, hh = ls["y"], ls["z"], ls["radius"] + 3.0
    for r0 in (geom.rect(iy0, ft, iy1, hz - hh), geom.rect(iy0, hz + hh, iy1, wtop),
               geom.rect(iy0, hz - hh, hy - hh, hz + hh), geom.rect(hy + hh, hz - hh, iy1, hz + hh)):
        mb.prism(r0, "YZ", ix0 - wt, ix0, "oak")
    case = static(mb.build("frame.case", col))
    # heights the operability check (A2-13) compares the crank knobs against
    bl.set_anchors(case, "front_wall_top", [(0.0, iy0, ft + cs["front_height"])])
    bl.set_anchors(case, "floor_top", [(0.0, 0.0, ft)])
    bl.set_anchors(case, "underside", [(0.0, 0.0, ft - cs["floor"])])
    bl.parent(case, root)

    # register cover: above every register part (Muldenrad tips z 84.4, rear wall 85);
    # its openings sit over the window plate's openings, 1-2 mm larger so a digit 8 mm
    # below stays readable from an angle (the window plate still frames it)
    mb = MeshBuilder()
    oy0, oy1 = dl["cover_opening_y"]
    plate_with_hole_row(mb, ix0, cs["register_cover_y0"], ix1, cs["register_cover_y1"], oy0, oy1, [(x - dl["cover_opening_half_x"], x + dl["cover_opening_half_x"]) for x in X], cz0, cz1, "brass_polished")
    # skirt along the front edge (above the frame's front bar, z <= 69, and every carriage part)
    y0 = cs["register_cover_y0"]
    mb.prism(geom.rect(ix0, y0, ix1, y0 + 1.2), "XY", cs["register_cover_skirt_z0"], cz0, "brass_satin")
    rcover = static(mb.build("frame.register_cover", col))
    bl.set_anchors(rcover, "opening_centres", [(x, (oy0 + oy1) / 2.0, cz1) for x in X])
    bl.parent(rcover, root)

    # carriage cover: top plate on the front panel, under the knob plates (holes for the
    # knob shafts), and end walls hanging from it above the lead screw
    kz0, kz1 = cs["carriage_cover_z"]
    ky0, ky1 = cs["carriage_cover_y"]
    mb = MeshBuilder()
    shafts = [(X[j] + x_pl + pin_g.rp - 2.5, X[j] + x_pl + pin_g.rp + 2.5) for j in range(C)]
    plate_with_hole_row(mb, cx0, ky0, xt, ky1, py - 2.5, py + 2.5, shafts, kz0, kz1, "brass_polished")
    mb.prism(geom.rect(xt, ky0, xr, ky1), "XY", zt - 2.0, zt, "brass_polished")           # lower top on the right
    # the walls start behind the front panel: sharing its front face made them flicker (z-fighting)
    mb.prism(geom.rect(xt - 3.0, pnl1, xt, ky1), "XY", zt, kz0, "brass_satin")            # riser between them
    wz0 = cs["carriage_wall_z0"]
    mb.prism(geom.rect(cx0, pnl1, cx0 + 3.0, ky1), "XY", wz0, kz0, "brass_satin")       # left end
    mb.prism(geom.rect(xs - 3.0, pnl1, xr, ky1), "XY", zn, zn + 2.0, "brass_satin")       # underside of the right part
    mb.prism(geom.rect(xr - 3.0, pnl1, xr, ky1), "XY", zn + 2.0, zt - 2.0, "brass_satin") # right end
    dx, dy, dz = X[0] + cs_["counter_dx"], py + cs_["counter_dy"], zt   # the revolution counter's centre: 64 right of the 17th shaft, in line with the knobs (Badur)
    ccover = static(mb.build("pm.carriage_cover", col))
    bl.parent(ccover, carriage)

    # Revolution counter (decision in design/v1.3-notes.md), laid out like the Dresden replica's:
    # a fixed plate with the black outer circle (anticlockwise from 0 at the stop) and the red
    # inner circle on the brass centre (clockwise), the stop bracket at the top; the steel ring
    # with 10 holes turns 36 deg a crank turn about the vertical, clockwise seen from above when
    # adding; the pin sits in a hole and reaches the stop after m turns from black m.
    ct = p.v(M2 + "counter")
    r_in, r_out = ct["ring_radius"]
    hp, gs = ct["hole_path_radius"], ct["glyph_size"]
    st = ct["stop"]
    stop_a = 90.0 - math.degrees((ct["pin_radius"] + st["finger_width"] / 2.0 + st["gap"]) / hp)
    mb = MeshBuilder()
    mb.prism(geom.circle(r_in - 0.3, 64), "XY", dz, dz + ct["centre_z"][1], "brass_satin", smooth=True)
    mb.prism(geom.circle(ct["spindle_radius"], 24), "XY", dz + 0.3, dz + 6.0, "steel", smooth=True)  # from inside the brass, not on its face
    mb.prism(geom.circle(ct["spindle_radius"] + 1.0, 24), "XY", dz + ct["centre_z"][1], dz + ct["centre_z"][1] + 1.0, "steel", smooth=True)
    black, red = [], []
    for k in range(10):
        a = math.radians(90.0 + 36.0 * k)
        for rr, txt, mat, z, store in ((ct["black_r"], str(k), "ink_black", dz + 0.05, black),
                                       (ct["red_r"], str((10 - k) % 10), "ink_red", dz + ct["centre_z"][1] + 0.05, red)):
            gx, gy = rr * math.cos(a), rr * math.sin(a)
            store.append((gx, gy, z))
            verts, faces = bl.glyph_mesh(txt, gs, 0.2)
            # lying on the top, upright for the operator at the front
            mb.add_mesh_data(verts, faces, bl.frame_matrix((gx, gy, z), (1, 0, 0), (0, 1, 0)), mat)
    # the stop: a post outside the ring and a finger over it, in the pin's plane
    mb.prism(geom.radial_bar(st["post_r"][0], st["post_r"][1], st["finger_width"], stop_a), "XY", dz, dz + st["finger_z"][1], "steel_dark")
    mb.prism(geom.radial_bar(hp - 2.5, st["post_r"][1], st["finger_width"], stop_a), "XY", dz + st["finger_z"][0], dz + st["finger_z"][1], "steel_dark")
    cplate = mb.build("pm.counter_plate", col, (dx, dy, 0))
    bl.set_anchors(cplate, "black_glyphs", black)
    bl.set_anchors(cplate, "red_glyphs", red)
    sa = math.radians(stop_a)
    bl.set_anchors(cplate, "stop_point", [(hp * math.cos(sa), hp * math.sin(sa), dz + sum(st["finger_z"]) / 2.0)])
    bl.parent(cplate, carriage)

    mb = MeshBuilder()
    holes = [[(u + hp * math.cos(math.radians(90.0 + 36.0 * k)), w + hp * math.sin(math.radians(90.0 + 36.0 * k)))
              for u, w in geom.circle(ct["hole_radius"], 20)] for k in range(10)]
    mb.prism_holes(geom.circle(r_out, 96), [geom.circle(r_in, 96)] + holes, "XY", dz + ct["ring_z"][0], dz + ct["ring_z"][1], "steel")
    cring = mb.build("pm.counter_ring", col, (dx, dy, 0))
    bl.set_motion(cring, "rotate", (0, 0, 1), "Revolution counter: ring with 10 holes", "Umdrehungszähler: Ring mit 10 Löchern")
    bl.parent(cring, carriage)

    def pin_mesh(cx, cy):
        m_ = MeshBuilder()
        m_.prism(geom.circle(ct["pin_radius"], 16), "XY", dz + ct["pin_z"][0], dz + ct["pin_head_z"][0], "steel", smooth=True, offset=(cx, cy, 0))
        m_.prism(geom.circle(ct["pin_head_radius"], 20), "XY", dz + ct["pin_head_z"][0], dz + ct["pin_head_z"][1], "brass_polished", smooth=True, offset=(cx, cy, 0))
        return m_

    cpin = pin_mesh(0.0, hp).build("pm.counter_pin", col, (dx, dy, 0))   # built at black 0, turned to its hole
    bl.set_motion(cpin, "rotate", (0, 0, 1), "Pin of the revolution counter", "Stift des Umdrehungszählers")
    bl.parent(cpin, carriage)
    mb = pin_mesh(0.0, -ct["park_r"])
    mb.prism([(u, w - ct["park_r"]) for u, w in geom.circle(ct["pin_radius"] + 1.2, 20)], "XY", dz, dz + ct["pin_z"][0], "brass_satin", smooth=True)
    cpark = static(mb.build("pm.counter_pin_park", col, (dx, dy, 0)))   # where the pin waits, shown when it is out
    bl.parent(cpark, carriage)

    # =========================================================== teaching extras (M3)
    labels = {
        "frame.static": ("Frame: side walls, rear wall and front bar", "Gestell: Seitenwände, Rückwand und Vorderleiste"),
        "frame.base": ("Oak base board and bearers", "Grundbrett und Auflageleisten aus Eiche"),
        "frame.case": ("Oak case", "Eichenkasten"),
        "frame.register_cover": ("Cover plate of the result register", "Deckplatte des Resultatwerks"),
        "pi.window": ("Reading windows of the result register", "Ablesefenster des Resultatwerks"),
        "pm.carriage_panel": ("Front panel of the carriage", "Vorderwand des Schlittens"),
        "pm.carriage_cover": ("Cover plate of the carriage", "Deckplatte des Schlittens"),
        "pm.counter_plate": ("Revolution counter: numbers and stop", "Umdrehungszähler: Zahlen und Anschlag"),
        "pm.counter_pin_park": ("Revolution counter: the pin, put away", "Umdrehungszähler: Stift in der Ablage"),
    }
    for j in range(C):
        labels[f"pm.setting_plate.{j}"] = (f"Setting dial {j} (digits 0-9)", f"Einstellscheibe {j} (Ziffern 0-9)")
        labels[f"pm.setting_stop.{j}"] = (f"Setting stop {j}", f"Anschlag des Stellknopfs {j}")
    for name, (en, de) in labels.items():
        bl.set_labels(bpy.data.objects[name], en, de)
    # exploded view: one offset per part group, matched by exact name or "prefix.*"
    for o in bpy.data.objects:
        if "motion" not in o:
            continue
        for pattern, off in p.v(M2 + "explode").items():
            if o.name == pattern or (pattern.endswith(".*") and o.name.startswith(pattern[:-1])):
                bl.set_explode(o, off)
                break

    root["machine"] = "leibniz-stepped-reckoner"
    root["milestone"] = "M2 full machine"
    root["register_digits"], root["carriage_digits"] = R, C
    root["params_version"] = p.raw.get("version", "")
    return root


def export(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_extras=True,
                              export_apply=True, export_cameras=False, export_lights=False, **bl.EXPORT_IMAGES)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[argv.index("--out") + 1] if "--out" in argv else DEFAULT_OUT
    build(params.load())
    export(out)
    if "--blend" in argv:
        bpy.ops.wm.save_as_mainfile(filepath=argv[argv.index("--blend") + 1])
    tris = sum(sum(len(f.vertices) - 2 for f in o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
    print(f"M2_BUILD_OK out={out} objects={len(bpy.data.objects)} triangles~{tris} bytes={os.path.getsize(out)}")
