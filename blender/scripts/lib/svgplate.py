"""Read a plate drawn as one SVG path (an outer rim and its holes) into polygons in mm.

Used for the Magna Rota's three plates (design/drawings/magna-rota.svg, drawn by the project
owner from K. Badur's saw template and photographs of the original): each plate is a group
whose id is its name, holding one compound path. The path's largest loop is the rim; every
other loop is a hole. Curves are flattened to within `tol` mm, and the plate is centred on its
rim and scaled so that the rim has the given diameter. Pure Python, so it also runs outside
Blender. Only absolute and relative M, L, H, V, C, S, Q, T and Z are understood; Figma's export
uses M, L, H, V, C and Z.
"""

import math
import re
import xml.etree.ElementTree as ET

_TOKEN = re.compile(r"[MmLlHhVvCcSsQqTtZzAa]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")


def _cubic(p0, p1, p2, p3, tol):
    # segments from the control polygon's length: a chord error well under tol
    length = math.dist(p0, p1) + math.dist(p1, p2) + math.dist(p2, p3)
    n = max(2, int(math.ceil(math.sqrt(length / max(tol, 1e-9)) * 1.5)))
    out = []
    for i in range(1, n + 1):
        t = i / n
        u = 1 - t
        out.append((u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                    u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]))
    return out


def path_loops(d, tol):
    """The closed loops of an SVG path's d attribute, as lists of (x, y) in drawing units.
    Supports M/L/H/V/C/S/Q/T/Z (absolute and relative); arcs (A) raise ValueError."""
    toks = _TOKEN.findall(d)
    loops, cur, i = [], [], 0
    pos = start = (0.0, 0.0)
    last_ctrl, last_kind, cmd = None, None, None

    def num():
        nonlocal i
        v = float(toks[i])
        i += 1
        return v

    while i < len(toks):
        if re.match(r"[A-Za-z]", toks[i]):
            cmd = toks[i]
            i += 1
        elif cmd is None or cmd.upper() == "Z":
            raise ValueError(f"SVG path: a number with no command before it ({toks[i]})")
        rel = cmd.islower()
        c = cmd.upper()
        ox, oy = pos if rel else (0.0, 0.0)
        if c == "Z":
            if cur:
                loops.append(cur)
            cur, pos, last_ctrl, last_kind = [], start, None, None
            continue
        if c != "M" and not cur:
            cur = [pos]  # a drawing command right after Z starts a new loop at the subpath's start
        if c == "M":
            if cur:
                loops.append(cur)
            pos = start = (ox + num(), oy + num())
            cur = [pos]
            cmd = "l" if rel else "L"  # further pairs are line-tos
            last_ctrl = None
        elif c == "L":
            pos = (ox + num(), oy + num())
            cur.append(pos)
            last_ctrl = None
        elif c == "H":
            pos = ((pos[0] if rel else 0.0) + num(), pos[1])
            cur.append(pos)
            last_ctrl = None
        elif c == "V":
            pos = (pos[0], (pos[1] if rel else 0.0) + num())
            cur.append(pos)
            last_ctrl = None
        elif c in "CS":
            if c == "C":
                p1 = (ox + num(), oy + num())
            else:
                p1 = (2 * pos[0] - last_ctrl[0], 2 * pos[1] - last_ctrl[1]) if last_ctrl and last_kind == "C" else pos
            p2 = (ox + num(), oy + num())
            p3 = (ox + num(), oy + num())
            cur += _cubic(pos, p1, p2, p3, tol)
            pos, last_ctrl, last_kind = p3, p2, "C"
            continue
        elif c in "QT":
            q = (ox + num(), oy + num()) if c == "Q" else ((2 * pos[0] - last_ctrl[0], 2 * pos[1] - last_ctrl[1]) if last_ctrl and last_kind == "Q" else pos)
            p3 = (ox + num(), oy + num())
            p1 = (pos[0] + 2 / 3 * (q[0] - pos[0]), pos[1] + 2 / 3 * (q[1] - pos[1]))
            p2 = (p3[0] + 2 / 3 * (q[0] - p3[0]), p3[1] + 2 / 3 * (q[1] - p3[1]))
            cur += _cubic(pos, p1, p2, p3, tol)
            pos, last_ctrl, last_kind = p3, q, "Q"
            continue
        else:
            raise ValueError(f"SVG path command {cmd} is not supported")
    if cur:
        loops.append(cur)
    # drop a closing point that repeats the first
    return [lp[:-1] if len(lp) > 2 and math.dist(lp[0], lp[-1]) < 1e-9 else lp for lp in loops]


def _area(loop):
    return 0.5 * sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(loop, loop[1:] + loop[:1]))


