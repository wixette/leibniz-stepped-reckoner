"""The carry parts of the original after Klaus Badur's part drawings (no bpy).

BADUR2026, sheet "Einzelteile 3": every carry part is cut as gear teeth of module 1.25
(pressure angle 20 deg, profile shift -0.2):
  five-horn (Pos. 19)   5 teeth of a 20-tooth gear, tip 24.5, hollows R 6.5 between the horns
  ten-wheel (Pos. 17)   a 10-tooth gear, tip 13.5
  Einzahn   (Pos. 18)   one tooth of that 10-tooth gear on a ring
  Zweihorn  (Pos. 21)   two horns over 25.2, tips shaped like the five-horn's teeth
  detent wheel (Pos. 20) 21 across, three notches 18 deg apart in every 72 deg
The five-horn sits half-way between two result shafts and level with them, 18.25 from each
(sheet 2, the register frame); the Zweihorn's axis is 21.6 below it (assembly drawing,
section L-M).

Profiles are closed polygons (u, w) in the plane of the digit, u to the right (+X) and w up
(+Z), with the part's own axis at the origin. Angles in degrees, CCW from +u.
"""

import math

from . import geom


def spec(p):
    """The carry's sizes from params (geometry.carry)."""
    c = p.v("geometry.carry")
    m, x = c["module"], c["profile_shift"]
    big = geom.GearSpec(20, m, c["five_horn"]["thickness_factor"], c["five_horn"]["addendum"], 1.25, x)
    small = geom.GearSpec(10, m, c["ten_wheel"]["thickness_factor"], c["ten_wheel"]["addendum"], c["ten_wheel"]["dedendum"], x)
    return c, big, small


def _flank(g, centre, r_from, samples=8):
    """Right flank (from r_from up), tip, left flank (down to r_from) of one tooth, as (r, deg)."""
    r0 = max(r_from, 0.0)
    rs = [r0 + (g.ra - r0) * i / (samples - 1) for i in range(samples)]
    tip_half = max(0.05, g.flank_half_angle(g.ra))
    right = [(r, centre - g.flank_half_angle(r)) for r in rs]
    tip = [(g.ra, centre - tip_half + 2 * tip_half * (i + 1) / 4) for i in range(3)]
    left = [(r, centre + g.flank_half_angle(r)) for r in reversed(rs)]
    return right + tip + left


def five_horn(p, phase_deg=0.0, arc_samples=14):
    """Five-horn outline: five teeth of the 20-tooth gear at phase + 72 k, joined by concave
    hollows of radius R (the 'Mulden'). Each hollow is an arc centred on the bisector between
    two horns, through the flank points at radius join_r."""
    c, g, _ = spec(p)
    fh = c["five_horn"]
    R, rj = fh["hollow_radius"], fh["join_radius"]
    out = []
    for k in range(5):
        a = phase_deg + 72.0 * k
        pts = _flank(g, a, rj)
        out += [geom._polar(r, d) for r, d in pts]
        # hollow from this horn's left flank point to the next horn's right flank point
        d0 = a + g.flank_half_angle(rj)
        d1 = a + 72.0 - g.flank_half_angle(rj)
        mid = a + 36.0
        p0 = geom._polar(rj, d0)
        # centre on the bisector at distance dc with |p0 - C| = R (the root nearer the hub's far side)
        ang = math.radians(d0 - mid)
        b = -2.0 * rj * math.cos(ang)
        disc = b * b - 4.0 * (rj * rj - R * R)
        dc = (-b + math.sqrt(disc)) / 2.0
        cx, cw = geom._polar(dc, mid)
        t0 = math.atan2(p0[1] - cw, p0[0] - cx)
        p1 = geom._polar(rj, d1)
        t1 = math.atan2(p1[1] - cw, p1[0] - cx)
        # of the two arcs from p0 to p1, take the one passing nearer the axis (the hollow)
        span = (t1 - t0) % (2 * math.pi)
        cands = [span, span - 2 * math.pi]

        def mid_r(s):
            t = t0 + s / 2
            return math.hypot(cx + R * math.cos(t), cw + R * math.sin(t))

        s = min(cands, key=mid_r)
        for i in range(1, arc_samples):
            t = t0 + s * i / arc_samples
            out.append((cx + R * math.cos(t), cw + R * math.sin(t)))
    return out


