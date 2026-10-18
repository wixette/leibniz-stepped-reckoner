"""bpy helpers: scene reset, materials, and a mesh builder working in millimetres."""

import math

import bpy
from mathutils import Matrix, Vector

MM = 0.001  # Blender scene is in metres; all helper inputs are in mm.


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 1.0
    sc.unit_settings.length_unit = "MILLIMETERS"
    return sc


# --- materials -------------------------------------------------------------------

MATERIALS = {
    # name: (base colour, linear RGB; metallic; roughness; texture kind or None)
    # Metals use measured reflectances (F0) toned down for aged, lacquered brass and
    # polished steel; a brushed-roughness texture breaks up flat plates. Oak gets a grain.
    "brass_polished": ((0.86, 0.64, 0.28), 1.0, 0.20, "brushed"),
    "brass_satin": ((0.78, 0.58, 0.26), 1.0, 0.38, "brushed"),
    "steel": ((0.55, 0.56, 0.58), 1.0, 0.28, "brushed"),
    "steel_dark": ((0.10, 0.11, 0.13), 1.0, 0.35, "brushed"),
    "enamel_white": ((0.85, 0.83, 0.76), 0.0, 0.30, None),
    "ink_black": ((0.02, 0.02, 0.02), 0.0, 0.6, None),
    "ink_red": ((0.62, 0.06, 0.04), 0.0, 0.55, None),
    "wood_dark": ((0.035, 0.022, 0.016), 0.0, 0.35, None),
    "oak": ((0.16, 0.085, 0.04), 0.0, 0.55, "oak"),
}

# Textures repeat every UV_MM millimetres (box-projected UVs, see MeshBuilder.build).
UV_MM = 250.0
TEX_SIZE = {"brushed": 512, "oak": 1024}


def _periodic_noise(rng, n, stretch_u, scale, beta=1.0):
    """Seamless (periodic) noise, n x n, rows = v and columns = u, normalised to 0..1.

    White noise filtered in Fourier space with a 1/f^beta falloff above 1/scale cycles
    per tile; stretch_u > 1 makes features long along u (grain, brushing)."""
    import numpy as np

    fv = np.fft.fftfreq(n)[:, None] * n
    fu = np.fft.fftfreq(n)[None, :] * n
    f = np.sqrt((fu * stretch_u) ** 2 + fv ** 2)
    amp = 1.0 / np.maximum(f, 1.0) ** beta * np.exp(-((f / scale) ** 2))
    amp[0, 0] = 0.0
    w = np.fft.ifft2(np.fft.fft2(rng.standard_normal((n, n))) * amp).real
    w -= w.min()
    return w / max(w.max(), 1e-9)


def _image(name, rgb, non_color):
    """Blender image from an (n, n, 3) array of linear values (rows = v, bottom row first)."""
    import numpy as np

    n = rgb.shape[0]
    img = bpy.data.images.new(name, n, n, alpha=False, float_buffer=False)
    # set the colour space first: changing it regenerates (blanks) a generated image
    img.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
    c = np.clip(rgb, 0.0, 1.0)
    if not non_color:  # pixels of an sRGB byte image are sRGB-encoded
        c = np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)
    px = np.ones((n, n, 4), np.float32)
    px[..., :3] = c
    img.pixels.foreach_set(px.ravel())
    return img


def _texture_images(name, kind, rgb, metallic, rough):
    """(base colour image or None, ORM image: G = roughness, B = metallic) for a material.

    Generated with a fixed seed, so rebuilds give the same .glb."""
    import numpy as np

    rng = np.random.default_rng(sum(map(ord, name)))
    n = TEX_SIZE[kind]
    if kind == "brushed":
        streak = _periodic_noise(rng, n, 40.0, n / 3)        # fine brushing along u
        patch = _periodic_noise(rng, n, 2.0, 12.0)           # soft wear patches
        r = rough * (0.82 + 0.28 * streak + 0.18 * (patch - 0.5))
        color = None
    else:  # oak: long, gently wandering growth rings, open pores, a little figure
        v = np.arange(n)[:, None] / n
        warp = _periodic_noise(rng, n, 1.5, 3.0) - 0.5
        jitter = _periodic_noise(rng, n, 6.0, 40.0) - 0.5
        rings = 0.5 + 0.5 * np.sin(2 * np.pi * (22.0 * v + 1.4 * warp + 0.25 * jitter))
        late = rings ** 4                                     # narrow dark latewood bands
        pores = _periodic_noise(rng, n, 30.0, n / 4)
        pores = np.clip((pores - 0.6) * 4.0, 0.0, 1.0)       # sparse dark streaks
        figure = _periodic_noise(rng, n, 3.0, 10.0)
        t = np.clip(0.4 * late + 0.3 * pores + 0.45 * (figure - 0.5) + 0.2, 0.0, 1.0)[..., None]
        base = np.array(rgb)
        light, dark = base * 1.3, base * 0.6
        color = light * (1 - t) + dark * t
        r = rough * (0.85 + 0.35 * pores + 0.1 * late)
    orm = np.stack([np.ones_like(r), r, np.full_like(r, metallic)], -1)
    img_c = _image(f"{name}_color", color, False) if color is not None else None
    return img_c, _image(f"{name}_orm", orm, True)


