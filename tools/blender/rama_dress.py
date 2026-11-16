# What Rama wears and carries, made on the finished body. This file is run by build_rama.py in its own namespace
# (it uses `human`, `base`, `V`, `J`, `JT`, `body`, `parts`, `bind`, `smooth` and the material makers from there).
#
# Cloth is cut from MakeHuman's own "tights" helper (a loose skin of quads that follows the body) or laid onto the
# body by casting rays at it; beads are small balls set along lines found the same way.
import random

random.seed(7)
body_bvh = bvh_of(body)
S = height / 1.80  # his size against a man of 1.80 m: lengths below are given for that man
Y_AXIS, Z_AXIS = Vector((0, 1, 0)), Vector((0, 0, 1))
waist_z = J['pelvis'].z + 0.085 * S
crotch_z = min(J['thigh_l'].z, J['thigh_r'].z) - 0.085 * S
ankle_z = J['foot_l'].z + 0.055 * S
knee_z = J['calf_l'].z
neck_z = J['neck_01'].z

SAFFRON = cloth('Dhoti (yellow silk)', (0.86, 0.5, 0.06), roughness=0.62)
ORANGE = cloth('Sash (orange)', (0.78, 0.2, 0.03), roughness=0.7)
YELLOW = cloth('Shoulder cloth (yellow)', (0.9, 0.62, 0.1), roughness=0.66)
RUDRAKSHA = plain('Rudraksha', (0.16, 0.07, 0.035), roughness=0.62, bump=(260.0, 0.9, 0.0012))
KUMKUM = plain('Tilak (kumkum)', (0.62, 0.02, 0.02), roughness=0.8)
HAIR = strands('Topknot hair', (0.022, 0.017, 0.015))
WOOD = plain('Bow wood', (0.1, 0.045, 0.02), roughness=0.38, bump=(40.0, 0.25, 0.0008))
GOLD = plain('Gold', (0.9, 0.62, 0.2), roughness=0.3, metallic=1.0)
STRING = plain('Bowstring', (0.72, 0.66, 0.52), roughness=0.8)
LEATHER = plain('Quiver leather', (0.2, 0.09, 0.04), roughness=0.55, bump=(120.0, 0.4, 0.0008))
FEATHER = plain('Fletching', (0.86, 0.84, 0.78), roughness=0.7)


over_cloth = None  # body and shoulder cloth together, once the cloth is made


def cast(origin, direction, reach=2.0, bvh=None):
    """The first point of the body met from `origin` going along `direction`, with the way the surface faces there."""
    hit, normal, _, _ = (bvh or body_bvh).ray_cast(Vector(origin), Vector(direction).normalized(), reach)
    return hit, normal


def nearest(point, bvh=None):
    loc, normal, _, _ = (bvh or body_bvh).find_nearest(Vector(point))
    return loc, normal


def grid(name, rows, closed_u=False, closed_v=False):
    """A sheet through rows of points (each row the same length)."""
    nu, nv = len(rows), len(rows[0])
    verts = [p for row in rows for p in row]
    faces = []
    for i in range(nu if closed_u else nu - 1):
        for j in range(nv if closed_v else nv - 1):
            a, b = i * nv + j, i * nv + (j + 1) % nv
            c, d = ((i + 1) % nu) * nv + (j + 1) % nv, ((i + 1) % nu) * nv + j
            faces.append((a, b, c, d))
    return make_mesh(name, verts, faces)


def thicken(obj, thickness):
    mod = obj.modifiers.new('cloth thickness', 'SOLIDIFY')
    mod.thickness = thickness
    mod.offset = 1.0
    return mod


# --- the dhoti: the tights helper from waist to ankle, let out round the legs and gathered into folds ---
tights = [i for i in base.faces_of('helper-tights') if any(ankle_z <= V[v][2] <= waist_z + 0.02 * S for v in base.faces[i]) and all(abs(V[v][0]) < 0.36 * S for v in base.faces[i])]
dhoti, dhoti_ids = from_obj('Rama_dhoti', base, human.verts, tights)
mesh = dhoti.data
for v in mesh.vertices:
    v.co.z = min(max(v.co.z, ankle_z), waist_z + 0.02 * S)
