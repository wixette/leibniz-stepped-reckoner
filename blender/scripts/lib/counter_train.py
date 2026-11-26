"""The revolution counter's drive (no bpy): the 17th shaft's single tooth steps the star wheel K
one tooth a crank turn; J on K's axis turns the crown wheel L (the "Teilrad") one tooth, 36 deg;
M on L's axis turns N on the counter's axis, and with it the ring (BADUR2026 sheet "Einzelteile 8":
J z 15 m 2.25, K z 15 m 3, L z 10 rack profile m 2.25, M z 10 m 3 with N at 30.7; Burkhardt 1897:
a single tooth on the 17th shaft steps a steel star wheel once a turn; design/v1.3-notes.md).

Frame: the model's (Blender X right, Z up, the digit's plane XZ for the shafts that run front to
back). A part turned by +v about +Y has every feature at local angle - v (as in carry_solve).
"""

import math

from . import geom
from .carry_solve import CONTACT_MARGIN, clearance, rot


def layout(p):
    """Centres (x, z) of the 17th shaft and of K's axis, and the counter train's sizes."""
    ct = p.v("geometry.m2.counter_train")
    dxL, zL = p.v("geometry.m1.lever_axis_dx"), p.v("geometry.m1.lever_axis_z")
    cs = p.v("geometry.m2.carriage_counter_section")
    s17 = (-dxL, zL)                                    # half a place right of the units drum
    cx = cs["counter_dx"]                               # the counter's axis (N)
    lx = cx - ct["mn_centre_distance"]                  # L and M's axis, K and J's axis below it
    # the single tooth: one tooth of a virtual gear, cut 0.8 of a module high (not 1), so that it
    # stays in contact for one of K's teeth only and K is a gap ahead when it arrives
    drv = geom.GearSpec(ct["driver"]["pitch_teeth"], ct["k"]["module"], ct["driver"]["thickness_factor"], ct["driver"]["addendum"])
    k = geom.GearSpec(ct["k"]["teeth"], ct["k"]["module"], ct["k"]["thickness_factor"])
    a = drv.rp + k.rp                                   # the single tooth works like one tooth of a gear
    dx = lx - s17[0]
    kz = s17[1] + math.sqrt(a * a - dx * dx)
    return ct, s17, (lx, kz), drv, k


def driver_tooth(p):
    """The single tooth with its hub (local, on the 17th shaft), pointing at local angle tooth_deg."""
    ct, s17, kc, drv, k = layout(p)
    a = ct["driver"]["tooth_deg"]
    hub = [geom._polar(ct["driver"]["hub_radius"], a + 180.0 + 360.0 * i / 48) for i in range(48)]
    tooth = geom.tooth_polygon(drv, a, root_r=ct["driver"]["hub_radius"] - 0.3)
    # the tooth's root reaches just inside the hub's circle, so the two make one outline (no web)
    return hub, tooth


def k_outline(p):
    ct, s17, kc, drv, k = layout(p)
    # a K tooth on the line of centres at rest, so the single tooth meets its flank
    beta = math.degrees(math.atan2(s17[1] - kc[1], s17[0] - kc[0]))
    return geom.gear_outline(k, beta, samples=7, root_samples=4), beta


def step_table(p, direction=1, step_deg=0.25):
    """K's angle (deg, its node's value) against the crank's |theta| over a whole turn, adding
    (direction 1: the 17th shaft's value +theta) or subtracting (-1), from 0 at rest; the single
    tooth pushes K one tooth (24 deg), then K's detent completes the step."""
    ct, s17, kc, drv, k = layout(p)
    hub, tooth = driver_tooth(p)
    ko, _ = k_outline(p)
    pitch = 360.0 / ct["k"]["teeth"]
    sense = -direction                       # K turns against the shaft (anticlockwise from the front when adding)
    kappa, out = 0.0, []
    n = int(round(360.0 / step_deg))
    for i in range(n + 1):
        th = i * step_deg
        t = rot(tooth, -direction * th, *s17)
        if clearance(t, rot(ko, -kappa, *kc), (s17, 17.0)) < CONTACT_MARGIN:
            # K's teeth repeat, so clearance is not monotonic in its angle: find the first clear
            # angle ahead in small steps, then refine between it and the last overlapping one
            lo, hi = 0.0, 0.05
            while clearance(t, rot(ko, -(kappa + sense * hi), *kc), (s17, 17.0)) < CONTACT_MARGIN:
                lo, hi = hi, hi + 0.05
                if hi > 12.0:
                    raise ValueError(f"the single tooth jams K at theta {th}")
            for _ in range(20):
                mid = (lo + hi) / 2.0
                if clearance(t, rot(ko, -(kappa + sense * mid), *kc), (s17, 17.0)) >= CONTACT_MARGIN:
                    hi = mid
                else:
                    lo = mid
            kappa += sense * hi
        out.append(kappa)
    # the detent completes the step: from where the tooth lets go to a whole tooth, smoothly
    top = max(abs(x) for x in out)
    i_r = next(i for i, x in enumerate(out) if abs(x) >= top - 1e-9)
    if top > pitch + 1e-6:
        raise ValueError(f"the single tooth pushes K {top:.2f} deg, more than a tooth ({pitch})")
    if top < pitch / 2.0:
        raise ValueError(f"the single tooth pushes K only {top:.2f} deg: the detent could not complete it")
    snap = ct["detent_snap_deg"]
    for i in range(i_r, n + 1):
        u = min(1.0, (i - i_r) * step_deg / snap)
        out[i] = sense * (top + (pitch - top) * u * u * (3.0 - 2.0 * u))
    return out