def hollow_depth(p):
    """Smallest radius of the five-horn's outline (the bottom of a hollow)."""
    return min(math.hypot(u, w) for u, w in five_horn(p))


def ten_wheel(p, first_deg=0.0):
    _, _, g = spec(p)
    return geom.gear_outline(g, first_deg, samples=6, root_samples=3)


def einzahn(p, tooth_deg):
    """The Einzahn (Pos. 18): a ring with one pointed tooth (Detail G: 30 deg included angle, a
    small flat at the tip), its tip tooth_radius from the axis (6.25, shorter than the
    ten-wheel's 6.75, so it reaches the five-horn only 0.25 mm deep)."""
    e = p.v("geometry.carry")["einzahn"]
    ring, rt, ht = e["ring_radius"], e["tooth_radius"], e["tip_half_width"]
    half_base = ht + (rt - ring) * math.tan(math.radians(e["included_angle"] / 2.0))
    a_base = math.degrees(math.asin(half_base / ring))
    n = 72
    out = []
    a0, a1 = tooth_deg + a_base, tooth_deg + 360.0 - a_base
    for i in range(n + 1):
        out.append(geom._polar(ring, a0 + (a1 - a0) * i / n))
    t = math.radians(tooth_deg)
    ux, uw = math.cos(t), math.sin(t)
    nx, nw = -uw, ux
    for r, h in ((ring - 0.2, -half_base), (rt, -ht), (rt, ht), (ring - 0.2, half_base)):
        out.append((ux * r + nx * h, uw * r + nw * h))
    return out


def zweihorn_horn(p):
    """One horn of the Zweihorn along +u, from the lever's hub (hub_radius) to the tip
    (tip_radius, BADUR2026 Pos. 21: 25.2 across): straight flanks narrowing to the tip
    width, the tip rounded with small corner radii (Detail F)."""
    z = p.v("geometry.carry")["zweihorn"]
    r0, r1, rt = z["hub_radius"], z["neck_radius"], z["tip_radius"]
    w0, w1, wt = z["root_half_width"], z["neck_half_width"], z["tip_half_width"]
    cr = z["tip_corner_radius"]
    pts = [(r0, -w0), (r1, -w1), (rt - cr, -wt)]
    # rounded corners: quarter arcs at the two tip corners
    for i in range(1, 5):
        t = -math.pi / 2 + (math.pi / 2) * i / 4
        pts.append((rt - cr + cr * math.cos(t), -wt + cr + cr * math.sin(t)))
    for i in range(0, 4):
        t = (math.pi / 2) * i / 4
        pts.append((rt - cr + cr * math.cos(t), wt - cr + cr * math.sin(t)))
    pts += [(rt - cr, wt), (r1, w1), (r0, w0)]
    return pts


def horn_tip_half_angle(p):
    """Angular half-width (deg) of a Zweihorn horn at its tip: 90 deg between the outer edges
    of the two horns (BADUR2026) is 90 - 2 x this between their centre lines."""
    z = p.v("geometry.carry")["zweihorn"]
    return math.degrees(math.atan2(z["tip_half_width"], z["tip_radius"]))


def detent_wheel(p, first_middle_deg=90.0, land_samples=8):
    """Detent wheel (Rastrad, Pos. 20): in each 72 deg sector three V notches 18 deg apart (the
    middle one shallower), meeting in points at the rim; plain rim between the sectors."""
    d = p.v("geometry.carry")["detent"]
    R, dm, do = d["radius"], d["middle_depth"], d["outer_depth"]
    half = 9.0 - math.degrees(d["point_width"] / 2.0 / R)
    out = []
    for k in range(5):
        c = first_middle_deg + 72.0 * k
        for off, depth in ((-18.0, do), (0.0, dm), (18.0, do)):
            a = c + off
            out += [geom._polar(R, a - half), geom._polar(R - depth, a), geom._polar(R, a + half)]
        # land to the next sector's first notch
        a0, a1 = c + 18.0 + half, c + 72.0 - 18.0 - half
        for i in range(1, land_samples):
            out.append(geom._polar(R, a0 + (a1 - a0) * i / land_samples))
    return out