def read_plate(svg_file, plate_id, diameter_mm, tol_mm=0.02):
    """(rim, holes) of the plate drawn as group or path `plate_id`, in mm, centred on the rim,
    +x to the right and +y up (the drawing's y points down), rim counter-clockwise and holes
    clockwise."""
    root = ET.parse(svg_file).getroot()
    el = next((e for e in root.iter() if e.get("id") == plate_id), None)
    if el is None:
        raise KeyError(f"{svg_file}: no element with id {plate_id}")
    paths = [e for e in el.iter() if e.tag.endswith("path")]
    if any(e.get("transform") for e in el.iter()):
        raise ValueError(f"{svg_file}: {el.get('id')} has a transform, which this reader does not apply")
    if len(paths) != 1:
        raise ValueError(f"{plate_id}: expected one path, found {len(paths)}")
    raw = path_loops(paths[0].get("d"), 0.05)
    rim_raw = max(raw, key=lambda lp: abs(_area(lp)))
    xs, ys = [p[0] for p in rim_raw], [p[1] for p in rim_raw]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    s = diameter_mm / (max(max(xs) - min(xs), max(ys) - min(ys)))
    loops = [_simplify(lp, tol_mm / s) for lp in path_loops(paths[0].get("d"), tol_mm / s)]
    loops = [[((x - cx) * s, -(y - cy) * s) for x, y in lp] for lp in loops]
    rim = max(loops, key=lambda lp: abs(_area(lp)))
    holes = [lp for lp in loops if lp is not rim]
    if _area(rim) < 0:
        rim = rim[::-1]
    holes = [h if _area(h) < 0 else h[::-1] for h in holes]
    return rim, holes


def plate_frame(svg_file, ref_id, diameter_mm):
    """(scale mm per drawing unit, centre x, centre y) of the plate drawn as `ref_id`, scaled so
    that its rim has the given diameter: other shapes of the same drawing are placed with it."""
    root = ET.parse(svg_file).getroot()
    el = next((e for e in root.iter() if e.get("id") == ref_id), None)
    if el is None:
        raise KeyError(f"{svg_file}: no element with id {ref_id}")
    path = el if el.tag.endswith("path") else next(e for e in el.iter() if e.tag.endswith("path"))
    rim = max(path_loops(path.get("d"), 0.05), key=lambda lp: abs(_area(lp)))
    xs, ys = [q[0] for q in rim], [q[1] for q in rim]
    return diameter_mm / (max(max(xs) - min(xs), max(ys) - min(ys))), (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2


def shape_loops(svg_file, shape_id, scale, tol_mm=0.02):
    """The loops of the path `shape_id` (or the one path in the group `shape_id`), in drawing units,
    flattened to within tol_mm at the given scale (mm per unit)."""
    root = ET.parse(svg_file).getroot()
    el = next((e for e in root.iter() if e.get("id") == shape_id), None)
    if el is None:
        raise KeyError(f"{svg_file}: no element with id {shape_id}")
    paths = [e for e in el.iter() if e.tag.endswith("path")]
    if any(e.get("transform") for e in el.iter()):
        raise ValueError(f"{svg_file}: {el.get('id')} has a transform, which this reader does not apply")
    if len(paths) != 1:
        raise ValueError(f"{shape_id}: expected one path, found {len(paths)}")
    return [_simplify(lp, tol_mm / scale) for lp in path_loops(paths[0].get("d"), tol_mm / scale)]


def _simplify(loop, eps):
    """Douglas-Peucker: drop the points of an open or closed polyline that lie within eps of
    the line through their neighbours kept (the flattened curves have many more than needed)."""
    if len(loop) < 4:
        return loop

    def rdp(pts):
        (x0, y0), (x1, y1) = pts[0], pts[-1]
        dx, dy = x1 - x0, y1 - y0
        ln = (dx * dx + dy * dy) ** 0.5
        best, at = -1.0, 0
        for i in range(1, len(pts) - 1):
            px, py = pts[i]
            d = abs(dy * (px - x0) - dx * (py - y0)) / ln if ln > 0 else ((px - x0) ** 2 + (py - y0) ** 2) ** 0.5
            if d > best:
                best, at = d, i
        if best <= eps:
            return [pts[0], pts[-1]]
        return rdp(pts[: at + 1])[:-1] + rdp(pts[at:])

    # split at the point farthest from the first, so both halves are open polylines
    far = max(range(len(loop)), key=lambda i: (loop[i][0] - loop[0][0]) ** 2 + (loop[i][1] - loop[0][1]) ** 2)
    a = rdp(loop[: far + 1])
    b = rdp(loop[far:] + [loop[0]])
    return a[:-1] + b[:-1]
