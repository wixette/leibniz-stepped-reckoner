"""All-pairs collision sweep over poses exported by the web simulation.

Every part (object with a "motion" property) is tested against every other part that
can move relative to it: parts of one rigid body (static parts of the frame, or static
parts of the carriage together with the carriage) are not tested against each other,
and designed contacts (journals, keyed or meshing parts) are listed in DESIGNED. The
same list is in js/accept/collisions.js.

World-space BVH trees are rebuilt only for parts that moved; pairs whose bounding boxes
are apart are skipped, and a result is reused when a pair comes back to a relative
transform it has already been tested at.
"""

import math
import re
import time

import bpy
from mathutils import Quaternion, Vector
from mathutils.bvhtree import BVHTree

MARGIN = 0.00005  # 0.05 mm

DESIGNED = [
    r"^frame\.static~(pi\.sum_wheel|pi\.carry_store|pm\.drum_shaft|pm\.setting_dial|pm\.lever)\.\d+$",
    r"^frame\.lead_screw~frame\.static$",
    r"^pm\.carriage~(pm\.drum_shaft|pm\.setting_dial)\.\d+$",
    r"^pm\.drum_shaft\.(\d+)~pm\.drum\.\1$",
    r"^pm\.setting_dial\.(\d+)~pm\.setting_(plate|rack)\.\1$",
    r"^pm\.magna_pin~pm\.magna_rota$",
]
_DESIGNED = [re.compile(r) for r in DESIGNED]


def designed(a, b):
    return any(r.match(f"{a}~{b}") or r.match(f"{b}~{a}") for r in _DESIGNED)


def blender_axis(obj):
    gx, gy, gz = obj["axis"]
    return Vector((gx, -gz, gy))  # glTF (x, y, z) -> Blender (x, -z, y)


def parts(carriage="pm.carriage"):
    objs = {o.name: o for o in bpy.data.objects if o.type == "MESH" and "motion" in o}
    car = bpy.data.objects.get(carriage)

    def on_carriage(o):
        while o is not None:
            if o == car:
                return True
            o = o.parent
        return False

    info = {n: (on_carriage(o), o["motion"] == "static" or o == car) for n, o in objs.items()}
    return objs, info


def all_pairs(objs, info):
    names = sorted(objs)
    pairs = []
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            (ca, ra), (cb, rb) = info[a], info[b]
            if ca == cb and ra and rb:
                continue
            if designed(a, b):
                continue
            pairs.append((a, b))
    return pairs


def run(poses, tag):
    """Replay poses ({"values": {name: value}, "hidden": [...], "label": str}); print a report."""
    objs, info = parts()
    rest = {n: (o.location.copy(), o.rotation_quaternion.copy()) for n, o in objs.items()}
    for o in objs.values():
        o.rotation_mode = "QUATERNION"
    pairs = all_pairs(objs, info)
    local = {n: ([v.co.copy() for v in o.data.vertices], [tuple(p.vertices) for p in o.data.polygons]) for n, o in objs.items()}

    def apply(values):
        for name, value in values.items():
            o = objs[name]
            loc, rot = rest[name]
            ax = blender_axis(o)
            if o["motion"] == "rotate":
                o.rotation_quaternion = rot @ Quaternion(ax, math.radians(value))
            else:
                o.location = loc + ax * (value / 1000.0)

    trees, boxes, mats = {}, {}, {}
    seen = {}
    fails, worst = {}, {}
    tested = 0
    t0 = time.time()
    for k, pose in enumerate(poses):
        apply(pose["values"])
        bpy.context.view_layer.update()
        hidden = set(pose.get("hidden", []))
        for n, o in objs.items():
            mw = o.matrix_world.copy()
            if n in mats and mats[n] == mw:
                continue
            mats[n] = mw
            verts = [mw @ v for v in local[n][0]]
            trees[n] = BVHTree.FromPolygons(verts, local[n][1], epsilon=MARGIN)
            lo = Vector((min(v.x for v in verts), min(v.y for v in verts), min(v.z for v in verts)))
            hi = Vector((max(v.x for v in verts), max(v.y for v in verts), max(v.z for v in verts)))
            boxes[n] = (lo, hi)
        for a, b in pairs:
            if a in hidden or b in hidden:
                continue
            (la, ha), (lb, hb) = boxes[a], boxes[b]
            if any(la[i] > hb[i] + MARGIN or lb[i] > ha[i] + MARGIN for i in range(3)):
                continue
            rel = mats[a].inverted() @ mats[b]
            key = (a, b, tuple(round(x, 6) for row in rel for x in row))
            hits = seen.get(key)
            if hits is None:
                hits = len(trees[a].overlap(trees[b]))
                seen[key] = hits
                tested += 1
            if hits:
                worst[(a, b)] = max(worst.get((a, b), 0), hits)
                fails.setdefault((a, b), pose["label"])
        if k % 500 == 0:
            print(f"  ... {k}/{len(poses)} poses, {tested} pair tests, {time.time() - t0:.0f} s", flush=True)

    for (a, b), label in sorted(fails.items()):
        print(f"PAIR {a:22s} <-> {b:22s} FAIL first at {label} (max {worst[(a, b)]} tri pairs)")
    print(f"checked {len(pairs)} pairs (all moving pairs) x {len(poses)} poses, {tested} distinct pair tests")
    print(f"{tag}_CLEARANCE_OK" if not fails else f"{tag}_CLEARANCE_FAIL {len(fails)} pairs")
    return not fails
