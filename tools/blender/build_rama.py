# Builds Rama as a Blender character: a MakeHuman body reshaped for him, skinned, rigged and dressed as he is in
# exile (hair in a topknot, the tilak, rudraksha beads, a cloth over one shoulder, a dhoti and sash, the bow).
#
#   python tools/blender/build_rama.py --data <mpfb2>/src/mpfb/data --assets <makehuman system assets> --out models/rama
#
# Run it with Blender's Python module (`pip install bpy`) or as `blender -b -P tools/blender/build_rama.py -- ...`.
# It writes rama.blend (textures packed), rama.glb, and stills. Sources and licences are in models/rama/README.md.
import argparse
import math
import os
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mh  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--data', required=True)
ap.add_argument('--assets', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--samples', type=int, default=96)
ap.add_argument('--stills', default='front,face,back')
ap.add_argument('--no-export', action='store_true')
args = ap.parse_args(argv)
OUT = os.path.abspath(args.out)
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------------------------------------------------------
# a clean scene
# ---------------------------------------------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
collection = bpy.data.collections.new('Rama')
scene.collection.children.link(collection)


def link(obj):
    collection.objects.link(obj)
    return obj


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def make_mesh(name, verts, faces, uvs=None, smooth=True):
    """verts in Blender's measure; faces lists of indices; uvs one (u, v) per face corner, in face order."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    if uvs is not None:
        layer = mesh.uv_layers.new(name='UVMap')
        flat = [c for uv in uvs for c in uv]
        layer.data.foreach_set('uv', flat)
    mesh.update()
    if smooth:
        mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
    return link(bpy.data.objects.new(name, mesh))


def from_obj(name, obj, verts_mh, face_ids=None):
    """A Blender object from part of a MakeHuman .obj: only the faces asked for, and only the points they use."""
    ids = range(len(obj.faces)) if face_ids is None else face_ids
    used = sorted({v for i in ids for v in obj.faces[i]})
    remap = {v: n for n, v in enumerate(used)}
    faces = [[remap[v] for v in obj.faces[i]] for i in ids]
    uvs = None
    if len(obj.uvs):
        uvs = [tuple(obj.uvs[t]) if t >= 0 else (0.0, 0.0) for i in ids for t in obj.face_uvs[i]]
    o = make_mesh(name, mh.to_blender(verts_mh[used]), faces, uvs)
    return o, used


# ---------------------------------------------------------------------------------------------------------------
# materials
# ---------------------------------------------------------------------------------------------------------------
def principled(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    return mat, nt, bsdf


def image_node(nt, path, colorspace='sRGB'):
    node = nt.nodes.new('ShaderNodeTexImage')
    node.image = bpy.data.images.load(path, check_existing=True)
    node.image.colorspace_settings.name = colorspace
    return node


def set_in(bsdf, name, value):
    if name in bsdf.inputs:
        bsdf.inputs[name].default_value = value


def cutout(mat):
    """Lets a picture's alpha cut the surface away (hair cards, lashes)."""
    if hasattr(mat, 'surface_render_method'):
        mat.surface_render_method = 'DITHERED'
    if hasattr(mat, 'blend_method'):
        mat.blend_method = 'HASHED'


def skin_material(diffuse):
    mat, nt, bsdf = principled('Rama skin')
    tex = image_node(nt, diffuse)
    # the painted skin is a pale pink: it is warmed and deepened to a wheat-gold
    hsv = nt.nodes.new('ShaderNodeHueSaturation')
    hsv.inputs['Saturation'].default_value = 0.9
    hsv.inputs['Value'].default_value = 0.92
    tone = nt.nodes.new('ShaderNodeMix')
    tone.data_type = 'RGBA'; tone.blend_type = 'MULTIPLY'
    tone.inputs['Factor'].default_value = 1.0
    tone.inputs['B'].default_value = (0.72, 0.52, 0.39, 1.0)
    nt.links.new(tex.outputs['Color'], hsv.inputs['Color'])
    nt.links.new(hsv.outputs['Color'], tone.inputs['A'])
    nt.links.new(tone.outputs['Result'], bsdf.inputs['Base Color'])
    set_in(bsdf, 'Roughness', 0.56)
    set_in(bsdf, 'Subsurface Weight', 0.22)
    set_in(bsdf, 'Subsurface Radius', (1.0, 0.36, 0.18))
    set_in(bsdf, 'Subsurface Scale', 0.012)
    set_in(bsdf, 'Specular IOR Level', 0.3)
    # pores: a fine grain in the surface, too small to see as bumps but enough to break the shine
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 1400.0
    noise.inputs['Detail'].default_value = 3.0
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.06
    bump.inputs['Distance'].default_value = 0.0006
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def picture_material(name, mhmat_path, *, tint=None, roughness=0.5, alpha=None, sss=0.0, coat=0.0):
    info = mh.read_mhmat(mhmat_path)
    mat, nt, bsdf = principled(name)
    set_in(bsdf, 'Roughness', roughness)
    set_in(bsdf, 'Subsurface Weight', sss)
    set_in(bsdf, 'Coat Weight', coat)
    if info['diffuse'] and os.path.exists(info['diffuse']):
        tex = image_node(nt, info['diffuse'])
        out = tex.outputs['Color']
        if tint is not None:
            mix = nt.nodes.new('ShaderNodeMix')
            mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1.0
            mix.inputs['B'].default_value = (*tint, 1.0)
            nt.links.new(out, mix.inputs['A'])
            out = mix.outputs['Result']
        nt.links.new(out, bsdf.inputs['Base Color'])
        if alpha if alpha is not None else info['transparent']:
            nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
            cutout(mat)
    return mat


def plain(name, color, *, roughness=0.6, metallic=0.0, sheen=0.0, sss=0.0, bump=None):
    mat, nt, bsdf = principled(name)
    set_in(bsdf, 'Base Color', (*color, 1.0))
    set_in(bsdf, 'Roughness', roughness)
    set_in(bsdf, 'Metallic', metallic)
    set_in(bsdf, 'Sheen Weight', sheen)
    set_in(bsdf, 'Subsurface Weight', sss)
    if bump:
        scale, strength, distance = bump
        noise = nt.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = scale
        noise.inputs['Detail'].default_value = 4.0
        b = nt.nodes.new('ShaderNodeBump')
        b.inputs['Strength'].default_value = strength
        b.inputs['Distance'].default_value = distance
        nt.links.new(noise.outputs['Fac'], b.inputs['Height'])
        nt.links.new(b.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def strands(name, color, *, roughness=0.45):
    """Hair as a solid shape: dark, with fine grooves running up it."""
    mat, nt, bsdf = principled(name)
    set_in(bsdf, 'Base Color', (*color, 1.0))
    set_in(bsdf, 'Roughness', roughness)
    coords = nt.nodes.new('ShaderNodeTexCoord')
    mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (260.0, 260.0, 9.0)
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 1.0
    noise.inputs['Detail'].default_value = 2.0
    b = nt.nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = 0.55
    b.inputs['Distance'].default_value = 0.0012
    nt.links.new(coords.outputs['Object'], mapping.inputs['Vector'])
    nt.links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
    nt.links.new(noise.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def cloth(name, color, *, roughness=0.78, weave=900.0):
    """Woven cloth: a little sheen at grazing angles, the weave as a fine bump, slight unevenness in the dye."""
    mat, nt, bsdf = principled(name)
    set_in(bsdf, 'Roughness', roughness)
    set_in(bsdf, 'Sheen Weight', 0.35)
    set_in(bsdf, 'Sheen Roughness', 0.45)
    dye = nt.nodes.new('ShaderNodeTexNoise')
    dye.inputs['Scale'].default_value = 9.0
    dye.inputs['Detail'].default_value = 5.0
    ramp = nt.nodes.new('ShaderNodeMix')
    ramp.data_type = 'RGBA'
    ramp.inputs['A'].default_value = (*[c * 0.82 for c in color], 1.0)
    ramp.inputs['B'].default_value = (*color, 1.0)
    nt.links.new(dye.outputs['Fac'], ramp.inputs['Factor'])
    nt.links.new(ramp.outputs['Result'], bsdf.inputs['Base Color'])
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.inputs['Scale'].default_value = weave
    wave.inputs['Distortion'].default_value = 1.5
    b = nt.nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = 0.12
    b.inputs['Distance'].default_value = 0.0004
    nt.links.new(wave.outputs['Fac'], b.inputs['Height'])
    # and the creases worn into it: broader, softer, running mostly up and down
    coords = nt.nodes.new('ShaderNodeTexCoord')
    mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (22.0, 22.0, 5.0)
    crease = nt.nodes.new('ShaderNodeTexNoise')
    crease.inputs['Scale'].default_value = 1.0
    crease.inputs['Detail'].default_value = 3.0
    b2 = nt.nodes.new('ShaderNodeBump')
    b2.inputs['Strength'].default_value = 0.5
    b2.inputs['Distance'].default_value = 0.006
    nt.links.new(coords.outputs['Object'], mapping.inputs['Vector'])
    nt.links.new(mapping.outputs['Vector'], crease.inputs['Vector'])
    nt.links.new(crease.outputs['Fac'], b2.inputs['Height'])
    nt.links.new(b.outputs['Normal'], b2.inputs['Normal'])
    nt.links.new(b2.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


# ---------------------------------------------------------------------------------------------------------------
# the body
# ---------------------------------------------------------------------------------------------------------------
human = mh.Human(args.data)
# a young man, tall, strongly made without bulk; features drawn from across the subcontinent's range
human.macro(muscle=0.93, weight=0.5, height=0.58, proportions=0.95, race={'caucasian': 0.5, 'asian': 0.32, 'african': 0.18})
# The face. These are choices of our own, made to suit how Rama is described and traditionally drawn (a long calm
# face, a straight nose, a firm jaw, wide eyes under level brows): no person's likeness is being followed.
FACE = {
    'head/head-oval': 0.3, 'head/head-rectangular': 0.25, 'head/head-scale-vert-incr': 0.1, 'head/head-age-incr': 0.18,
    'nose/nose-greek-incr': 0.4, 'nose/nose-hump-decr': 0.2, 'nose/nose-scale-vert-incr': 0.15, 'nose/nose-width2-decr': 0.15, 'nose/nose-point-down': 0.1, 'nose/nose-scale-depth-incr': 0.15,
    'chin/chin-prominent-incr': 0.3, 'chin/chin-height-incr': 0.15, 'chin/chin-bones-incr': 0.6, 'chin/chin-width-incr': 0.25, 'chin/chin-jaw-drop-incr': 0.15,
    'cheek/l-cheek-bones-incr': 0.4, 'cheek/r-cheek-bones-incr': 0.4, 'cheek/l-cheek-volume-decr': 0.3, 'cheek/r-cheek-volume-decr': 0.3,
    'eyes/l-eye-scale-incr': 0.08, 'eyes/r-eye-scale-incr': 0.08, 'eyes/l-eye-corner2-up': 0.15, 'eyes/r-eye-corner2-up': 0.15, 'eyes/l-eye-eyefold-down': 0.3, 'eyes/r-eye-eyefold-down': 0.3,
    'eyebrows/eyebrows-trans-down': 0.3, 'eyebrows/eyebrows-trans-forward': 0.25,
    'mouth/mouth-scale-horiz-incr': 0.12, 'mouth/mouth-lowerlip-volume-incr': 0.15, 'mouth/mouth-cupidsbow-incr': 0.2,
    'neck/neck-scale-horiz-incr': 0.25, 'neck/neck-scale-depth-incr': 0.15,
    'torso/torso-vshape-incr': 0.4, 'torso/torso-muscle-pectoral-incr': 0.6, 'torso/torso-muscle-dorsi-incr': 0.4, 'torso/measure-shoulder-dist-incr': 0.25, 'torso/measure-waist-circ-decr': 0.2,
    'arms/l-upperarm-shoulder-muscle-incr': 0.55, 'arms/r-upperarm-shoulder-muscle-incr': 0.55, 'arms/l-upperarm-muscle-incr': 0.5, 'arms/r-upperarm-muscle-incr': 0.5,
    'arms/l-lowerarm-muscle-incr': 0.35, 'arms/r-lowerarm-muscle-incr': 0.35,
}
for name, weight in FACE.items():
    human.target(name, weight)
# stand him on the ground
human.verts[:, 1] -= human.verts[human.base.group_verts('body'), 1].min()

base = human.base
body, body_ids = from_obj('Rama_body', base, human.verts, base.faces_of('body'))
skins = os.path.join(args.assets, 'skins')
assign(body, skin_material(os.path.join(skins, 'young_caucasian_male', 'young_lightskinned_male_diffuse.png')))
body_bvh = None

P = args.assets
ASSETS = {
    'eyes': ('eyes/high-poly/high-poly.mhclo', dict(tint=(0.86, 0.76, 0.7), roughness=0.12, coat=0.5)),
    'eyebrows': ('eyebrows/eyebrow012/eyebrow012.mhclo', dict(tint=(0.05, 0.04, 0.04), roughness=0.5, alpha=True)),
    'eyelashes': ('eyelashes/eyelashes01/eyelashes01.mhclo', dict(tint=(0.1, 0.08, 0.08), roughness=0.5, alpha=True)),
    'teeth': ('teeth/teeth_base/teeth_base.mhclo', dict(roughness=0.25, sss=0.1)),
    'tongue': ('tongue/tongue01/tongue01.mhclo', dict(roughness=0.35, sss=0.2)),
    'hair': ('hair/long01/long01.mhclo', dict(tint=(0.085, 0.07, 0.065), roughness=0.5, alpha=True)),
}
parts = {}
for key, (rel, look) in ASSETS.items():
    asset = mh.Asset(os.path.join(P, rel), human)
    obj, _ = from_obj(f'Rama_{key}', asset.obj, asset.verts)
    assign(obj, picture_material(f'Rama {key}', asset.material, **look))
    parts[key] = obj

# ---------------------------------------------------------------------------------------------------------------
# the rig: MakeHuman's game skeleton (pelvis, spine_01..03, thigh_l, ...), with its own weights for the body
# ---------------------------------------------------------------------------------------------------------------
bones, weights = mh.read_rig(args.data, 'game_engine', human)
arm_data = bpy.data.armatures.new('Rama_rig')
rig = link(bpy.data.objects.new('Rama_rig', arm_data))
activate(rig)
bpy.ops.object.mode_set(mode='EDIT')
for name, b in bones.items():
    eb = arm_data.edit_bones.new(name)
    eb.head = Vector(mh.to_blender(b['head']))
    eb.tail = Vector(mh.to_blender(b['tail']))
    if (eb.tail - eb.head).length < 1e-4:
        eb.tail = eb.head + Vector((0, 0, 0.03))
    eb.roll = b['roll']
for name, b in bones.items():
    if b['parent'] and b['parent'] in arm_data.edit_bones:
        arm_data.edit_bones[name].parent = arm_data.edit_bones[b['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
arm_data.display_type = 'STICK'

remap = {v: n for n, v in enumerate(body_ids)}
for bone, pairs in weights.items():
    group = body.vertex_groups.new(name=bone)
    for v, w in pairs:
        if v in remap and w > 0:
            group.add([remap[v]], w, 'REPLACE')


def bind(obj, to_bone=None, from_body=False):
    """Hangs obj on the rig: wholly on one bone, or with the body's own weights carried across to it."""
    if to_bone:
        g = obj.vertex_groups.new(name=to_bone)
        g.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    elif from_body:
        for g in body.vertex_groups:
            obj.vertex_groups.new(name=g.name)
        mod = obj.modifiers.new('weights', 'DATA_TRANSFER')
        mod.object = body
        mod.use_vert_data = True
        mod.data_types_verts = {'VGROUP_WEIGHTS'}
        mod.vert_mapping = 'POLYINTERP_NEAREST'
        mod.layers_vgroup_select_src = 'ALL'
        mod.layers_vgroup_select_dst = 'NAME'
        activate(obj)
        bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.parent = rig
    arm = obj.modifiers.new('rig', 'ARMATURE')
    arm.object = rig
    return obj


def smooth(obj, levels=1, render=2):
    mod = obj.modifiers.new('smooth', 'SUBSURF')
    mod.levels = levels
    mod.render_levels = render
    return mod


bind(body)
for key, obj in parts.items():
    bind(obj, to_bone='head')
smooth(body, 1, 2)
smooth(parts['hair'], 0, 1)

# ---------------------------------------------------------------------------------------------------------------
# what he wears and carries
# ---------------------------------------------------------------------------------------------------------------
V = mh.to_blender(human.verts)  # every point of the base mesh, helpers included, in Blender's measure
body_pts = V[body_ids]


def bvh_of(*objs):
    """One tree of the surfaces of all the objects given, as they stand now."""
    dg = bpy.context.evaluated_depsgraph_get()
    verts, polys = [], []
    for obj in objs:
        ev = obj.evaluated_get(dg)
        me = ev.to_mesh()
        start = len(verts)
        verts.extend(ev.matrix_world @ v.co for v in me.vertices)
        polys.extend([start + i for i in p.vertices] for p in me.polygons)
        ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts, polys)


J = {name: Vector(mh.to_blender(b['head'])) for name, b in bones.items()}
JT = {name: Vector(mh.to_blender(b['tail'])) for name, b in bones.items()}
height = float(body_pts[:, 2].max())
print(f'height {height:.3f} m; joints: pelvis {J["pelvis"].z:.3f}, neck {J["neck_01"].z:.3f}, head {J["head"].z:.3f}')

exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rama_dress.py')).read())

# ---------------------------------------------------------------------------------------------------------------
# light, eye, stills
# ---------------------------------------------------------------------------------------------------------------
world = bpy.data.worlds.new('Studio')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.045, 0.05, 0.065, 1.0)
bg.inputs['Strength'].default_value = 1.0


def area(name, location, target, power, size, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power; data.size = size; data.color = color
    obj = link(bpy.data.objects.new(name, data))
    obj.location = location
    obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()
    return obj


area('Key', (1.9, -2.6, 2.6), (0, 0, 1.3), 300, 1.8, (1.0, 0.93, 0.84))
area('Fill', (-2.4, -1.8, 1.4), (0, 0, 1.2), 85, 2.4, (0.8, 0.88, 1.0))
area('Rim', (-1.2, 2.6, 2.4), (0, 0, 1.4), 260, 1.2, (1.0, 0.86, 0.7))
floor = make_mesh('Floor', [(-6, -6, 0), (6, -6, 0), (6, 6, 0), (-6, 6, 0)], [(0, 1, 2, 3)], smooth=False)
assign(floor, plain('Floor', (0.11, 0.1, 0.1), roughness=0.85))

cam_data = bpy.data.cameras.new('Eye')
cam = link(bpy.data.objects.new('Eye', cam_data))
scene.camera = cam
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = args.samples
scene.cycles.use_denoising = True
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'  # colours as they were chosen, not a film's roll-off
bpy.context.preferences.edit.use_global_undo = False

head_z = J['head'].z + 0.09
VIEWS = {
    'front': ((0.9, -4.3, 1.15), (0, 0, 0.98), 50, (900, 1300)),
    'face': ((0.22, -0.95, head_z + 0.02), (0, 0, head_z), 85, (1000, 1100)),
    'back': ((-1.3, 4.1, 1.3), (0, 0, 1.0), 50, (900, 1300)),
    'side': ((-4.2, -1.0, 1.2), (0, 0, 1.0), 50, (900, 1300)),
    'bust': ((0.55, -2.0, head_z - 0.12), (0, 0, head_z - 0.26), 70, (1000, 1100)),
}
for name in [s for s in args.stills.split(',') if s]:
    eye, target, lens, (w, h) = VIEWS[name]
    cam.location = eye
    cam.rotation_euler = (Vector(target) - Vector(eye)).to_track_quat('-Z', 'Y').to_euler()
    cam_data.lens = lens
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.filepath = os.path.join(OUT, f'rama_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('still', scene.render.filepath)

if not args.no_export:
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'rama.blend'), compress=True)
    print('saved', os.path.join(OUT, 'rama.blend'))
    # the same for engines: one .glb, cloth and smoothing made real, the rig and its weights kept
    floor.hide_set(True)
    try:
        import addon_utils
        addon_utils.enable('io_scene_gltf2')
        bpy.ops.object.select_all(action='DESELECT')
        for o in collection.objects:
            if o.type in ('MESH', 'ARMATURE') and o is not floor:
                o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'rama.glb'), export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_animations=False, export_image_format='JPEG', export_jpeg_quality=85)
        print('saved', os.path.join(OUT, 'rama.glb'))
    except Exception as e:  # the .blend is the master copy: say so and go on
        print('glb export failed:', repr(e)[:400])
