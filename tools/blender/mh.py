# Reads MakeHuman's open data straight from its files, with no add-on: the base mesh, the targets that reshape it,
# the assets fitted to it (eyes, hair, teeth...), their materials, and a rig with its weights.
#
# Everything is kept in MakeHuman's own measure while it is being put together (decimetres, Y up, facing +Z) and
# turned into Blender's (metres, Z up, facing -Y) by `to_blender` at the end.
#
# The data is CC0: the base mesh, targets and rigs ship with MPFB2 (github.com/makehumancommunity/mpfb2,
# src/mpfb/data), and the skins, eyes, hair and so on are the "makehuman system assets" pack.
import gzip
import json
import os

import numpy as np


def to_blender(p):
    """(x, y, z) in MakeHuman's measure -> Blender's."""
    p = np.asarray(p, dtype=np.float64)
    return np.stack([p[..., 0] * 0.1, -p[..., 2] * 0.1, p[..., 1] * 0.1], axis=-1)


class Obj:
    """A Wavefront .obj as MakeHuman writes them: points, UVs, and faces that each belong to a named group."""

    def __init__(self, path):
        verts, uvs, faces, face_uvs, groups = [], [], [], [], []
        group = 'default'
        with open(path, encoding='utf-8', errors='replace') as f:
            for line in f:
                if line.startswith('v '):
                    verts.append([float(x) for x in line.split()[1:4]])
                elif line.startswith('vt '):
                    uvs.append([float(x) for x in line.split()[1:3]])
                elif line.startswith('g '):
                    group = line.split()[1]
                elif line.startswith('f '):
                    vi, ti = [], []
                    for part in line.split()[1:]:
                        bits = part.split('/')
                        vi.append(int(bits[0]) - 1)
                        ti.append(int(bits[1]) - 1 if len(bits) > 1 and bits[1] else -1)
                    faces.append(vi); face_uvs.append(ti); groups.append(group)
        self.verts = np.array(verts, dtype=np.float64)
        self.uvs = np.array(uvs, dtype=np.float64) if uvs else np.zeros((0, 2))
        self.faces, self.face_uvs, self.groups = faces, face_uvs, groups

    def faces_of(self, test):
        """Indices of the faces whose group passes `test` (a name, or a function of the name)."""
        ok = test if callable(test) else (lambda g: g == test)
        return [i for i, g in enumerate(self.groups) if ok(g)]

    def group_verts(self, name):
        out = set()
        for i in self.faces_of(name):
            out.update(self.faces[i])
        return sorted(out)


def load_target(path):
    """A target: which points move, and by how much at full strength."""
    idx, delta = [], []
    opener = gzip.open if path.endswith('.gz') else open
    with opener(path, 'rt') as f:
        for line in f:
            if not line.strip() or line.startswith('#'):
                continue
            a = line.split()
            idx.append(int(a[0])); delta.append([float(a[1]), float(a[2]), float(a[3])])
    return np.array(idx, dtype=np.int64), np.array(delta, dtype=np.float64).reshape(-1, 3)


class Human:
    """The base mesh, reshaped by targets. `verts` are in MakeHuman's measure."""

    def __init__(self, data_dir):
        self.data = data_dir
        self.base = Obj(os.path.join(data_dir, '3dobjs', 'base.obj'))
        self.verts = self.base.verts.copy()
        self.applied = []

    def target(self, name, weight):
        """name is the target's path under targets/, without its ending: 'nose/nose-greek-incr'."""
        if abs(weight) < 1e-6:
            return
        path = os.path.join(self.data, 'targets', name + '.target.gz')
        if not os.path.exists(path):
            raise FileNotFoundError(f'no target {name}')
        idx, delta = load_target(path)
        self.verts[idx] += weight * delta
        self.applied.append((name, round(weight, 3)))

    def macro(self, *, muscle=0.5, weight=0.5, height=0.5, proportions=0.5, race=None):
        """A young man of the given build. Each of the four is 0..1 with 0.5 the average; race is shares that sum to 1."""
        race = race or {'caucasian': 1 / 3, 'asian': 1 / 3, 'african': 1 / 3}
        def split(v, low, mid, high):
            return [(low, 1 - 2 * v), (mid, 2 * v)] if v < 0.5 else [(mid, 2 - 2 * v), (high, 2 * v - 1)]
        muscles = split(muscle, 'minmuscle', 'averagemuscle', 'maxmuscle')
        weights = split(weight, 'minweight', 'averageweight', 'maxweight')
        for m, mw in muscles:
            for w, ww in weights:
                self.target(f'macrodetails/universal-male-young-{m}-{w}', mw * ww)
                if height != 0.5:
                    self.target(f'macrodetails/height/male-young-{m}-{w}-{"maxheight" if height > 0.5 else "minheight"}', mw * ww * abs(2 * height - 1))
                if proportions != 0.5:
                    self.target(f'macrodetails/proportions/male-young-{m}-{w}-{"idealproportions" if proportions > 0.5 else "uncommonproportions"}', mw * ww * abs(2 * proportions - 1))
        for name, share in race.items():
            self.target(f'macrodetails/{name}-male-young', share)

    def joint(self, cube):
        """The middle of one of the little cubes that mark where a joint is."""
        return self.verts[self.base.group_verts(cube)].mean(axis=0)


