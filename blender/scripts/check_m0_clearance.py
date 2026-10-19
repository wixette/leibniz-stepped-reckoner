"""Collision sweep for the M0 slice.

Poses the parts through every relevant motion range and tests moving pairs for
mesh intersection (BVH overlap with a small clearance margin).

  Blender --background --factory-startup --python check_m0_clearance.py -- [--quick]
Prints one line per pair and ends with M0_CLEARANCE_OK or M0_CLEARANCE_FAIL.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

import build_m0_slice  # noqa: E402
from lib import kinematics, params, pose  # noqa: E402

MARGIN = 0.00005  # 0.05 mm, in metres


def tree(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    mw = obj.matrix_world
    me = obj.data
    verts = [mw @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    return BVHTree.FromPolygons(verts, polys, epsilon=MARGIN)


def hits(a, b):
    return len(tree(a).overlap(tree(b)))


def bbox(obj):
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    lo = [min(p[i] for p in pts) * 1000 for i in range(3)]
    hi = [max(p[i] for p in pts) * 1000 for i in range(3)]
    return lo, hi


def main():
    quick = "--quick" in sys.argv
    p = params.load()
    o = build_m0_slice.build(p)
    kin = kinematics.Kin(p)
    pose.apply(o, kin, 0, 0, 0)
    bpy.context.view_layer.update()
    for name in ("shaft", "drum", "rack", "dial", "plate", "wheel", "store", "window", "frame"):
        lo, hi = bbox(o[name])
        print(f"BBOX {o[name].name:22s} x[{lo[0]:7.1f},{hi[0]:7.1f}] y[{lo[1]:7.1f},{hi[1]:7.1f}] z[{lo[2]:7.1f},{hi[2]:7.1f}]")

    failures = []

    def sweep(label, pairs, poses):
        worst = 0
        first = None
        for st in poses:
            pose.apply(o, kin, **st)
            bpy.context.view_layer.update()
            for a, b in pairs:
                n = hits(o[a], o[b])
                if n:
                    worst = max(worst, n)
                    if first is None:
                        first = (a, b, st, n)
        status = "OK" if first is None else "FAIL"
        print(f"PAIR {label:40s} poses={len(poses):5d} {status}" + ("" if first is None else f" first={first}"))
        if first:
            failures.append(label)

    dt = 3.0 if quick else 0.75
    thetas = [i * dt for i in range(int(360 / dt) + 1)]
    sweep("drum ribs <-> receiving gear (add)", [("drum", "wheel")],
          [dict(setting=s, digit_start=0, theta=t) for s in range(10) for t in thetas])
    sweep("drum ribs <-> receiving gear (subtract)", [("drum", "wheel")],
          [dict(setting=s, digit_start=9, theta=-t) for s in (1, 5, 9) for t in thetas])
    sweep("drum/rack <-> frame, window", [("drum", "frame"), ("rack", "frame"), ("drum", "window")],
          [dict(setting=s, digit_start=0, theta=t) for s in range(10) for t in thetas[::8]])
    sweep("drum collar <-> rack fork", [("drum", "rack")],
          [dict(setting=s, digit_start=0, theta=t) for s in range(10) for t in thetas[::4]])
    sweep("pinion <-> rack (dialling)", [("dial", "rack")],
          [dict(setting=s / 20.0, digit_start=0, theta=0) for s in range(0, 181)])
    sweep("Einzahn <-> Fünfhorn (carry)", [("wheel", "store")],
          [dict(setting=1, digit_start=9, theta=t) for t in thetas])
    sweep("Einzahn <-> Fünfhorn (borrow)", [("wheel", "store")],
          [dict(setting=1, digit_start=0, theta=-t) for t in thetas])
    sweep("Einzahn <-> Fünfhorn (stored, not executed)", [("wheel", "store")],
          [dict(setting=1, digit_start=9, theta=t, executes=False) for t in thetas]
          + [dict(setting=1, digit_start=0, theta=-t, executes=False) for t in thetas])
    sweep("Einzahn <-> Fünfhorn (no carry)", [("wheel", "store")],
          [dict(setting=s, digit_start=d, theta=t) for s in (3, 9) for d in (0, 4) for t in thetas[::4]])
    sweep("wheel/store <-> window", [("wheel", "window"), ("store", "window")],
          [dict(setting=9, digit_start=9, theta=t) for t in thetas[::4]])
    print("M0_CLEARANCE_OK" if not failures else f"M0_CLEARANCE_FAIL {failures}")
    return not failures


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