mesh.update()
normals = [v.normal.copy() for v in mesh.vertices]
for v, n in zip(mesh.vertices, normals):
    p = v.co
    side = 1.0 if p.x >= 0 else -1.0
    thigh, foot = (J['thigh_l'], J['foot_l']) if side > 0 else (J['thigh_r'], J['foot_r'])
    t = max(0.0, min(1.0, (p.z - ankle_z) / (crotch_z - ankle_z)))
    # down the leg the cloth stands off the leg's own middle line; above the fork it stands off the hips
    centre = foot.lerp(thigh, t)
    out = Vector((p.x - centre.x, p.y - centre.y, 0.0))
    out = out.normalized() if out.length > 1e-5 else Vector((side, 0, 0))
    angle = math.atan2(out.y, out.x)
    full = t * t * (3 - 2 * t)
    loose = (0.012 + 0.05 * math.sin(math.pi * min(1.0, t * 1.15) ** 0.8) + 0.018 * full) * S
    outer = 0.5 + 0.5 * side * out.x  # the two legs of it are kept from running into each other
    loose *= 0.35 + 0.65 * outer
    folds = 0.012 * S * math.sin(angle * 8.0 + p.z * 11.0) * min(1.0, t * 4.0) + 0.006 * S * math.sin(angle * 17.0 - p.z * 23.0)
    above = max(0.0, min(1.0, (p.z - crotch_z) / (0.06 * S)))
    hip_folds = 0.004 * S * math.sin(math.atan2(p.y, p.x) * 22.0 + p.z * 30.0)
    leg = out * (loose + folds)
    hip = Vector((n.x, n.y, 0.0)).normalized() * (0.012 * S + hip_folds) if Vector((n.x, n.y)).length > 1e-4 else Vector()
    v.co = p + leg.lerp(hip, above)
mesh.update()
assign(dhoti, SAFFRON)
bind(dhoti, from_body=True)
thicken(dhoti, 0.0025)
smooth(dhoti, 1, 2)

# the pleats let fall in front of it: a fan of folds from the waist to below the knee
front, _ = cast((0, -1.0, waist_z - 0.1 * S), (0, 1, 0))
rows = []
for i in range(11):
    f = i / 10
    z = waist_z - 0.02 * S - f * (waist_z - knee_z + 0.14 * S)
    width = (0.1 + 0.13 * f) * S
    y0 = front.y - (0.045 + 0.03 * math.sin(f * math.pi)) * S
    row = []
    for c in range(15):
        u = c / 14 - 0.5
        row.append(Vector((u * width + 0.012 * S * math.sin(f * 5.0 + c), y0 - (0.02 * S if c % 2 else 0.0) * (0.5 + f) + 0.01 * S * abs(u) * 2, z)))
    rows.append(row)
pleats = grid('Rama_dhoti_pleats', rows)
assign(pleats, SAFFRON)
bind(pleats, to_bone='pelvis')
thicken(pleats, 0.002)
smooth(pleats, 1, 2)

# --- the sash round the hips, knotted at his right, its two ends hanging ---
band = [i for i in base.faces_of('helper-tights') if any(waist_z - 0.115 * S <= V[v][2] <= waist_z + 0.04 * S for v in base.faces[i]) and all(abs(V[v][0]) < 0.36 * S for v in base.faces[i])]
sash, _ = from_obj('Rama_sash', base, human.verts, band)
for v in sash.data.vertices:
    v.co.z = min(max(v.co.z, waist_z - 0.115 * S), waist_z + 0.04 * S)
sash.data.update()
for v in sash.data.vertices:
    n = Vector((v.normal.x, v.normal.y, 0.0))
    n = n.normalized() if n.length > 1e-4 else Vector()
    a = math.atan2(v.co.y, v.co.x)
    v.co = v.co + n * (0.021 * S + 0.005 * S * math.sin(v.co.z * 85.0 + a * 3.0) + 0.003 * S * math.sin(v.co.z * 190.0 - a * 5.0))
sash.data.update()
assign(sash, ORANGE)
bind(sash, to_bone='pelvis')
thicken(sash, 0.005)
smooth(sash, 1, 2)

knot_dir = Vector((-0.62, -0.78, 0)).normalized()
knot_hit, _ = cast(Vector((0, 0, waist_z - 0.04 * S)) + knot_dir, -knot_dir)
knot_at = knot_hit + knot_dir * 0.05 * S
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.048 * S)
for v in bm.verts:
    v.co = Vector((v.co.x * 1.15, v.co.y * 0.8, v.co.z * 0.9 + 0.006 * math.sin(v.co.x * 90))) + knot_at
