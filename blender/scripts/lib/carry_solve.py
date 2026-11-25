"""Contact solves for the carry of the original (no bpy): how far the Einzahn pushes the
five-horn p, and how the Zweihorn's horn drives the five-horn s. Pure Python, slow (a minute
or so); run by export_carry_profiles.py, whose output the JavaScript simulator reads.

The solve (like the simulator's pose, js/sim) turns the drive one way; the model is built as its
mirror image, so that adding turns the crank anticlockwise from the front as on the original
(K. Badur, 2026-11-25): js/scene/m2Pose.js negates the rotations and build_m2.py mirrors the
features (the Einzahn's tooth about the line to its store, the ribs and digits about the vertical,
the Zweihorn's horns about the vertical). By symmetry the contacts, and these tables, are the same.

Frame: the digit's plane, u = +X, w = +Z, origin on the intermediate shaft F. The own result
shaft S (with the Einzahn) is at (+cd, 0), the next result shaft (ten-wheel) at (-cd, 0), the
lever L (Zweihorn) at (0, -lever_below_store). A part turned by +phi about +Y (Blender) has
every feature at local angle - phi; the store turns +phi (clockwise seen from the front) when
a carry is stored or executed, the result wheels turn -36 deg per digit (features +36 v).
"""

import math

from . import carry

# The pushed part is kept this far ahead of the pusher: the collision sweep counts anything
# closer than 0.05 mm as touching (lib/sweep.py, MARGIN), and the tables are interpolated.
CONTACT_MARGIN = 0.08


def rot(poly, deg, cx=0.0, cz=0.0):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return [(cx + u * c - w * s, cz + u * s + w * c) for u, w in poly]


def _seg(p, a, b):
    vx, vz = b[0] - a[0], b[1] - a[1]
    n = vx * vx + vz * vz
    t = 0.0 if n == 0 else max(0.0, min(1.0, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / n))
    return math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vz)


def _inside(p, poly):
    x, z = p
    c = False
    n = len(poly)
    for i in range(n):
        x1, z1 = poly[i]
        x2, z2 = poly[(i + 1) % n]
        if (z1 > z) != (z2 > z) and x < x1 + (z - z1) * (x2 - x1) / (z2 - z1):
            c = not c
    return c


def clearance(A, B, near=None):
    """Signed clearance between two polygons: the smallest vertex-to-edge distance, negative
    (minus the deepest such distance) if a vertex of one lies inside the other. near = (point,
    radius) restricts the vertices tested to those within radius of point (both polygons)."""
    if near is not None:
        (cx, cz), r = near
        fa = [q for q in A if math.hypot(q[0] - cx, q[1] - cz) < r]
        fb = [q for q in B if math.hypot(q[0] - cx, q[1] - cz) < r]
    else:
        fa, fb = A, B
    worst, best = 0.0, 1e9
    for X, Y in ((fa, B), (fb, A)):
        n = len(Y)
        for p in X:
            d = min(_seg(p, Y[i], Y[(i + 1) % n]) for i in range(n))
            if _inside(p, Y):
                worst = max(worst, d)
            else:
                best = min(best, d)
    return -worst if worst > 0 else best


class Carry:
    def __init__(self, p):
        self.p = p
        c = p.v("geometry.carry")
        self.c = c
        self.cd, self.lb = c["centre_distance"], c["lever_below_store"]
        self.p_phase, self.s_phase = c["p_phase"], c["s_phase"]
        self.ez_local = c["einzahn"]["tooth_local"]
        self.fh_p = carry.five_horn(p, self.p_phase)
        self.fh_s = carry.five_horn(p, self.s_phase)
        self.ez = carry.einzahn(p, self.ez_local)
        self.tw = carry.ten_wheel(p, c["ten_wheel"]["first_tooth"])
        self.horn = carry.zweihorn_horn(p)
        self.detent_point = 9.0   # between the notches at 0 and 18 (BADUR2026 Pos. 20)

    # --- placed outlines --------------------------------------------------------------
    def p_at(self, store):
        return rot(self.fh_p, -store)

    def s_at(self, store):
        return rot(self.fh_s, -store)

    def ez_at(self, v):
        return rot(self.ez, 36.0 * v, self.cd, 0.0)

    def tw_at(self, v):
        return rot(self.tw, 36.0 * v, -self.cd, 0.0)

    def horn_at(self, alpha):
        return rot(self.horn, alpha, 0.0, -self.lb)

    # --- the Einzahn's push -----------------------------------------------------------------
    def push_table(self, step=0.0025):
        """Store angle (0..18) for v in [9, 10]: the Einzahn's tooth pushes the five-horn p as
        long as they touch; once it lets go, past the detent wheel's point (9 deg), the detent
        spring takes the store on to 18 (smoothly, by v = 10)."""
        near = ((self.cd * 0.6, 0.0), 9.0)
        store, out = 0.0, []
        n = int(round(1.0 / step))
        for i in range(n + 1):
            v = 9.0 + i * step
            ez = self.ez_at(v)
            if clearance(ez, self.p_at(store), near) < CONTACT_MARGIN:
                lo, hi = store, store + 10.0
                for _ in range(40):
                    mid = (lo + hi) / 2.0
                    if clearance(ez, self.p_at(mid), near) >= CONTACT_MARGIN:
                        hi = mid
                    else:
                        lo = mid
                store = hi
            out.append(store)
        top = max(out)
        if top <= self.detent_point:
            raise ValueError(f"the Einzahn pushes the store only {top:.2f} deg, not past the detent's point")
        i_r = out.index(top)
        v_r = 9.0 + i_r * step
        for i in range(i_r + 1, n + 1):
            u = (9.0 + i * step - v_r) / (10.0 - v_r)
            out[i] = top + (18.0 - top) * u * u * (3.0 - 2.0 * u)
        out[-1] = 18.0
        return out

    # --- the Zweihorn's push ----------------------------------------------------------------
    def zweihorn_table(self, step=0.05, span=70.0):
        """Store angle (adding) against the horn's world angle alpha, from first contact with a
        store at 18 deg. Returns (alpha_first_contact, [store...]) sampled every `step` deg."""
        b_lf = 90.0   # lever -> store: straight up (the lever is under its store)
        store, start, tab = 18.0, None, []
        a = b_lf - span
        while a <= b_lf + span:
            h = self.horn_at(a)
            tip = h[len(h) // 2]
            near = (tip, 9.0)
            if clearance(h, self.s_at(store), near) < CONTACT_MARGIN:
                if start is None:
                    start = a
                lo, hi = store, store + 8.0
                while clearance(h, self.s_at(hi), near) < CONTACT_MARGIN:
                    hi += 8.0
                for _ in range(40):
                    mid = (lo + hi) / 2.0
                    if clearance(h, self.s_at(mid), near) >= CONTACT_MARGIN:
                        hi = mid
                    else:
                        lo = mid
                store = hi
            if start is not None:
                tab.append(store)
            a += step
        if start is None:
            raise ValueError("the Zweihorn never touches a stored five-horn: check geometry.carry")
        last = len(tab) - 1
        while last > 0 and tab[last] == tab[last - 1]:
            last -= 1
        return start, tab[:last + 1]