def material(name):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    rgb, metallic, rough, kind = MATERIALS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    mat.diffuse_color = (*rgb, 1.0)
    if kind:
        img_c, img_orm = _texture_images(name, kind, rgb, metallic, rough)
        orm = nodes.new("ShaderNodeTexImage")
        orm.image = img_orm
        sep = nodes.new("ShaderNodeSeparateColor")
        links.new(orm.outputs["Color"], sep.inputs["Color"])
        links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
        links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
        if img_c:
            col = nodes.new("ShaderNodeTexImage")
            col.image = img_c
            links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def is_textured(name):
    return MATERIALS[name][3] is not None


# glTF export settings shared by the build scripts: textures as JPEG.
EXPORT_IMAGES = dict(export_image_format="JPEG", export_image_quality=88)


# --- mesh building -------------------------------------------------------------------

# Plane mappings for 2D profiles (u, w) and the extrusion axis.
# "XZ": profile in the X-Z plane, extruded along +Y (shafts running front to back).
# "XY": profile in the X-Y plane, extruded along +Z (vertical shafts).
def _map(plane, u, w, t):
    if plane == "XZ":
        return (u, t, w)
    if plane == "XY":
        return (u, w, t)
    if plane == "YZ":
        return (t, u, w)
    raise ValueError(plane)


def _signed_area(poly):
    a = 0.0
    for i in range(len(poly)):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % len(poly)]
        a += x0 * y1 - x1 * y0
    return a / 2.0


class MeshBuilder:
    """Accumulates polygons (mm, in the node's local frame) with material slots."""

    def __init__(self):
        self.verts = []
        self.faces = []
        self.mat_idx = []
        self.smooth = []
        self.mats = []

    def _mat(self, name):
        if name not in self.mats:
            self.mats.append(name)
        return self.mats.index(name)

    def prism(self, poly, plane, t0, t1, mat, smooth=False, offset=(0.0, 0.0, 0.0)):
        """Extrude a closed 2D polygon from t0 to t1 along the plane's normal axis."""
        if _signed_area(poly) < 0:
            poly = list(reversed(poly))
        mi = self._mat(mat)
        n = len(poly)
        base = len(self.verts)
        ox, oy, oz = offset
        for t in (t0, t1):
            for u, w in poly:
                x, y, z = _map(plane, u, w, t)
                self.verts.append((x + ox, y + oy, z + oz))
        # Orientation: for XZ the extrusion axis +Y gives a left-handed (u,w,t) frame.
        flip = plane == "XZ"
        cap0 = list(range(base, base + n))
        cap1 = list(range(base + n, base + 2 * n))
        if flip:
            self._add(cap0, mi, False)
            self._add(list(reversed(cap1)), mi, False)
        else:
            self._add(list(reversed(cap0)), mi, False)
            self._add(cap1, mi, False)
        for i in range(n):
            a, b = base + i, base + (i + 1) % n
            c, d = b + n, a + n
            self._add([a, d, c, b] if flip else [a, b, c, d], mi, smooth)

    def _add(self, face, mi, smooth):
        self.faces.append(face)
        self.mat_idx.append(mi)
        self.smooth.append(smooth)

    def add_mesh_data(self, verts, faces, matrix, mat):
        """Append raw mesh data (e.g. a converted text glyph) transformed by matrix (mm)."""
        mi = self._mat(mat)
        base = len(self.verts)
        for v in verts:
            p = matrix @ Vector(v)
            self.verts.append((p.x, p.y, p.z))
        for f in faces:
            self._add([base + i for i in f], mi, False)

    def build(self, name, collection, location_mm=(0, 0, 0)):
        me = bpy.data.meshes.new(name)
        me.from_pydata([(x * MM, y * MM, z * MM) for x, y, z in self.verts], [], self.faces)
        me.update()
        for m in self.mats:
            me.materials.append(material(m))
        me.polygons.foreach_set("material_index", self.mat_idx)
        me.polygons.foreach_set("use_smooth", self.smooth)
        me.validate()
        if any(is_textured(m) for m in self.mats):
            _box_uvs(me)
        if hasattr(me, "set_sharp_from_angle"):
            me.set_sharp_from_angle(angle=math.radians(40))
        obj = bpy.data.objects.new(name, me)
        obj.location = tuple(c * MM for c in location_mm)
        collection.objects.link(obj)
        return obj