knot_mesh = bpy.data.meshes.new('Rama_sash_knot')
bm.to_mesh(knot_mesh); bm.free()
knot = link(bpy.data.objects.new('Rama_sash_knot', knot_mesh))
knot_mesh.polygons.foreach_set('use_smooth', [True] * len(knot_mesh.polygons))
assign(knot, ORANGE)
bind(knot, to_bone='pelvis')
smooth(knot, 1, 2)
across = Vector((-knot_dir.y, knot_dir.x, 0))
for n, (length, lean, wide) in enumerate([(0.4, 0.08, 0.11), (0.31, -0.07, 0.095)]):
    rows = []
    for i in range(9):
        f = i / 8
        mid = knot_at + across * (lean * f * S + (0.02 if n else -0.02) * S) + knot_dir * (0.012 + 0.02 * math.sin(f * 3.0 + n)) * S + Vector((0, 0, -f * length * S))
        row = []
        for c in range(7):
            u = c / 6 - 0.5
            row.append(mid + across * u * wide * S * (0.7 + 0.5 * f) + knot_dir * 0.012 * S * math.sin(u * 14.0 + f * 4.0))
        rows.append(row)
    tail = grid(f'Rama_sash_end_{n + 1}', rows)
    assign(tail, ORANGE)
    bind(tail, to_bone='pelvis')
    thicken(tail, 0.003)
    smooth(tail, 1, 2)

# --- the cloth over his left shoulder, across the chest and back to his right hip ---
L = Vector(((J['neck_01'].x + J['upperarm_l'].x) * 0.5 + 0.02 * S, 0.0, J['upperarm_l'].z + 0.07 * S))
R = Vector((-0.2 * S, 0.0, waist_z + 0.01 * S))
C = (L + R) * 0.5
C.y = J['spine_02'].y
u_ax = (L - R).normalized()
n_ax = u_ax.cross(Y_AXIS).normalized()  # across the cloth: toward his right shoulder
STEPS, ACROSS = 72, 11
rows = []
for i in range(STEPS):
    th = 2 * math.pi * i / STEPS
    d = (u_ax * math.cos(th) + Y_AXIS * math.sin(th)).normalized()
    hit, _ = cast(C + d * 1.4, -d, 1.4)
    if hit is None:
        hit = C
    # widest across the chest and the back, gathered narrow on the shoulder and at the hip
    width = (0.115 + 0.15 * abs(math.sin(th)) ** 0.8) * S
    row = []
    for k in range(ACROSS):
        s = (k / (ACROSS - 1) - 0.5) * width
        q = hit + n_ax * s
        h2, _ = cast(q + d * 0.45, -d, 0.9)
        if h2 is None or (h2 - q).length > 0.16 * S:
            h2, _ = nearest(q)
        gathered = 1.0 - abs(math.sin(th)) * 0.5
        folds = 0.0065 * S * gathered * (1 + math.sin(k * 2.2 + th * 3.0)) + 0.003 * S * math.sin(k * 5.1 - th * 9.0)
        row.append(h2 + d * (0.014 * S + folds))
    rows.append(row)
drape = grid('Rama_shoulder_cloth', rows, closed_u=True)
assign(drape, YELLOW)
bind(drape, from_body=True)
thicken(drape, 0.003)
smooth(drape, 1, 2)

drape_bvh = bvh_of(drape)

# --- rudraksha: balls strung along lines laid on the body, and over the cloth where it lies ---
BEAD = 0.0068 * S
bead_bm = bmesh.new()
bmesh.ops.create_icosphere(bead_bm, subdivisions=2, radius=1.0)
bead_verts = [v.co.copy() for v in bead_bm.verts]
bead_faces = [[v.index for v in f.verts] for f in bead_bm.faces]
bead_bm.free()


def beads(name, centres, radius=BEAD):
    verts, faces = [], []
    for c in centres:
        rot = Matrix.Rotation(random.uniform(0, math.pi), 3, Vector((random.random(), random.random(), random.random())).normalized())
        base_index = len(verts)
        for p in bead_verts:
            q = rot @ p
            # a rudraksha is not round: it is ridged from end to end
            ridge = 1.0 + 0.09 * math.sin(math.atan2(q.y, q.x) * 5.0)
            verts.append(Vector((q.x * ridge, q.y * ridge, q.z * 0.92)) * radius * random.uniform(0.93, 1.05) + c)
        faces.extend([[base_index + i for i in f] for f in bead_faces])
    obj = make_mesh(name, verts, faces)
    assign(obj, RUDRAKSHA)
    return obj


