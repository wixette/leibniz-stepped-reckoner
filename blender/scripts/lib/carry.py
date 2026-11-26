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


def zweihorn_horn(p, key="zweihorn"):
    """One horn of the Zweihorn along +u, from the lever's hub (hub_radius) to the tip
    (tip_radius, BADUR2026 Pos. 21: 25.2 across): straight flanks narrowing to the tip
    width, the tip rounded with small corner radii (Detail F). key "ripple_zweihorn": the
    ripple set's longer horn (our design, design/v1.3-notes.md)."""
    z = p.v("geometry.carry")[key]
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


def ripple_star(p, phase_deg):
    """The ripple set's front five-horn s' (our design, in the original's style): five horns
    tapering from a broad root to a rounded tip, joined by concave hollows whose bottom lies on
    hollow_radius; the Zweihorn strikes them near the hub, so the store turns fast."""
    r = p.v("geometry.carry")["ripple_star"]
    rt, wt, cr = r["tip_radius"], r["tip_half_width"], r["tip_corner_radius"]
    rr, wr, hb = r["root_radius"], r["root_half_width"], r["hollow_radius"]
    out = []
    for k in range(5):
        c = math.radians(phase_deg + 72.0 * k)
        ux, uw = math.cos(c), math.sin(c)
        nx, nw = -uw, ux

        def at(rad, off):
            return (ux * rad + nx * off, uw * rad + nw * off)

        horn = [at(rr, -wr), at(rt - cr, -wt)]
        for i in range(1, 5):
            t = -math.pi / 2 + (math.pi / 2) * i / 4
            horn.append(at(rt - cr + cr * math.cos(t), -wt + cr + cr * math.sin(t)))
        for i in range(0, 4):
            t = (math.pi / 2) * i / 4
            horn.append(at(rt - cr + cr * math.cos(t), wt - cr + cr * math.sin(t)))
        horn += [at(rt - cr, wt), at(rr, wr)]
        out += horn
        # the hollow to the next horn: an arc through this horn's left root, the bottom of the
        # hollow on the bisector, and the next horn's right root
        p0 = at(rr, wr)
        c1 = c + math.radians(72.0)
        p2 = (math.cos(c1) * rr - math.sin(c1) * -wr, math.sin(c1) * rr + math.cos(c1) * -wr)
        mid = c + math.radians(36.0)
        p1 = (hb * math.cos(mid), hb * math.sin(mid))
        ax, ay = p0; bx, by = p1; qx, qy = p2
        d = 2 * (ax * (by - qy) + bx * (qy - ay) + qx * (ay - by))
        ox = ((ax * ax + ay * ay) * (by - qy) + (bx * bx + by * by) * (qy - ay) + (qx * qx + qy * qy) * (ay - by)) / d
        oy = ((ax * ax + ay * ay) * (qx - bx) + (bx * bx + by * by) * (ax - qx) + (qx * qx + qy * qy) * (bx - ax)) / d
        R = math.hypot(ax - ox, ay - oy)
        t0, t1 = math.atan2(ay - oy, ax - ox), math.atan2(qy - oy, qx - ox)
        tm = math.atan2(by - oy, bx - ox)
        # go from t0 to t1 through tm
        span = (t1 - t0) % (2 * math.pi)
        if ((tm - t0) % (2 * math.pi)) > span:
            span -= 2 * math.pi
        for i in range(1, 10):
            t = t0 + span * i / 10
            out.append((ox + R * math.cos(t), oy + R * math.sin(t)))
    return out


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


def _ray(poly, deg):
    """Farthest distance from the origin to poly along the ray at deg (0 if the ray misses it)."""
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    best = 0.0
    n = len(poly)
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        ex, ey = x2 - x1, y2 - y1
        den = c * ey - s * ex
        if abs(den) < 1e-12:
            continue
        t = (x1 * ey - y1 * ex) / den          # distance along the ray
        u = (x1 * s - y1 * c) / den            # position along the edge
        if t > 0 and -1e-9 <= u <= 1 + 1e-9:
            best = max(best, t)
    return best


def star_union(polys, step=2.0):
    """Outline of the union of polygons that are all star-shaped about the origin (a hub and
    horns radiating from it): at every angle the farthest boundary. Sampled at every vertex's
    angle and every `step` degrees, with the angles where the outermost polygon changes found by
    bisection, so straight edges stay straight and corners stay sharp."""
    angs = {round(k * step, 9) for k in range(int(360 / step))}
    for poly in polys:
        for x, y in poly:
            angs.add(math.degrees(math.atan2(y, x)) % 360.0)
    angs = sorted(angs)

    def best(a):
        rs = [_ray(q, a) for q in polys]
        i = max(range(len(rs)), key=lambda k: rs[k])
        return rs[i], i

    out, prev = [], None
    for a in angs + [angs[0] + 360.0]:
        r, i = best(a)
        if prev is not None and prev[2] != i:
            lo, hi = prev[0], a
            for _ in range(30):
                mid = (lo + hi) / 2.0
                if best(mid)[1] == prev[2]:
                    lo = mid
                else:
                    hi = mid
            rm = best(hi)[0]
            out.append(geom._polar(rm, hi))
        out.append(geom._polar(r, a))
        prev = (a, r, i)
    return out[:-1]


def zweihorn_part(p, spread_deg, key="zweihorn", first_deg=180.0):
    """One Zweihorn (BADUR2026 Pos. 21: one part, two horns): the hub with the adding horn at
    first_deg and the subtracting horn spread_deg further on (counter-clockwise), as one outline."""
    z = p.v("geometry.carry")[key]
    horn = zweihorn_horn(p, key)

    def turned(poly, deg):
        c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
        return [(u * c - w * s, u * s + w * c) for u, w in poly]

    hub = [geom._polar(z["hub_radius"], 360.0 * i / 180) for i in range(180)]
    return star_union([hub, turned(horn, first_deg), turned(horn, first_deg + spread_deg)])