def _box_uvs(me):
    """Box-projected UVs (1 unit = UV_MM): each face uses the plane across its normal's
    largest axis, with u along X where it can (grain and brushing run along the machine)."""
    import numpy as np

    n = len(me.polygons)
    nrm = np.empty(n * 3, np.float32)
    me.polygons.foreach_get("normal", nrm)
    axis = np.abs(nrm.reshape(n, 3)).argmax(1)
    loop_start = np.empty(n, np.int64)
    loop_total = np.empty(n, np.int64)
    me.polygons.foreach_get("loop_start", loop_start)
    me.polygons.foreach_get("loop_total", loop_total)
    lv = np.empty(len(me.loops), np.int64)
    me.loops.foreach_get("vertex_index", lv)
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3) / (UV_MM * MM)
    loop_axis = np.repeat(axis, loop_total)
    p = co[lv]
    u = np.where(loop_axis == 0, p[:, 1], p[:, 0])
    v = np.where(loop_axis == 2, p[:, 1], p[:, 2])
    uv = me.uv_layers.new(name="UVMap")
    uv.data.foreach_set("uv", np.stack([u, v], 1).ravel().astype(np.float32))


def empty(name, collection, location_mm=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    obj.location = tuple(c * MM for c in location_mm)
    collection.objects.link(obj)
    return obj


def parent(child, par):
    """Parent keeping the child's world position (build-time objects are unrotated).

    The child's location becomes relative to the parent and no parent-inverse matrix
    is used, so the glTF local transforms stay clean and easy to animate."""
    child.parent = par
    child.matrix_parent_inverse.identity()
    child.location = child.location - par.location


def glyph_mesh(text, size_mm, depth_mm):
    """Mesh data (verts in mm, faces) of a centred, extruded text string, facing +Z."""
    curve = bpy.data.curves.new("glyph_tmp", "FONT")
    curve.body = text
    curve.size = size_mm
    curve.extrude = depth_mm / 2.0
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.resolution_u = 3
    obj = bpy.data.objects.new("glyph_tmp", curve)
    bpy.context.scene.collection.objects.link(obj)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    verts = [tuple(v.co) for v in me.vertices]
    faces = [tuple(p.vertices) for p in me.polygons]
    bpy.data.objects.remove(obj)
    bpy.data.curves.remove(curve)
    bpy.data.meshes.remove(me)
    return verts, faces


def frame_matrix(origin, x_axis, y_axis):
    """4x4 matrix mapping local X/Y/Z (Z = X x Y) to the given axes at origin (mm)."""
    x = Vector(x_axis).normalized()
    y = Vector(y_axis).normalized()
    z = x.cross(y)
    m = Matrix.Identity(4)
    for i in range(3):
        m[i][0], m[i][1], m[i][2], m[i][3] = x[i], y[i], z[i], origin[i]
    return m


def gltf_point(p_mm):
    """Blender-local point (mm) -> glTF-local point (m, Y-up)."""
    x, y, z = p_mm
    return [x * MM, z * MM, -y * MM]


def set_anchors(obj, key, points_mm):
    """Store points (node-local, Blender mm) as a flat glTF-local list in extras[key].

    Acceptance tests use anchors to identify features (which glyph is which digit,
    where the gear plane is) without re-deriving the build geometry."""
    flat = []
    for p in points_mm:
        flat += gltf_point(p)
    obj[key] = flat


def set_labels(obj, label_en, label_de):
    """Hover/callout names in English and German (glTF extras), for parts without motion too."""
    obj["label_en"] = label_en
    obj["label_de"] = label_de


def set_explode(obj, offset_mm):
    """Exploded-view offset (Blender mm, in the parent's frame) as glTF-frame mm in extras."""
    x, y, z = offset_mm
    obj["explode"] = [x, z, -y]


def set_motion(obj, motion, axis_blender, label_en, label_de, unit="deg"):
    """Record how the web code animates this node (glTF extras, axis in glTF Y-up)."""
    bx, by, bz = axis_blender
    obj["motion"] = motion
    obj["axis"] = [bx, bz, -by]  # Blender (x, y, z) -> glTF (x, z, -y)
    obj["unit"] = unit
    obj["label_en"] = label_en
    obj["label_de"] = label_de