def strand(points, radius=BEAD, closed=True):
    """Bead middles spaced one bead apart along the line through `points`."""
    pts = [Vector(p) for p in points]
    if closed:
        pts.append(pts[0])
    out, carry = [], 0.0
    step = radius * 2.04
    for a, b in zip(pts, pts[1:]):
        seg = (b - a).length
        t = carry
        while t < seg:
            out.append(a.lerp(b, t / seg))
            t += step
        carry = t - seg
    return out


nape, _ = cast((0, 1.0, neck_z + 0.035 * S), (0, -1, 0))
for n, (drop, half) in enumerate([(0.33, 0.125), (0.2, 0.105)]):
    chest, _ = cast((0, -1.0, neck_z - drop * S), (0, 1, 0))
    mid, long_ax = (nape + chest) * 0.5, (chest - nape) * 0.5
    line = []
    for i in range(160):
        th = 2 * math.pi * i / 160
        p = mid + long_ax * math.cos(th) + Vector((half * S * math.sin(th), 0, 0))
        loc, normal = nearest(p)
        over, _ = cast(loc + normal * 0.09 * S, -normal, 0.09 * S, drape_bvh)
        line.append((over if over is not None else loc) + normal * BEAD * (0.95 + 0.9 * n))
    mala = beads(f'Rama_mala_{n + 1}', strand(line))
    bind(mala, from_body=True)


def ring(bone, along, rows, name):
    """Rows of beads round a limb, `along` of the way down the bone."""
    a, b = J[bone], JT[bone]
    axis = (b - a).normalized()
    e1 = axis.cross(Y_AXIS).normalized()
    e2 = axis.cross(e1).normalized()
    centres = []
    for r in range(rows):
        c = a.lerp(b, along) + axis * (r - (rows - 1) / 2) * BEAD * 2.02
        line = []
        for i in range(48):
            th = 2 * math.pi * i / 48
            d = e1 * math.cos(th) + e2 * math.sin(th)
            hit, _ = cast(c + d * 0.085 * S, -d, 0.2)
            line.append((hit if hit is not None else c + d * 0.04 * S) + d * BEAD * 0.9)
        centres.extend(strand(line))
    obj = beads(name, centres)
    bind(obj, to_bone=bone)
    return obj


for side in ('l', 'r'):
    ring(f'upperarm_{side}', 0.5, 3, f'Rama_armband_{side}')
    ring(f'lowerarm_{side}', 0.9, 2, f'Rama_wristband_{side}')

# --- the tilak: a red flame on the brow, laid onto the skin ---
eyes_obj = parts['eyes']
eye_z = sum(v.co.z for v in eyes_obj.data.vertices) / len(eyes_obj.data.vertices)
tz, th_half, tw_half = eye_z + 0.047 * S, 0.016 * S, 0.0052 * S
outline = []
for i in range(20):
    a = 2 * math.pi * i / 20
    # narrower toward the top: the shape of a flame
    w = tw_half * (1.0 - 0.45 * math.sin(a)) if math.sin(a) > 0 else tw_half
    outline.append((w * math.cos(a), th_half * math.sin(a)))
t_verts = []
for x, dz in [(0.0, 0.0)] + outline:
    hit, _ = cast((x, -1.0, tz + dz), (0, 1, 0))
    t_verts.append(hit + Vector((0, -0.0007, 0)))
tilak = make_mesh('Rama_tilak', t_verts, [(0, 1 + i, 1 + (i + 1) % 20) for i in range(20)])
assign(tilak, KUMKUM)
bind(tilak, to_bone='head')

# --- the topknot: his hair drawn up and tied on the crown ---
hair_obj = parts['hair']
crown = max((v.co for v in hair_obj.data.vertices if abs(v.co.x) < 0.03), key=lambda p: p.z).copy()
crown.y += 0.025 * S
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=14, radius=0.045 * S)
for v in bm.verts:
    # the hair is wound round as it is tied: the knot is grooved on the slant
    a = math.atan2(v.co.y, v.co.x)
    groove = 1.0 + 0.07 * math.sin(a * 6.0 + v.co.z * 70.0 / S)
    v.co = Vector((v.co.x * groove, v.co.y * groove, v.co.z * 0.82)) + crown + Vector((0, 0, 0.038 * S))
