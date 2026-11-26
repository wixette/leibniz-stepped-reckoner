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
  pm.lever.j / pm.zweihorn.j (the original's Zweihorn, one part, two horns) / pm.zweihorn_r.j (the ripple set's)
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

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from lib import bl, carry, counter_train, geom, kinematics, params  # noqa: E402
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


def lathe(mb, profile, mat, origin=(0.0, 0.0, 0.0), n=40):
    """A turned part about the vertical: profile [(r, z), ...] from the axis round to the axis
    again (r 0 at both ends), revolved n times; z absolute, origin (x, y) its axis."""
    ox, oy, oz = origin
    rings = []
    for r, z in profile:
        rings.append([(ox + r * math.cos(2 * math.pi * k / n), oy + r * math.sin(2 * math.pi * k / n), oz + z) for k in range(n)])
    verts = [v for ring in rings for v in ring]
    faces = []
    for i in range(len(rings) - 1):
        for k in range(n):
            a, b = i * n + k, i * n + (k + 1) % n
            faces.append((a, b, b + n, a + n))
    mb.add_mesh_data(verts, faces, bl.frame_matrix((0, 0, 0), (1, 0, 0), (0, 1, 0)), mat)


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
        # the rim: a gold ring at each edge, recessed 0.3 under the white band between them (the
        # digits on the band: black on white reads best, as in v1.2.0); the band stands 0.36 off the
        # brass under it and its ends just inside the gold rings, so no two faces share a place
        band = dish["band_edge"]
        mb.prism_holes(geom.circle(r_out, 96), [geom.circle(dish["recess_r"], 96)], "XZ", dy0, dy0 + band, "brass_polished")
        mb.prism_holes(geom.circle(r_out, 96), [geom.circle(dish["recess_r"], 96)], "XZ", dy1 - band, dy1, "brass_polished")
        mb.prism_holes(geom.circle(r_out - 0.3, 96), [geom.circle(dish["recess_r"], 96)], "XZ", dy0 + band - 0.01, dy1 - band + 0.01, "brass_polished")
        mb.prism_holes(geom.circle(r_out + 0.06, 96), [geom.circle(r_out - 0.5, 96)], "XZ", dy0 + band + 0.02, dy1 - band - 0.02, "enamel_white")
        mb.prism(geom.circle(dish["recess_r"] + 0.05, 96), "XZ", dy1 - dish["face"], dy1 - 0.05, "brass_satin", smooth=True)
        mb.prism(geom.circle(dish["hub_r"], 32), "XZ", dy0 + 0.5, dy1 - dish["face"], "brass_satin", smooth=True)
        glyphs = []
        for d in range(10):
            a = math.radians(90.0 + 36.0 * d)   # the wheel turns the other way in the model (m2Pose.js)
            nrm, tan = (math.cos(a), 0.0, math.sin(a)), (math.sin(a), 0.0, -math.cos(a))
            o = (nrm[0] * (r_out + 0.12), (dy0 + dy1) / 2.0, nrm[2] * (r_out + 0.12))
            glyphs.append(o)
            verts, faces = bl.glyph_mesh(str(d), dl["result_glyph_size"], 0.25)
            mb.add_mesh_data(verts, faces, bl.frame_matrix(o, tan, (0, 1, 0)), "ink_black")
        # the Einzahn (one pointed tooth on a ring) in the plane of its own store's five-horn p,
        # and the small ten-wheel in the plane of the store below (k - 1), which turns it
        ea, eb = pair[k % 2]
        # mirrored about the line to its store: the solve (lib/carry_solve.py) turns the parts the
        # other way round from the model (m2Pose.js), which by symmetry gives the same contacts
        mb.prism(carry.einzahn(p, 360.0 - cg["einzahn"]["tooth_local"]), "XZ", ea - ov, eb + ov, "brass_polished")
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
        # the intermediate shaft (BADUR2026 Pos. 23/24): Ø5 journals and a square part, 6 across,
        # carrying s, p and the detent wheel; long concave cuts along its four edges narrow the flats
        # to 3.5 in the middle of each cut (R 100), short square ends left; steel
        ssh = p.v(M2 + "store_shaft")
        sq0, sq1 = ssh["square_y"]
        jr = ssh["journal_radius"]
        half = ssh["square"] / 2.0
        mb.prism(geom.circle(jr, 20), "XZ", cp["store_shaft_front"], sq0 + 0.2, "steel", smooth=True)
        # behind the square part a thinner journal: the ripple set's star s' sits on it, and its
        # hollows reach down to radius 2.1
        mb.prism(geom.circle(ssh["rear_journal_radius"], 20), "XZ", sq1 - 0.2, pb + 1.0, "steel", smooth=True)
        edges = [sq0] + [y for c_ in ssh["cuts_y"] for y in c_] + [sq1]
        for a, b in zip(edges[0::2], edges[1::2]):
            mb.prism(geom.rect(-half, -half, half, half), "XZ", a, b, "steel")    # the square ends
        cmax = half - ssh["cut_flat"] / 2.0
        for c0, c1 in ssh["cuts_y"]:
            nseg_ = 24
            rings = []
            for i_ in range(nseg_ + 1):
                y_ = c0 + (c1 - c0) * i_ / nseg_
                u_ = 2.0 * i_ / nseg_ - 1.0                          # -1 .. 1 along the cut
                cut_ = max(cmax * (1.0 - u_ * u_), 1e-4)        # the cut's depth at each edge (> 0 keeps the points in order)
                pts = []
                for sx, sz in ((1, -1), (1, 1), (-1, 1), (-1, -1)):
                    pts += [(sx * half, sz * (half - cut_)), (sx * (half - cut_), sz * half)]
                pts.sort(key=lambda q: math.atan2(q[1], q[0]))   # anticlockwise seen from the front
                ring = [(x_, y_, z_) for x_, z_ in pts]
                rings.append(ring)
            verts = [v_ for r_ in rings for v_ in r_]
            faces = []
            for i_ in range(nseg_):
                for q_ in range(8):
                    a_, b_ = i_ * 8 + q_, i_ * 8 + (q_ + 1) % 8
                    faces.append((a_, a_ + 8, b_ + 8, b_))
            mb.add_mesh_data(verts, faces, bl.frame_matrix((0, 0, 0), (1, 0, 0), (0, 1, 0)), "steel")
        qa, qb = pair[k % 2]
        hub = cg["five_horn"]["hub_radius"]
        mb.prism(carry.five_horn(p, cg["p_phase"]), "XZ", qa, qb, "brass_polished")
        mb.prism(geom.circle(hub, 32), "XZ", qa - 0.8, qb + 1.0, "brass_satin", smooth=True)
        da, db = cp["detent"]
        mb.prism(carry.detent_wheel(p, 90.0), "XZ", da, db, "brass_satin")
        sa, sb = cp["s"]
        mb.prism(geom.regular_polygon(pr, 5, 54.0), "XZ", pa, pb, "steel_pentagon")
        store = mb.build(f"pi.carry_store.{k}", col, (fx, 0, fz))
        bl.set_anchors(store, "pentagon_corners", [(u, pb, w) for u, w in geom.regular_polygon(pr, 5, 54.0)])
        bl.set_motion(store, "rotate", (0, 1, 0), f"Carry store {k}", f"Übertragsspeicher {k}")
        bl.parent(store, root)
        # the five-horn struck by the Zweihorn, exchangeable with the carry set (one of the two is
        # shown, js/scene/m2Pose.js): the original's s (Badur), or the ripple set's star s' (our design)
        mb = MeshBuilder()
        mb.prism(carry.five_horn(p, cg["s_phase"]), "XZ", sa, sb, "brass_polished")
        mb.prism(geom.circle(hub, 32), "XZ", sb, sb + 1.0, "brass_satin", smooth=True)
        s_node = mb.build(f"pi.five_horn_s.{k}", col, (fx, 0, fz))
        bl.set_motion(s_node, "rotate", (0, 1, 0), f"Front five-horn {k} (the original's)", f"Vorderes Fünfhorn {k} (Original)")
        bl.parent(s_node, root)
        # the ripple set's s' stands behind the drum axes' rear end, between the frame bar and
        # the rear wall (geometry.m2.carry_planes.ripple_s), where its long Zweihorn turns clear
        # of the drum axes; a collar fixes it to the shaft
        ra, rb = cp["ripple_s"]
        mb = MeshBuilder()
        mb.prism(carry.ripple_star(p, cg["s_phase"]), "XZ", ra, rb, "steel")
        mb.prism(geom.circle(2.0, 24), "XZ", rb, rb + 0.5, "brass_satin", smooth=True)   # inside the hollows (r 2.1)
        s_node = mb.build(f"pi.five_horn_sr.{k}", col, (fx, 0, fz))
        bl.set_motion(s_node, "rotate", (0, 1, 0), f"Front five-horn {k} (ripple set)", f"Vorderes Fünfhorn {k} (Staffelsatz)")
        bl.parent(s_node, root)

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
    fb0, fb1 = fr["register_front_bar_y"]
    mb.prism(geom.rect(in_x0, zs - 4.5, in_x1, zs + 4.5), "XZ", fb0, fb1, "brass_satin")
    for bx in (in_x0, in_x1 - 3.0):
        mb.prism(geom.rect(bx, fb1, bx + 3.0, wall0), "XY", zs - 4.5, zs + 4.5, "brass_satin")
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
    frame = static(mb.build("frame.static", col))
    bl.parent(frame, root)
    # the springs on their studs: working parts, a node apart from the frame (the page hides the
    # frame with the case and leaves them)
    mb = MeshBuilder()
    for fxk, fzk in F:
        mb.prism([(u + fxk, w + fzk) for u, w in leaf], "XZ", da + 0.5, db - 0.5, "steel")
        mb.prism([(u + fxk + 8.6, w + fzk + 12.4) for u, w in geom.circle(1.0, 16)], "XZ", da - 0.3, fb["y"][0] + 0.6, "brass_satin", smooth=True)
    springs = static(mb.build("frame.springs", col))
    bl.parent(springs, root)

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
    # the Magna Rota's spring detent ("federnde Raste" behind the disc, K. Badur 2026-11-25): a leaf
    # with a V tip against the rear steel plate's rim, on a stud in the front panel; drawn just
    # clear of the rim (the model does not bend it)
    mrad_ = p.v(M2 + "magna_rota_radius")
    py0, py1 = p.v(M2 + "magna_rota_plates")["y"][-1]
    tip = mrad_ + 0.15
    panel = static(mb.build("pm.carriage_panel", col))
    bl.parent(panel, carriage)
    mb = MeshBuilder()
    leaf = [(66.6, 7.4), (65.8, 8.6), (tip + 1.2, 1.0), (tip, 0.0), (tip + 1.2, -0.4)]
    mb.prism([(mx + u, mz + w) for u, w in leaf], "XZ", py0 + 0.2, py1 - 0.2, "steel")
    mb.prism([(mx + 66.2 + u, mz + 8.0 + w) for u, w in geom.circle(1.3, 16)], "XZ", py0 + 0.1, pnl0 + 0.5, "brass_satin", smooth=True)
    mdet = static(mb.build("pm.magna_rota_detent", col))
    bl.parent(mdet, carriage)

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
    # Each lever's Zweihorn is one part (BADUR2026 Pos. 21, Abb. II 9 't'): a hub round the lever
    # shaft and two horns, the adding horn at local 180 deg (pointing the other way: the model
    # mirrors the solve about the vertical through the lever, and m2Pose.js negates the angles)
    # and the subtracting horn the lever's spread further on. The spreads come from the
    # simulator (params/lever-phases.json, `pnpm phases`): 82 deg on every lever of the
    # original's set, 127 down to 43 deg across the ripple set's levers, units first.
    with open(os.path.join(params.MACHINE_DIR, "params", "lever-phases.json"), encoding="utf-8") as f:
        lever_phases = json.load(f)

    def spread(mode, j):
        ph = lever_phases[mode][j]
        return (ph["add"] - ph["sub"]) % 360.0

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
            # mirrored about the vertical: the drum turns the other way in the model (m2Pose.js)
            tooth = geom.tooth_polygon(drum_gear, 180.0 - (first + (kk - 1) * rib_pitch), root_r=drum_gear.rf - 0.3)
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
        # The finger lever (Lehmann's 'Fingerhebel', NL183/465 p. 23), one black steel part: a body
        # on the axle, a flat pointer arm with a pointed tip and a pin under it that stands in the
        # hole beside the set digit, and the strip bent up from the body into a C, open towards
        # the pointer, by which the lever is lifted and turned (the lift is not animated). Built
        # pointing to -y, then turned to point at 0 (angle_deg).
        hd_ = p.v(M2 + "setting_handle")
        pt_, pl_, dk_ = hd_["pointer"], hd_["plate"], hd_["disc"]
        a0_ = hd_["angle_deg"]
        n_lever = len(mb.verts)
        tl_, tz_ = pt_["tail_half"], z_plate + 2.05 + pt_["tail_height"]
        mb.prism(geom.rect(-tl_, -tl_, tl_, tl_), "XY", z_plate + 2.05, tz_, "steel_dark")
        mb.prism(geom.pointer_outline(tl_ - 0.5, pt_["tip_r"], pt_["width"], -90.0), "XY", z_plate + 2.05, z_plate + 2.05 + pt_["thickness"], "steel_dark")  # not flush with the plate
        mb.prism(geom.circle(pt_["pin_radius"], 10), "XY", z_plate + 2.1 - pt_["pin_length"], z_plate + 2.1, "steel_dark", smooth=True, offset=(0.0, -pt_["pin_r"], 0.0))
        rc_, (th_, wd_) = hd_["radius"], hd_["strip"]
        cz_ = tz_ + rc_ + th_ / 2.0 - 0.3                    # the C's foot sits just in the body's top
        g0_, g1_ = hd_["gap_deg"]                            # the gap, in degrees from the pointer's way, up positive
        arc_ = [g1_ + (360.0 - (g1_ - g0_)) * i / 32 for i in range(33)]
        # in the YZ plane: u is y, and the pointer points to -y
        c_out = [(-math.cos(math.radians(a)) * (rc_ + th_ / 2.0), cz_ + math.sin(math.radians(a)) * (rc_ + th_ / 2.0)) for a in arc_]
        c_in = [(-math.cos(math.radians(a)) * (rc_ - th_ / 2.0), cz_ + math.sin(math.radians(a)) * (rc_ - th_ / 2.0)) for a in reversed(arc_)]
        mb.prism(c_out + c_in, "YZ", -wd_ / 2.0, wd_ / 2.0, "steel")
        rot_ = math.radians(a0_ + 90.0)
        cr_, sr_ = math.cos(rot_), math.sin(rot_)
        mb.verts[n_lever:] = [(vx * cr_ - vy * sr_, vx * sr_ + vy * cr_, vz) for vx, vy, vz in mb.verts[n_lever:]]
        # the axle rises inside the C to a flat, wide, knurled bronze nut, bevelled top and
        # bottom, just under the C's centre (photos)
        nut_ = hd_["nut"]
        nz1 = cz_ - nut_["below_centre"]
        nz0 = nz1 - nut_["height"]
        mb.prism(geom.circle(1.5, 16), "XY", sh["teeth_z"][0] + 0.5, nz0 + 0.2, "steel", smooth=True)
        kn, nr_, bv_ = nut_["knurls"], nut_["radius"], nut_["bevel"]
        knurl = [geom._polar(nr_ + (0.25 if i % 2 else 0.0), 360.0 * i / (2 * kn)) for i in range(2 * kn)]
        mb.prism(knurl, "XY", nz0 + bv_, nz1 - bv_, "bronze")
        lathe(mb, [(0.0, nz0), (nr_ - bv_, nz0), (nr_ + 0.1, nz0 + bv_), (nr_ + 0.1, nz1 - bv_), (nr_ - bv_, nz1), (0.0, nz1)], "bronze", (0.0, 0.0, 0.0), 24)
        # the digit disc under the plate (Lehmann's 'Ziffernscheibe', p. 35), clamped to the axle:
        # digit s lies where the knob set to s brings it under the window, upright to a reader in
        # front; a tab on its rim meets the hidden stop at 0 and at 9
        # white, like the result discs' bands, so that the digit in the window stands out from
        # the plate's; a gap below the plate shows that these are two plates
        dz1 = z_plate - dk_["gap"]
        dz0 = dz1 - dk_["thickness"]
        # brass inside, under the pin's holes (which then look dark, as on the photos), white outside
        wr_ = pl_["window_r"][0] - 0.2
        mb.prism(geom.circle(wr_, 16), "XY", dz0, dz1, "brass_satin", smooth=True)
        mb.prism_holes(geom.circle(dk_["radius"], 32), [geom.circle(wr_, 16)], "XY", dz0, dz1, "enamel_white")
        mb.prism(geom.radial_bar(dk_["radius"] - 0.5, dk_["tab_r"], 2.0 * dk_["tab_half_width"], a0_), "XY", dz0 + 0.1, dz1 - 0.1, "brass_satin")  # inside the white ring's faces (A2-14)
        wg = []
        for s_ in range(10):
            ph = math.radians(90.0 + kin.dial_step * s_)
            ur, ut = (math.cos(ph), math.sin(ph)), (math.sin(ph), -math.cos(ph))
            gx, gy = dk_["glyph_r"] * ur[0], dk_["glyph_r"] * ur[1]
            wg.append((gx, gy, dz1 + 0.15))
            verts, faces = bl.glyph_mesh(str(s_), dl["setting_glyph_size"], 0.0)   # flat: read from above only
            mb.add_mesh_data(verts, faces, bl.frame_matrix((gx, gy, dz1 + 0.05), (ut[0], ut[1], 0), (ur[0], ur[1], 0)), "ink_black")
        dial = mb.build(f"pm.setting_dial.{j}", col, (px, py, 0))
        a0r = math.radians(a0_)
        bl.set_anchors(dial, "pointer_tip", [(pt_["tip_r"] * math.cos(a0r), pt_["tip_r"] * math.sin(a0r), z_plate + 2.6)])
        bl.set_anchors(dial, "window_glyphs", wg)
        bl.set_motion(dial, "rotate", (0, 0, 1), f"Setting knob {j}", f"Stellgriff {j}")
        bl.parent(dial, carriage)

        # the cover plate round the knob (p. 53, detail A): digits clockwise from just right of
        # the window, a hole beside each for the lever's pin, the window in the middle of the blank
        # between 9 and 0 (at the back); it lies in a round hole of the carriage's cover, flush with it
        mb = MeshBuilder()
        holes_, pg = [], []
        wr0, wr1 = pl_["window_r"]
        hw_ = pl_["window_half_width"]
        holes_.append([(-hw_, wr0), (hw_, wr0), (hw_, wr1), (-hw_, wr1)])
        for s_ in range(10):
            a = math.radians(a0_ - kin.dial_step * s_)   # clockwise, as the knob turns
            holes_.append([(u + pt_["pin_r"] * math.cos(a), w + pt_["pin_r"] * math.sin(a)) for u, w in geom.circle(pl_["hole_radius"], 10)])
            gx, gy = dl["setting_glyph_r"] * math.cos(a), dl["setting_glyph_r"] * math.sin(a)
            pg.append((gx, gy, z_plate + 2.25))
            verts, faces = bl.glyph_mesh(str(s_), dl["setting_glyph_size"], 0.0)   # flat (the triangle budget)
            mb.add_mesh_data(verts, faces, bl.frame_matrix((gx, gy, z_plate + 2.05), (1, 0, 0), (0, 1, 0)), "ink_black")
        mb.prism_holes(geom.circle(dl["setting_plate_r"], 72), holes_, "XY", z_plate, z_plate + 2.0, "brass_satin")
        plate = static(mb.build(f"pm.setting_plate.{j}", col, (px, py, 0)))
        bl.set_anchors(plate, "glyph_anchors", pg)
        bl.set_anchors(plate, "window", [(0.0, (wr0 + wr1) / 2.0, z_plate)])
        bl.parent(plate, carriage)
        # the stop (p. 38), hidden under the cover: a lug hanging from the cover's underside into
        # the blank, which the disc's tab meets at 0 and at 9
        mb = MeshBuilder()
        mb.prism(geom.stop_lug(hd_["stop_r"][0], hd_["stop_r"][1], a0_, a0_ + 360.0 - kin.dial_step * 9, dk_["tab_half_width"] + 0.15), "XY", dz0, z_plate, "brass_satin")
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
        for name, key, mode, (ay0, ay1), le, ld in (
                (f"pm.zweihorn.{j}", "zweihorn", "simultaneous", cp["zweihorn"], f"Zweihorn {j}", f"Zweihorn {j}"),
                (f"pm.zweihorn_r.{j}", "ripple_zweihorn", "ripple", cp["ripple_zweihorn"],
                 f"Zweihorn {j} (ripple set)", f"Zweihorn {j} (Staffelsatz)")):
            mb = MeshBuilder()
            mb.prism_holes(carry.zweihorn_part(p, spread(mode, j), key), [geom.circle(lever_r + 0.15, 16)], "XZ", ay0, ay1, "steel_dark")
            horn = mb.build(name, col, (lx, 0, lz))
            bl.set_motion(horn, "rotate", (0, 1, 0), le, ld)
            bl.parent(horn, carriage)

    # The 17th shaft of the drive row, half a place right of the units drum at the levers'
    # height: its long gear meshes the units drum's gear; it will drive the revolution counter.
    P17 = (X[0] - dxL, zL)
    mb = MeshBuilder()
    mb.prism(geom.circle(1.5, 16), "XZ", shaft_front, dr["counter_shaft_back_y"], "steel", smooth=True)
    mb.prism(geom.gear_outline(dg, mesh_phase(drum_first[0], zg, D[0], P17, zg)), "XZ", gy0, gy1, "steel_dark")
    # its single tooth, which steps the counter's star wheel K once a turn (lib/counter_train.py)
    hub_, tooth_ = counter_train.driver_tooth(p)
    dy_ = p.v(M2 + "counter_train")["driver"]["y"]
    mb.prism(carry.star_union([hub_, tooth_]), "XZ", dy_[0], dy_[1], "steel_dark")   # one outline: no faces inside faces
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
    from lib.svgplate import _area as _svg_area, plate_frame, read_plate, shape_loops
    mr_cfg = p.v(M2 + "magna_rota_plates")
    mrad = p.v(M2 + "magna_rota_radius")
    # the owner's drawing of the crank and the bolts (design/drawings/magna-rota-details.svg): its
    # front view gives outlines (x right, y down), its side view depths (x to the front, from the
    # brass plate's front face); one scale, from the plate's measured diameter
    mc = p.v(M2 + "magna_rota_crank")
    dwg = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", mc["drawing"])
    s_, cx_, cy_ = plate_frame(dwg, mc["front_ref"], 2.0 * mrad)
    yf_ = mr_cfg["y"][0][0]                                  # the brass plate's front face

    def depth(xd):
        """y of a side-view x (in front of the plates)."""
        return yf_ - (xd - mc["side_plate_front_x"]) * s_

    drawing = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", mr_cfg["drawing"])
    mb = MeshBuilder()
    for pid, (y0, y1), mat in zip(mr_cfg["ids"], mr_cfg["y"], mr_cfg["materials"]):
        rim, holes = read_plate(drawing, pid, 2.0 * mrad, mr_cfg["tolerance"])
        # the drawing's x right and y up are the machine's x and z, seen from the front
        mb.prism_holes(rim, holes, "XZ", y0, y1, mat)
    # the two bolts holding the plates together, left and right (the owner's drawing): a shank
    # through the plates' holes, a round nut in front with a domed head
    bo = mc["bolts"]
    for sx_ in (-1.0, 1.0):
        bx, bz = sx_ * bo["x"], bo["z"]
        mb.prism([(u + bx, w + bz) for u, w in geom.circle(bo["shank_radius"], 12)], "XZ", yf_ + 0.2, mr_cfg["y"][-1][1] - 0.1, "steel", smooth=True)
        y_nut = depth(bo["nut_front_x"])
        mb.prism([(u + bx, w + bz) for u, w in geom.circle(bo["nut_radius"], 24)], "XZ", y_nut, yf_ + 0.01, "steel", smooth=True)
        yc = depth(bo["head_centre_x"])
        hr = bo["head_radius"]
        n0 = len(mb.verts)
        lathe(mb, [(0.0, -0.3)] + [(hr * math.cos(math.radians(a)), hr * math.sin(math.radians(a))) for a in range(0, 91, 15)], "steel", (0.0, 0.0, 0.0), 20)
        mb.verts[n0:] = [(bx + vx, yc - vz, bz + vy) for vx, vy, vz in mb.verts[n0:]]
        mb.prism([(u + bx, w + bz) for u, w in geom.circle(hr, 20)], "XZ", yc, y_nut + 0.01, "steel", smooth=True)
    mrota = mb.build("pm.magna_rota", col, (mx, 0, mz))
    bl.set_motion(mrota, "rotate", (0, 1, 0), "Magna Rota (turns with the crank)", "Magna Rota (dreht sich mit der Kurbel)")
    bl.parent(mrota, carriage)

    # main crank (the owner's drawing, design/drawings/magna-rota-details.svg): a steel rod across
    # the Magna Rota's face, a boss on the centre, and a turned oak handle with a steel ball on an
    # axis at the rod's lower end, standing out to the front; the plates are held by two bolts.
    # The drawing's front view gives the outlines (x right, y down), its side view the depths
    # (x to the front, from the brass plate's front face); one scale, from the plate's diameter.
    def lathe_y(m_, profile_px, mat, ox, oz, n=32):
        """A turned part on an axis along y at (ox, oz): profile [(r, x)] in side-view units."""
        n0 = len(m_.verts)
        lathe(m_, [(r * s_, (xd - mc["side_plate_front_x"]) * s_) for r, xd in profile_px], mat, (0.0, 0.0, 0.0), n)
        # turned a quarter about x: the lathe's axis (+z) points to the front (-y)
        m_.verts[n0:] = [(ox + vx, yf_ - vz, oz + vy) for vx, vy, vz in m_.verts[n0:]]

    def side_profile(shape_id):
        """The upper half of a side-view outline about the handle's axis, in the outline's own
        order (so a lip that curls back is kept), as [(r, x)] from the axis round to the axis."""
        loop = max(shape_loops(dwg, shape_id, s_, 0.05), key=lambda lp: abs(_svg_area(lp)))
        loop = [q for i, q in enumerate(loop) if i == 0 or q != loop[i - 1]]
        if loop[0] == loop[-1]:
            loop = loop[:-1]
        ay, n = mc["side_axis_y"], len(loop)
        upper = [q[1] <= ay + 1e-6 for q in loop]
        i0 = next(i for i in range(n) if upper[i] and not upper[i - 1])   # where the outline enters the upper half
        chain = []
        for k in range(n):
            q = loop[(i0 + k) % n]
            if not upper[(i0 + k) % n]:
                break
            chain.append((max(0.0, ay - q[1]), q[0]))
        if chain[0][1] > chain[-1][1]:
            chain.reverse()                                   # from the plate to the front
        prof = ([] if chain[0][0] == 0.0 else [(0.0, chain[0][1])]) + chain
        return prof + ([] if prof[-1][0] == 0.0 else [(0.0, prof[-1][1])])

    mb = MeshBuilder()
    mb.prism(geom.circle(3.0, 24), "XZ", depth(mc["centre"]["front_x"]) + 0.5, pnl0 - 2.6, "steel", smooth=True)
    # the rod, centred on the crank's axis (the drawing has it about 0.2 off)
    rl = shape_loops(dwg, mc["rod"], s_, 0.03)
    rod = max(rl, key=lambda lp: abs(_svg_area(lp)))
    rx0, rx1 = min(q[0] for q in rod), max(q[0] for q in rod)
    rcx = (rx0 + rx1) / 2.0
    rod_mm = [((xd - rcx) * s_, -(yd - cy_) * s_) for xd, yd in rod]
    ry0, ry1 = (depth(v) for v in mc["rod_side_x"])
    mb.prism(rod_mm, "XZ", ry1, ry0, "steel")
    cb = mc["centre"]
    mb.prism(geom.circle(cb["radius"], 32), "XZ", depth(cb["front_x"]), ry1 + 0.3, "steel", smooth=True)
    ha = mc["handle_axis"]
    hz = ha["z"]
    mb.prism([(u, w + hz) for u, w in geom.circle(ha["radius"], 32)], "XZ", depth(ha["front_x"]), ry1 + 0.3, "steel", smooth=True)
    mb.prism([(u, w + hz) for u, w in geom.circle(ha["pin_radius"], 24)], "XZ", depth(ha["pin_front_x"]) - 2.0, depth(ha["front_x"]) - 0.01, "steel", smooth=True)   # 2 into the handle's bore
    lathe_y(mb, side_profile(mc["wood"]), "oak_handle", 0.0, hz, 32)
    mb.cylinder_uvs("oak_handle", (0.0, 0.0, hz), (0.0, -1.0, 0.0), 10.0)   # the grain along the handle, not box-projected
    lathe_y(mb, side_profile(mc["ball"]), "steel", 0.0, hz, 20)
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
    # round holes for the setting knobs' plates, which lie in them flush with this top, a little
    # clear all round (photos: the plates are in the cover's plane)
    hr_ = dl["setting_plate_r"] + p.v(M2 + "setting_handle")["plate"]["cover_gap"]
    knob_holes = [[(u + X[j] + x_pl + pin_g.rp, w + py) for u, w in geom.circle(hr_, 48)] for j in range(C)]
    mb.prism_holes(geom.rect(cx0, ky0, xt, ky1), knob_holes, "XY", kz0, kz1, "brass_polished")
    # lower top on the right, with a round hole under the counter's ring for the sleeve that
    # turns it (the counter's train below, lib/counter_train.py)
    tr_ = p.v(M2 + "counter_train")
    cdx, cdy = X[0] + cs_["counter_dx"], py + cs_["counter_dy"]
    # (the ring round the counter, out to just beyond its outer numbers, is the counter's dial
    # plate: pm.counter_plate, so that the numbers keep their plate when the frame is hidden)
    # the dial reaches past this top's left edge (xt), so the top is one outline with a round bite
    # out of that edge rather than a plate with a hole
    rh = p.v(M2 + "counter")["dial_plate_radius"] + 0.05
    ctp = p.v(M2 + "counter")
    pa0 = math.radians(ctp["park_deg"])
    # the hole the put-away pin stands in
    park_hole = [(u + cdx + ctp["park_r"] * math.cos(pa0), w + cdy + ctp["park_r"] * math.sin(pa0)) for u, w in geom.circle(ctp["hole_radius"], 20)]
    if cdx - rh > xt:
        # the dial lies inside this top: a round hole for it
        mb.prism_holes(geom.rect(xt, ky0, xr, ky1), [[(u + cdx, w + cdy) for u, w in geom.circle(rh, 96)], park_hole], "XY", zt - 2.0, zt, "brass_polished")
    else:
        # the dial reaches past the top's left edge: one outline with a round bite out of it
        hy = math.sqrt(rh * rh - (cdx - xt) ** 2)
        a1 = math.degrees(math.atan2(hy, xt - cdx))          # where the circle leaves the edge at the back
        n_arc = 120
        sweep = 360.0 - 2.0 * (180.0 - a1)                    # the arc inside the plate, clockwise
        arc = [(cdx + rh * math.cos(math.radians(a1 - sweep * i / n_arc)), cdy + rh * math.sin(math.radians(a1 - sweep * i / n_arc))) for i in range(n_arc + 1)]
        mb.prism_holes([(xt, ky0), (xr, ky0), (xr, ky1), (xt, ky1)] + arc, [park_hole], "XY", zt - 2.0, zt, "brass_polished")
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
    # the ring turns anticlockwise when adding (Badur): the pin arrives from the right, so the
    # finger stands just left of the top
    # the stop stands at the top, centred, half a step from the holes and the numbers on both sides
    # (photos of the original and the replica); a wedge as wide, where the holes' circle crosses it,
    # as the gap between two holes less the pin and the gap: the pin in the hole beside it rests on it
    sr0, sr1 = st["strip_r"]
    stop_a = 90.0
    # it stands at the height of the pin's head, its sides pointing at the centre, each the head's
    # radius and the gap from a pin in the hole beside it: the pin's head rests against it
    side = math.radians(18.0) - math.asin((ct["pin_head"]["radius"] + st["gap"]) / hp)
    half_hp = hp * math.tan(side)                           # half its width at the holes' circle
    mb = MeshBuilder()
    # the dial plate: the ring of the carriage's top that carries the outer numbers, flush with it
    # (the top has a hole for it), from the drive sleeve's hole to just beyond the numbers
    sleeve_hole = p.v(M2 + "counter_train")["sleeve_radius"][1] + 0.4
    # cut straight where it passes the top's left edge (xt), flush with the top's bite
    u_cut = xt - dx + 0.05
    rdp = ct["dial_plate_radius"]
    dial = []
    for i in range(192):
        a = 2.0 * math.pi * i / 192
        dial.append((max(rdp * math.cos(a), u_cut), rdp * math.sin(a)))
    mb.prism_holes(dial, [geom.circle(sleeve_hole, 64)], "XY", dz - 2.0, dz, "brass_polished")
    mb.prism(geom.circle(r_in - 0.3, 64), "XY", dz, dz + ct["centre_z"][1], "brass_satin", smooth=True)
    # the centre: a turned steel tower of five rings with a small ball on top (photos of the
    # original and the replica, Brandt's Abb. II 5), standing on the brass centre
    zc = dz + ct["centre_z"][1] - 0.3            # its foot just inside the brass, not on its face
    tower = [(0.0, zc), (6.2, zc), (6.2, zc + 1.2), (5.7, zc + 1.25)]     # the base disc
    # five rounded rings on a cone, each a bulge running into the next (Brandt's Abb. II 5)
    z_lo, z_hi, n_r = zc + 1.2, zc + 9.6, 5
    env = lambda z: 5.7 + (1.9 - 5.7) * (z - z_lo) / (z_hi - z_lo)          # the cone through the bulges
    for i_ in range(n_r):
        for q_ in range(1, 11):
            t_ = q_ / 10.0
            z_ = z_lo + (z_hi - z_lo) * (i_ + t_) / n_r
            tower.append((env(z_) - 0.7 * (1.0 - math.sin(math.pi * t_)), z_))
    tower += [(0.75, z_hi + 0.35), (0.7, z_hi + 0.7)]                        # the neck
    for k_ in range(9):                                                      # the small knob, r 1.05
        a_ = math.radians(-60.0 + 150.0 * k_ / 8)
        tower.append((1.05 * math.cos(a_), z_hi + 1.6 + 1.05 * math.sin(a_)))
    tower.append((0.0, z_hi + 2.65))
    lathe(mb, tower, "steel")
    black, red = [], []
    # as on the original (Badur's photo): the centre's numbers run clockwise from 0 at the stop
    # and count additions (black), the outer circle's anticlockwise and count subtractions (red)
    for k in range(10):
        for rr, a_deg, txt, mat, z, store in ((ct["red_r"], 72.0 - 36.0 * k, str(k), "ink_black", dz + ct["centre_z"][1] + 0.05, black),
                                              (ct["black_r"], 108.0 + 36.0 * k, str(k), "ink_red", dz + 0.05, red)):
            a = math.radians(a_deg)
            gx, gy = rr * math.cos(a), rr * math.sin(a)
            store.append((gx, gy, z))
            verts, faces = bl.glyph_mesh(txt, gs, 0.2)
            # lying on the top, upright for the operator at the front
            mb.add_mesh_data(verts, faces, bl.frame_matrix((gx, gy, z), (1, 0, 0), (0, 1, 0)), mat)
    # the stop: a post outside the ring and a finger over it, in the pin's plane
    # the stop: a tapered steel strip raised over the ring in the pin's neck's plane, its wide end
    # on two screws on the plate beyond the ring, its tip on a screw on the brass centre by the tower
    ua = math.radians(stop_a)
    u_, n_ = (math.cos(ua), math.sin(ua)), (-math.sin(ua), math.cos(ua))
    at_ = lambda r, t: (u_[0] * r + n_[0] * t, u_[1] * r + n_[1] * t)
    wr = lambda r: half_hp * r / hp                       # the wedge's half width: its sides point at the centre
    r_tip = st["tip_width"] / 2.0 * hp / half_hp           # where the wedge narrows to the tip's width
    tw = st["tip_width"] / 2.0
    strip = [at_(sr0, -tw), at_(r_tip, -tw), at_(sr1, -wr(sr1)), at_(sr1, wr(sr1)), at_(r_tip, tw), at_(sr0, tw)]
    sw1 = 2.0 * wr(sr1)
    fz0, fz1 = st["finger_z"]
    mb.prism(strip, "XY", dz + fz0, dz + fz1, "steel")
    leg_o = [at_(sr1 - 2.2, -wr(sr1 - 2.2)), at_(sr1, -wr(sr1)), at_(sr1, wr(sr1)), at_(sr1 - 2.2, wr(sr1 - 2.2))]
    mb.prism(leg_o, "XY", dz - 0.5, dz + fz0 + 0.1, "steel")                     # down to the plate (into it)
    leg_i = [at_(sr0, -tw), at_(sr0 + 2.2, -tw), at_(sr0 + 2.2, tw), at_(sr0, tw)]
    mb.prism(leg_i, "XY", dz + ct["centre_z"][1] - 0.5, dz + fz0 + 0.1, "steel")   # down to the brass centre
    for r_, t_ in ((sr1 - 1.2, -sw1 / 4), (sr1 - 1.2, sw1 / 4), (sr0 + 1.2, 0.0)):  # the screws' heads
        cx_, cy_ = at_(r_, t_)
        mb.prism([(cx_ + q[0], cy_ + q[1]) for q in geom.circle(1.0, 16)], "XY", dz + fz1 - 0.1, dz + fz1 + 0.5, "steel_dark", smooth=True)
    cplate = mb.build("pm.counter_plate", col, (dx, dy, 0))
    bl.set_anchors(cplate, "black_glyphs", black)
    bl.set_anchors(cplate, "red_glyphs", red)
    sa = math.radians(stop_a)
    bl.set_anchors(cplate, "stop_point", [(hp * math.cos(sa), hp * math.sin(sa), dz + sum(st["finger_z"]) / 2.0)])
    bl.parent(cplate, carriage)

    mb = MeshBuilder()
    holes = [[(u + hp * math.cos(math.radians(72.0 + 36.0 * k)), w + hp * math.sin(math.radians(72.0 + 36.0 * k)))
              for u, w in geom.circle(ct["hole_radius"], 20)] for k in range(10)]
    mb.prism_holes(geom.circle(r_out, 96), [geom.circle(r_in, 96)] + holes, "XY", dz + ct["ring_z"][0], dz + ct["ring_z"][1], "steel")
    cring = mb.build("pm.counter_ring", col, (dx, dy, 0))
    bl.set_motion(cring, "rotate", (0, 0, 1), "Revolution counter: ring with 10 holes", "Umdrehungszähler: Ring mit 10 Löchern")
    bl.parent(cring, carriage)

    def pin_mesh(cx, cy, dz_off=0.0):
        # the pin: its stem in the hole, a flat cone resting on the ring, a neck and a big round head
        # (photos of the original and Brandt's Abb. II 5)
        m_ = MeshBuilder()
        sk, hd = ct["pin_skirt"], ct["pin_head"]
        pr_ = ct["pin_radius"]
        prof = [(0.0, dz + ct["pin_z"][0]), (pr_, dz + ct["pin_z"][0]), (pr_, dz + sk["z"][0]),
                (sk["radius"][0], dz + sk["z"][0]), (sk["radius"][0], dz + sk["z"][0] + 0.25), (sk["radius"][1], dz + sk["z"][1]),
                (pr_ - 0.1, dz + sk["z"][1] + 0.3)]
        rh_, hz_ = hd["radius"], dz + hd["centre_z"]
        for k_ in range(13):
            a_ = math.radians(-70.0 + 160.0 * k_ / 12)
            prof.append((rh_ * math.cos(a_), hz_ + rh_ * math.sin(a_)))
        prof.append((0.0, hz_ + rh_))
        lathe(m_, prof, "brass_polished", (cx, cy, dz_off))
        return m_

    a0 = math.radians(72.0)                                # the hole of black (inner) 0, right of the stop
    cpin = pin_mesh(hp * math.cos(a0), hp * math.sin(a0)).build("pm.counter_pin", col, (dx, dy, 0))   # built at black 0, turned to its hole
    bl.set_motion(cpin, "rotate", (0, 0, 1), "Pin of the revolution counter", "Stift des Umdrehungszählers")
    bl.parent(cpin, carriage)
    pa_ = math.radians(ct["park_deg"])
    px_, py_ = ct["park_r"] * math.cos(pa_), ct["park_r"] * math.sin(pa_)
    # put away it stands on the top itself, its cone on the top and its stem in a hole of the top
    mb = pin_mesh(px_, py_, -(ct["pin_skirt"]["z"][0] - 0.05))
    cpark = static(mb.build("pm.counter_pin_park", col, (dx, dy, 0)))   # where the pin waits, shown when it is out
    bl.set_anchors(cpark, "hole", [(px_, py_, dz)])                    # its hole in the top (a click there puts the pin away)
    bl.parent(cpark, carriage)

    # The counter's train (BADUR2026 sheet 8, Burkhardt 1897; lib/counter_train.py): the 17th
    # shaft's single tooth steps the star wheel K a tooth a turn; J on K's axis turns the crown
    # wheel L (the Teilrad) a tooth, 36 deg; M on L's axis turns N on the counter's axis, whose
    # web and sleeve rise through the carriage's top to the ring. K's axis runs front to back
    # under L's, in two lugs from the top; the counter's fixed spindle stands on a cross-bar
    # (Pos. 39, "Traverse") hung from the top on two posts; a leaf holds K between its steps.
    tct, s17, (klx, kz), drv, kspec = counter_train.layout(p)
    ztop = zt - 2.0                                   # the underside of the carriage's top here
    lz_p = kz + tct["j"]["teeth"] * tct["j"]["module"] / 2.0   # J's top on the pitch circle: L's pitch plane
    ky = tct["k"]["y"]
    jy = tct["j"]["y"]
    # K and J on their axle (turning about the front-back axis)
    mb = MeshBuilder()
    k_out, _beta = counter_train.k_outline(p)
    mb.prism_holes(k_out, [geom.circle(1.6, 16)], "XZ", ky[0], ky[1], "steel_dark")
    jspec = geom.GearSpec(tct["j"]["teeth"], tct["j"]["module"], tct["j"]["thickness_factor"])
    mb.prism_holes(geom.gear_outline(jspec, 90.0), [geom.circle(1.6, 16)], "XZ", jy[0], jy[1], "steel_dark")
    lug_y = tct["k_axle_lugs_y"]
    # the axle from K's front collar, through J and both lugs (K in front, J at L's front edge)
    mb.prism(geom.circle(2.0, 20), "XZ", min(ky[0], jy[0]) - 0.6, lug_y[1][1] + 0.5, "steel", smooth=True)   # ends inside the front collar
    for a, b in ((ky[0] - 0.8, ky[0]), (ky[1], ky[1] + 0.8), (jy[0] - 0.8, jy[0]), (jy[1], jy[1] + 0.8)):
        mb.prism(geom.circle(5.0, 24), "XZ", a, b, "brass_satin", smooth=True)    # collars
    ck = mb.build("pm.counter_k", col, (klx, 0, kz))
    bl.set_motion(ck, "rotate", (0, 1, 0), "Revolution counter: star wheel K and gear J", "Umdrehungszähler: Sternrad K und Zahnrad J")
    bl.parent(ck, carriage)
    # L (a crown wheel: rack-profile teeth on its underside, meshing J at right angles) and M
    mb = MeshBuilder()
    lt = tct["l"]
    lpitch = lt["teeth"] * lt["module"] / 2.0                 # 11.25: 10 x 7.07 round the circle
    disc0, disc1 = lz_p + lt["disc_z_above_pitch"][0], lz_p + lt["disc_z_above_pitch"][1]
    mb.prism(geom.circle(lt["r"][1], 64), "XY", disc0, disc1, "brass_polished", smooth=True)
    zroot, ztip = disc0, disc0 - lt["tooth_height"]
    half_p = math.pi * lt["module"] / 4.0                     # half the tooth's width on the pitch line
    tan_a = math.tan(math.radians(20.0))
    for i in range(lt["teeth"]):
        a = math.radians(-90.0 + 18.0 + 36.0 * i)            # a gap faces J (towards the front) at rest
        u, n = (math.cos(a), math.sin(a)), (-math.sin(a), math.cos(a))
        verts = []
        for r in (lt["r"][0], lt["r"][1]):
            sc = r / lpitch                                    # a crown tooth widens outwards
            for t_, z_ in ((-(half_p + (zroot - lz_p) * tan_a) * sc, zroot + 0.05), ((half_p + (zroot - lz_p) * tan_a) * sc, zroot + 0.05),
                           ((half_p - (lz_p - ztip) * tan_a) * sc * 0.9, ztip), (-(half_p - (lz_p - ztip) * tan_a) * sc * 0.9, ztip)):
                verts.append((u[0] * r + n[0] * t_, u[1] * r + n[1] * t_, z_))
        faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
        mb.add_mesh_data(verts, faces, bl.frame_matrix((0, 0, 0), (1, 0, 0), (0, 1, 0)), "brass_polished")
    mt = tct["m"]
    mspec = geom.GearSpec(mt["teeth"], mt["module"], tct["k"]["thickness_factor"], 1.0, 1.25, mt["shift_mm"] / mt["module"])
    mb.prism_holes(geom.gear_outline(mspec, 0.0), [geom.circle(1.6, 16)], "XY", mt["z"][0], mt["z"][1], "brass_polished")
    mb.prism(geom.circle(2.0, 20), "XY", disc0 - 0.5, ztop - 0.3, "steel", smooth=True)
    mb.prism(geom.circle(5.0, 24), "XY", disc1, mt["z"][0], "brass_satin", smooth=True)
    cl = mb.build("pm.counter_l", col, (klx, cdy, 0))
    bl.set_motion(cl, "rotate", (0, 0, 1), "Revolution counter: crown wheel L and gear M", "Umdrehungszähler: Teilrad L und Zahnrad M")
    bl.parent(cl, carriage)
    # N, its web and the sleeve up to the ring: part of the ring (they turn together)
    mb = MeshBuilder()
    nspec = mspec
    mb.prism_holes(geom.gear_outline(nspec, 180.0 + 18.0), [geom.circle(3.3, 24)], "XY", mt["z"][0], mt["z"][1], "brass_polished")
    s0, s1 = tct["sleeve_radius"]
    mb.prism_holes(geom.circle(s1, 72), [geom.circle(3.3, 24)], "XY", mt["z"][1] + 0.5, mt["z"][1] + 1.5, "brass_satin")
    mb.prism_holes(geom.circle(s1, 72), [geom.circle(s0, 72)], "XY", mt["z"][1] + 1.5, zt + 0.12, "brass_satin")  # 0.08 under the ring
    cn = mb.build("pm.counter_n", col, (cdx, cdy, 0))
    bl.set_motion(cn, "rotate", (0, 0, 1), "Revolution counter: gear N and the sleeve to the ring", "Umdrehungszähler: Zahnrad N und Hülse zum Ring")
    bl.parent(cn, carriage)
    # the fixed parts: the lugs, the cross-bar with its posts, the spindle down to it, the leaf
    mb = MeshBuilder()
    for y0_, y1_ in lug_y:
        mb.prism_holes(geom.rect(klx - cdx - 2.5, kz - 3.0, klx - cdx + 2.5, ztop - 0.05), [[(u + klx - cdx, w + kz) for u, w in geom.circle(2.15, 20)]],
                       "XZ", y0_ - cdy, y1_ - cdy, "brass_satin")
    tb = tct["traverse"]
    mb.prism(geom.rect(-tb["width"] / 2.0, -tb["length"] / 2.0, tb["width"] / 2.0, tb["length"] / 2.0), "XY", tb["z"][0], tb["z"][1], "brass_satin")
    for sy in (-1.0, 1.0):
        mb.prism([(u, w + sy * (tb["length"] / 2.0 - 3.0)) for u, w in geom.circle(2.5, 20)], "XY", tb["z"][1], ztop - 0.05, "brass_satin", smooth=True)
    mb.prism(geom.circle(3.0, 24), "XY", tb["z"][0] + 0.5, zt + 0.5, "steel", smooth=True)
    ka = math.radians(tct["leaf_deg"])
    ra = kspec.ra + 0.15
    # the leaf's V tip 0.15 off K's tip circle, every edge outside it (drawn rigid)
    tip = (klx - cdx + ra * math.cos(ka), kz + ra * math.sin(ka))
    ka2 = ka - math.radians(4.0)
    side = (klx - cdx + (ra + 0.6) * math.cos(ka2), kz + (ra + 0.6) * math.sin(ka2))
    leaf = [tip, side, (side[0] + 1.5, ztop - 0.05), (tip[0], ztop - 0.05)]
    ctrain = static(mb.build("pm.counter_frame", col, (cdx, cdy, 0)))
    bl.parent(ctrain, carriage)
    mb = MeshBuilder()
    mb.prism(leaf, "XZ", ky[0] - cdy + 0.2, ky[1] - cdy - 0.2, "steel")
    cleaf = static(mb.build("pm.counter_leaf", col, (cdx, cdy, 0)))
    bl.parent(cleaf, carriage)

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