class Asset:
    """Something fitted to the base mesh by a .mhclo file: each of its points hangs off three of the body's."""

    def __init__(self, mhclo_path, human):
        folder = os.path.dirname(mhclo_path)
        self.name, self.material, obj_file = os.path.basename(folder), None, None
        scales, rows, section = {}, [], None
        with open(mhclo_path, encoding='utf-8', errors='replace') as f:
            for line in f:
                a = line.split()
                if not a or a[0].startswith('#'):
                    continue
                # a line of numbers belongs to whichever list was last opened; a named line may come anywhere
                try:
                    numbers = [float(x) for x in a]
                except ValueError:
                    numbers = None
                if numbers is not None:
                    if section == 'verts':
                        rows.append(numbers)
                    continue
                if a[0] == 'verts':
                    section = 'verts'
                elif a[0] in ('delete_verts', 'weights', 'vertexboneweights_file'):
                    section = a[0]
                elif a[0] in ('x_scale', 'y_scale', 'z_scale'):
                    scales[a[0][0]] = (int(a[1]), int(a[2]), float(a[3]))
                elif a[0] == 'obj_file':
                    obj_file = a[1]
                elif a[0] == 'material':
                    self.material = os.path.normpath(os.path.join(folder, a[1]))
        self.obj = Obj(os.path.join(folder, obj_file))
        B = human.verts
        s = np.ones(3)
        for k, axis in (('x', 0), ('y', 1), ('z', 2)):
            if k in scales:
                i, j, dist = scales[k]
                s[axis] = abs(B[i][axis] - B[j][axis]) / dist
        out = np.zeros((len(rows), 3))
        for n, r in enumerate(rows):
            if len(r) == 1:
                out[n] = B[int(r[0])]
            else:
                v1, v2, v3 = int(r[0]), int(r[1]), int(r[2])
                out[n] = r[3] * B[v1] + r[4] * B[v2] + r[5] * B[v3] + np.array(r[6:9]) * s
        self.verts = out


def read_mhmat(path):
    """The few things wanted from a MakeHuman material: its diffuse picture (as a full path) and whether it is see-through."""
    out = {'name': os.path.basename(path), 'diffuse': None, 'transparent': False}
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            a = line.split()
            if len(a) < 2:
                continue
            if a[0] == 'diffuseTexture':
                out['diffuse'] = os.path.normpath(os.path.join(os.path.dirname(path), a[1]))
            elif a[0] == 'transparent':
                out['transparent'] = a[1] == 'True'
            elif a[0] == 'name':
                out['name'] = a[1]
    return out


def read_rig(data_dir, name, human):
    """Bones as { name: { head, tail (MakeHuman measure), roll, parent } }, and weights as { bone: [(point, weight)] }."""
    with open(os.path.join(data_dir, 'rigs', 'standard', f'rig.{name}.json')) as f:
        rig = json.load(f)
    with open(os.path.join(data_dir, 'rigs', 'standard', f'weights.{name}.json')) as f:
        weights = json.load(f)['weights']
    def place(spec):
        if spec.get('strategy') == 'CUBE':
            return human.joint(spec['cube_name'])
        if spec.get('strategy') == 'MEAN' and spec.get('vertex_indices'):
            return human.verts[spec['vertex_indices']].mean(axis=0)
        if spec.get('strategy') == 'VERTEX' and 'vertex_index' in spec:
            return human.verts[spec['vertex_index']]
        return None
    bones = {}
    for bone, b in rig.items():
        bones[bone] = {'head': place(b['head']), 'tail': place(b['tail']), 'roll': b.get('roll', 0.0), 'parent': b.get('parent') or None, 'connect': b.get('use_connect', False)}
    return bones, weights