# the hair drawn up to it from all round the head
ret = bmesh.ops.create_cone(bm, cap_ends=False, segments=28, radius1=0.088 * S, radius2=0.03 * S, depth=0.075 * S, matrix=Matrix.Translation(crown + Vector((0, 0, -0.022 * S))))
for v in ret['verts']:
    a = math.atan2(v.co.y - crown.y, v.co.x - crown.x)
    k = 1.0 + 0.05 * math.sin(a * 14.0)
    v.co = Vector((crown.x + (v.co.x - crown.x) * k, crown.y + (v.co.y - crown.y) * k, v.co.z))
bun_mesh = bpy.data.meshes.new('Rama_topknot')
bm.to_mesh(bun_mesh); bm.free()
bun_mesh.polygons.foreach_set('use_smooth', [True] * len(bun_mesh.polygons))
bun = link(bpy.data.objects.new('Rama_topknot', bun_mesh))
assign(bun, HAIR)
bind(bun, to_bone='head')
smooth(bun, 1, 2)
tie = []
for i in range(40):
    a = 2 * math.pi * i / 40
    tie.append(crown + Vector((0.034 * S * math.cos(a), 0.034 * S * math.sin(a), 0.012 * S)))
band_obj = beads('Rama_topknot_band', strand(tie, BEAD * 0.9), BEAD * 0.9)
bind(band_obj, to_bone='head')

# --- the bow, taller than a man's shoulder, and the quiver on his back ---
BOW_LEN = 1.72 * S


def tube(name, points, radius, material, segments=8, taper=None):
    """A round rod through the points; taper(t) scales its thickness along the way."""
    pts = [Vector(p) for p in points]
    rows = []
    ref = Vector((1, 0, 0))
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        nrm = (ref - t * ref.dot(t)).normalized()
        ref = nrm
        bi = t.cross(nrm)
        r = radius * (taper(i / (len(pts) - 1)) if taper else 1.0)
        rows.append([p + (nrm * math.cos(2 * math.pi * s / segments) + bi * math.sin(2 * math.pi * s / segments)) * r for s in range(segments)])
    obj = grid(name, rows, closed_v=True)
    assign(obj, material)
    return obj


def bow_point(t):
    """t from -1 (lower tip) to 1 (upper): a bow that bends away at the limbs and curls back at the tips."""
    return Vector(((0.26 * t * t - 0.11 * abs(t) ** 5) * S, 0.0, t * BOW_LEN / 2))


bow_parts = [tube('Rama_bow', [bow_point(-1 + 2 * i / 48) for i in range(49)], 0.02 * S, WOOD, taper=lambda f: 0.5 + 0.5 * math.sin(math.pi * f) ** 0.6)]
bow_parts.append(tube('Rama_bowstring', [bow_point(-1), bow_point(1)], 0.0018 * S, STRING, segments=5))
for t in (-0.93, -0.55, -0.07, 0.07, 0.55, 0.93):
    bow_parts.append(tube('wrap', [bow_point(t - 0.02), bow_point(t), bow_point(t + 0.02)], 0.0225 * S * (0.6 + 0.4 * (1 - abs(t))), GOLD))
activate(bow_parts[0])
for o in bow_parts[1:]:
    o.select_set(True)
bpy.ops.object.join()
bow = bow_parts[0]
bow.name = 'Rama_bow'
smooth(bow, 0, 1)

quiver_parts = []
q_axis = Vector((-0.28, 0.0, 1.0)).normalized()
q_at = Vector((-0.06 * S, J['spine_03'].y + 0.17 * S, J['spine_03'].z - 0.02 * S))
quiver_parts.append(tube('Rama_quiver', [q_at + q_axis * (f - 0.5) * 0.56 * S for f in (0, 0.02, 0.5, 0.98, 1)], 0.055 * S, LEATHER, segments=14, taper=lambda f: 0.62 + 0.38 * f))
for f in (0.08, 0.9):
    quiver_parts.append(tube('trim', [q_at + q_axis * (f - 0.5 + d) * 0.56 * S for d in (-0.02, 0, 0.02)], 0.058 * S * (0.64 + 0.36 * f), GOLD, segments=14))
