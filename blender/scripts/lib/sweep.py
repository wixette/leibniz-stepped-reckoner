"""All-pairs collision sweep over poses exported by the web simulation.

Every part (object with a "motion" property) is tested against every other part that
can move relative to it: parts of one rigid body (static parts of the frame, or static
parts of the carriage together with the carriage) are not tested against each other,
and designed contacts (journals, keyed or meshing parts) are listed in DESIGNED. The
same list is in js/accept/collisions.js.

Kept fast, as it runs often during development:
- a pose only revisits the pairs with a part that moved since the pose before (the others
  are where they were, already tested), unless the hidden parts changed;
- a part's bounding box comes from its local box's 8 corners (a little larger than the
  tight box, never smaller, so no contact is missed);
- a part's world-space BVH tree is rebuilt (with numpy) only when a pair needs a mesh test
  and the tree is not at the part's current place;
- a result is reused when a pair comes back to a relative transform it was tested at.
"""

import math
import re
import time

import bpy
import numpy as np
from mathutils import Quaternion, Vector
from mathutils.bvhtree import BVHTree

MARGIN = 0.00005  # 0.05 mm

DESIGNED = [
    r"^frame\.static~(pi\.sum_wheel|pi\.carry_store|pm\.drum_shaft|pm\.setting_dial|pm\.lever)\.\d+$",
    r"^frame\.lead_screw~frame\.static$",
    r"^pm\.carriage~(pm\.drum_shaft|pm\.setting_dial|pm\.lever)\.\d+$",
    r"^pm\.carriage~pm\.counter_shaft$",  # the drive row's shafts in the carriage frame's bearing bar
    r"^pm\.large_gear_b~pm\.drum_shaft\.4$",  # the large gears are fixed to their shafts
    r"^pm\.large_gear_[ac]~pm\.lever\.\d+$",
    r"^pm\.drum_shaft\.(\d+)~pm\.drum\.\1$",
    r"^pm\.drum_shaft\.(\d+)~pm\.setting_rack\.\1$",  # the drum axis's head slides on its shaft
    r"^pi\.carry_store\.(\d+)~pi\.five_horn_sr?\.\1$",  # the front five-horn sits on the intermediate shaft
    r"^pm\.setting_dial\.(\d+)~pm\.setting_(plate|rack)\.\1$",
    r"^pm\.counter_pin~pm\.counter_ring$",  # the pin sits in a hole of the ring
    r"^pm\.magna_rota~pm\.main_crank$",  # the Magna Rota is fixed to the crank
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
    names = sorted(objs)
    # local geometry: vertices (numpy), faces, and the 8 corners of the local bounding box
    local = {}
    for n, o in objs.items():
        co = np.empty(len(o.data.vertices) * 3, dtype=np.float64)
        o.data.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        lo, hi = co.min(axis=0), co.max(axis=0)
        corners = np.array([[x, y, z, 1.0] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])])
        local[n] = (co, [tuple(p.vertices) for p in o.data.polygons], corners)
    idx = {n: i for i, n in enumerate(names)}
    pa = np.array([idx[a] for a, _ in pairs], dtype=np.int64)
    pb = np.array([idx[b] for _, b in pairs], dtype=np.int64)
    by_part = [[] for _ in names]
    for i in range(len(pairs)):
        by_part[pa[i]].append(i)
        by_part[pb[i]].append(i)
    by_part = [np.array(v, dtype=np.int64) for v in by_part]
    every_pair = np.arange(len(pairs), dtype=np.int64)
    lo_all = np.zeros((len(names), 3))
    hi_all = np.zeros((len(names), 3))

    def apply(values):
        for name, value in values.items():
            o = objs[name]
            loc, rot = rest[name]
            ax = blender_axis(o)
            if o["motion"] == "rotate":
                o.rotation_quaternion = rot @ Quaternion(ax, math.radians(value))
            else:
                o.location = loc + ax * (value / 1000.0)

    mats, mnp, inv = {}, {}, {}
    trees, tree_at = {}, {}

    def tree(n):
        if tree_at.get(n) is not mats[n]:
            m = mnp[n]
            verts = local[n][0] @ m[:3, :3].T + m[:3, 3]
            trees[n] = BVHTree.FromPolygons(verts.tolist(), local[n][1], epsilon=MARGIN)
            tree_at[n] = mats[n]
        return trees[n]

    seen = {}
    fails, worst = {}, {}
    tested = 0
    prev_hidden = None
    t0 = time.time()
    for k, pose in enumerate(poses):
        apply(pose["values"])
        bpy.context.view_layer.update()
        hidden = set(pose.get("hidden", []))
        moved = []
        for n in names:
            mw = objs[n].matrix_world
            if n in mats and mats[n] == mw:
                continue
            mats[n] = mw.copy()
            m = np.array(mats[n])
            mnp[n] = m
            inv[n] = np.linalg.inv(m)   # for the pairs' relative transforms
            w = local[n][2] @ m.T
            lo_all[idx[n]] = w[:, :3].min(axis=0)
            hi_all[idx[n]] = w[:, :3].max(axis=0)
            moved.append(idx[n])
        if hidden != prev_hidden:
            todo = every_pair
            prev_hidden = hidden
        elif moved:
            todo = np.unique(np.concatenate([by_part[i] for i in moved]))
        else:
            continue
        if hidden:
            hid = np.zeros(len(names), dtype=bool)
            hid[[idx[n] for n in hidden if n in idx]] = True
            todo = todo[~(hid[pa[todo]] | hid[pb[todo]])]
        # the pairs whose boxes touch, all at once
        a_, b_ = pa[todo], pb[todo]
        apart = ((lo_all[a_] > hi_all[b_] + MARGIN) | (lo_all[b_] > hi_all[a_] + MARGIN)).any(axis=1)
        for i in todo[~apart].tolist():
            a, b = pairs[i]
            rel = inv[a] @ mnp[b]
            key = (i, np.round(rel, 6).tobytes())
            hits = seen.get(key)
            if hits is None:
                hits = len(tree(a).overlap(tree(b)))
                seen[key] = hits
                tested += 1
            if hits:
                worst[(a, b)] = max(worst.get((a, b), 0), hits)
                fails.setdefault((a, b), pose["label"])
        if k % 500 == 0:
            print(f"  ... {k}/{len(poses)} poses, {tested} pair tests, {time.time() - t0:.0f} s", flush=True)

    for (a, b), label in sorted(fails.items()):
        print(f"PAIR {a:22s} <-> {b:22s} FAIL first at {label} (max {worst[(a, b)]} tri pairs)")
    print(f"checked {len(pairs)} pairs (all moving pairs) x {len(poses)} poses, {tested} distinct pair tests, {time.time() - t0:.0f} s")
    print(f"{tag}_CLEARANCE_OK" if not fails else f"{tag}_CLEARANCE_FAIL {len(fails)} pairs")
    return not fails