for i in range(6):
    a = 2 * math.pi * i / 6
    off = (Vector((math.cos(a), math.sin(a), 0)) * 0.026 * S)
    start = q_at + q_axis * 0.1 * S + off
    end = q_at + q_axis * (0.28 + 0.2 + 0.03 * (i % 3)) * S + off * 1.3
    quiver_parts.append(tube('shaft', [start, end], 0.0042 * S, WOOD, segments=5))
    for k in range(3):
        b = a + 2 * math.pi * k / 3
        fin = Vector((math.cos(b), math.sin(b), 0)) * 0.016 * S
        f0, f1 = end - q_axis * 0.085 * S, end - q_axis * 0.012 * S
        vane = make_mesh('vane', [f0, f1, f1 + fin, f0 + fin * 0.6], [(0, 1, 2, 3)], smooth=False)
        assign(vane, FEATHER)
        quiver_parts.append(vane)
activate(quiver_parts[0])
for o in quiver_parts[1:]:
    o.select_set(True)
bpy.ops.object.join()
quiver = quiver_parts[0]
quiver.name = 'Rama_quiver'
quiver.parent = rig
quiver.parent_type = 'BONE'
quiver.parent_bone = 'spine_03'
bpy.context.view_layer.update()
quiver.matrix_parent_inverse = (rig.matrix_world @ rig.pose.bones['spine_03'].matrix @ Matrix.Translation((0, rig.data.bones['spine_03'].length, 0))).inverted()

# --- how he stands: arms eased down, the bow upright in his left hand ---
bpy.context.view_layer.update()


def turn(bone_name, axis, angle):
    """Turns a bone about a line through its head, in the rig's own space."""
    pb = rig.pose.bones[bone_name]
    head = pb.matrix.translation.copy()
    pb.matrix = Matrix.Translation(head) @ Matrix.Rotation(angle, 4, axis) @ Matrix.Translation(-head) @ pb.matrix
    bpy.context.view_layer.update()


turn('upperarm_l', Y_AXIS, math.radians(27))
turn('upperarm_r', Y_AXIS, math.radians(-33))
turn('lowerarm_l', Vector((1, 0, 0)), math.radians(-22))
turn('lowerarm_r', Vector((1, 0, 0)), math.radians(-12))
turn('head', Z_AXIS, math.radians(-7))
# his left hand closes: each finger joint turns about the line of the knuckles, toward the palm
pose = rig.pose.bones
for side, sign in (('l', 1.0), ('r', -1.0)):
    knuckles = (pose[f'index_01_{side}'].matrix.translation - pose[f'pinky_01_{side}'].matrix.translation).normalized()
    curl = math.radians(48 if side == 'l' else 14)
    for finger in ('index', 'middle', 'ring', 'pinky'):
        for joint in ('01', '02', '03'):
            name = f'{finger}_{joint}_{side}'
            pb = pose[name]
            before = (pb.tail - pb.head).normalized()
            turn(name, knuckles, curl)
            after = (pose[name].tail - pose[name].head).normalized()
            # toward the palm is toward his body when the arm hangs: if that went the other way, turn it back twice
            if (after.x - before.x) * sign > 0:
                turn(name, knuckles, -2 * curl)
    turn(f'thumb_02_{side}', knuckles, curl * 0.4)

hand = pose['hand_l']
grip = (pose['index_01_l'].matrix.translation + pose['pinky_01_l'].matrix.translation) * 0.5
palm = (hand.matrix.translation - Vector((0.03 * S, 0, 0)))
bow_pos = Vector((grip.x - 0.022 * S, grip.y - 0.005, max(grip.z, BOW_LEN / 2 + 0.01)))
bow.parent = rig
bow.parent_type = 'BONE'
bow.parent_bone = 'hand_l'
bpy.context.view_layer.update()
bone_world = rig.matrix_world @ hand.matrix @ Matrix.Translation((0, rig.data.bones['hand_l'].length, 0))
bow.matrix_parent_inverse = bone_world.inverted()
bow.matrix_world = Matrix.Translation(bow_pos) @ Matrix.Rotation(math.radians(4), 4, 'Y')
bpy.context.view_layer.update()
print('dressed:', len([o for o in collection.objects if o.type == 'MESH']), 'meshes')
