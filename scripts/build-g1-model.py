#!/usr/bin/env python3
"""
Bake the official Unitree G1 meshes (BSD-3, github.com/unitreerobotics/unitree_ros) onto the
Xbot animation skeleton used in the app.

Output: public/models/g1/g1.bin + g1.json
  - every URDF link mesh is transformed into the local frame of the Xbot bone that drives it
    (metres, three.js axes: +X robot-left, +Y up, +Z forward), vertex-clustered and indexed
  - the G1 joint pivots are exported so the runtime can move the skeleton to G1 proportions
  - arms are straightened from the G1 zero pose (upper arm down, forearm forward) into the
    T-pose the animation clips were authored for

Usage: python3 scripts/build-g1-model.py  (downloads sources into /tmp/g1 if missing)
"""
import json
import math
import os
import struct
import urllib.request
import xml.etree.ElementTree as ET

SRC = "https://raw.githubusercontent.com/unitreerobotics/unitree_ros/master/robots/g1_description"
CACHE = "/tmp/g1"
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "models", "g1")
CELL = 0.0025  # vertex clustering grid (m)

BONES = {
    "Hips": ["pelvis", "pelvis_contour_link"],
    "Spine2": ["torso_link", "logo_link", "head_link", "waist_support_link", "waist_yaw_fixed_link"],
}
for side in ("left", "right"):
    S = side.capitalize()
    BONES[f"{S}UpLeg"] = [f"{side}_hip_pitch_link", f"{side}_hip_roll_link", f"{side}_hip_yaw_link"]
    BONES[f"{S}Leg"] = [f"{side}_knee_link"]
    BONES[f"{S}Foot"] = [f"{side}_ankle_pitch_link", f"{side}_ankle_roll_link"]
    BONES[f"{S}Arm"] = [f"{side}_shoulder_pitch_link", f"{side}_shoulder_roll_link", f"{side}_shoulder_yaw_link"]
    BONES[f"{S}ForeArm"] = [f"{side}_elbow_link"]
    BONES[f"{S}Hand"] = [f"{side}_wrist_roll_rubber_hand"]


def fetch(rel):
    path = os.path.join(CACHE, rel)
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        urllib.request.urlretrieve(f"{SRC}/{rel}", path)
    return path


# ---------------------------------------------------------------- linear algebra

def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def transform(xyz, rpy):
    r, p, y = rpy
    cr, sr, cp, sp, cy, sy = math.cos(r), math.sin(r), math.cos(p), math.sin(p), math.cos(y), math.sin(y)
    R = [
        [cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr],
        [sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr],
        [-sp, cp * sr, cp * cr],
    ]
    return [R[0] + [xyz[0]], R[1] + [xyz[1]], R[2] + [xyz[2]], [0, 0, 0, 1]]


def apply(m, v):
    return [m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2] + m[i][3] for i in range(3)]


def to_three(v):
    """URDF (x fwd, y left, z up) -> three.js rig frame (x left, y up, z fwd)."""
    return [v[1], v[2], v[0]]


def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    return lambda v: [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return lambda v: [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]


def sub(a, b):
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]


def add(a, b):
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]


# ------------------------------------------------------------------- URDF FK

urdf = ET.parse(fetch("g1_23dof.urdf")).getroot()
materials = {}
for m in urdf.findall("material"):
    c = m.find("color")
    if c is not None:
        materials[m.get("name")] = [float(x) for x in c.get("rgba").split()]

link_visual = {}
for l in urdf.findall("link"):
    v = l.find("visual")
    if v is None:
        continue
    mesh = v.find("geometry/mesh")
    if mesh is None:
        continue
    o = v.find("origin")
    mat = v.find("material")
    link_visual[l.get("name")] = {
        "mesh": mesh.get("filename"),
        "origin": transform(
            [float(x) for x in (o.get("xyz") if o is not None else "0 0 0").split()],
            [float(x) for x in (o.get("rpy") if o is not None else "0 0 0").split()],
        ),
        "material": mat.get("name") if mat is not None else "dark",
    }

joints = {}
children = {}
for j in urdf.findall("joint"):
    o = j.find("origin")
    xyz = [float(x) for x in (o.get("xyz") if o is not None else "0 0 0").split()]
    rpy = [float(x) for x in (o.get("rpy") if o is not None else "0 0 0").split()]
    parent, child = j.find("parent").get("link"), j.find("child").get("link")
    joints[j.get("name")] = (parent, child)
    children.setdefault(parent, []).append((child, transform(xyz, rpy), j.get("name")))

link_world = {"pelvis": [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]}
joint_world = {}
stack = ["pelvis"]
while stack:
    p = stack.pop()
    for child, t, jname in children.get(p, []):
        w = mat_mul(link_world[p], t)
        link_world[child] = w
        joint_world[jname] = to_three([w[0][3], w[1][3], w[2][3]])
        stack.append(child)

# Ground = lowest point of the feet in the zero pose
def read_stl(path):
    data = open(path, "rb").read()
    n = struct.unpack_from("<I", data, 80)[0]
    tris = []
    off = 84
    for _ in range(n):
        vals = struct.unpack_from("<12f", data, off)
        tris.append((vals[3:6], vals[6:9], vals[9:12]))
        off += 50
    return tris


# -------------------------------------------------------- pivots & arm fix-up

pelvis = [0.0, 0.0, 0.0]
pivots = {"Hips": pelvis, "Spine2": joint_world["waist_yaw_joint"]}
arm_xf = {}
for side, sgn in (("left", 1), ("right", -1)):
    S = side.capitalize()
    pivots[f"{S}UpLeg"] = joint_world[f"{side}_hip_pitch_joint"]
    pivots[f"{S}Leg"] = joint_world[f"{side}_knee_joint"]
    pivots[f"{S}Foot"] = joint_world[f"{side}_ankle_pitch_joint"]
    shoulder = joint_world[f"{side}_shoulder_pitch_joint"]
    elbow = joint_world[f"{side}_elbow_joint"]
    wrist = joint_world[f"{side}_wrist_roll_joint"]
    # Upper arm hangs down -> rotate about Z so it points along ±X (T-pose).
    up_dir = sub(elbow, shoulder)
    a1 = (0.0 if sgn > 0 else math.pi) - math.atan2(up_dir[1], up_dir[0])
    r1 = rot_z(a1)
    elbow_r = add(shoulder, r1(sub(elbow, shoulder)))
    wrist_r = add(shoulder, r1(sub(wrist, shoulder)))
    # Forearm points forward -> rotate about Y around the elbow so it continues along ±X.
    fa = sub(wrist_r, elbow_r)
    a2 = (math.pi / 2 if sgn > 0 else -math.pi / 2) - math.atan2(fa[0], fa[2])
    r2 = rot_y(a2)
    wrist_rr = add(elbow_r, r2(sub(wrist_r, elbow_r)))
    pivots[f"{S}Arm"] = shoulder
    pivots[f"{S}ForeArm"] = elbow_r
    pivots[f"{S}Hand"] = wrist_rr
    arm_xf[f"{S}Arm"] = lambda v, s=shoulder, r1=r1: add(s, r1(sub(v, s)))
    arm_xf[f"{S}ForeArm"] = lambda v, s=shoulder, e=elbow_r, r1=r1, r2=r2: add(e, r2(sub(add(s, r1(sub(v, s))), e)))
    arm_xf[f"{S}Hand"] = arm_xf[f"{S}ForeArm"]

# --------------------------------------------------------------- mesh baking

def cluster(tris):
    index = {}
    pos = []
    idx = []
    for tri in tris:
        ids = []
        for v in tri:
            key = (round(v[0] / CELL), round(v[1] / CELL), round(v[2] / CELL))
            i = index.get(key)
            if i is None:
                i = len(pos) // 3
                index[key] = i
                pos.extend(v)
            ids.append(i)
        if ids[0] != ids[1] and ids[1] != ids[2] and ids[0] != ids[2]:
            idx.extend(ids)
    return pos, idx


parts = []
blob = bytearray()
min_y = 1e9
for bone, links in BONES.items():
    pivot = pivots[bone]
    xf = arm_xf.get(bone)
    by_mat = {}
    for link in links:
        vis = link_visual.get(link)
        if not vis:
            continue
        m = mat_mul(link_world[link], vis["origin"])
        tris = read_stl(fetch(vis["mesh"]))
        out = by_mat.setdefault(vis["material"], [])
        for tri in tris:
            vs = []
            for v in tri:
                w = to_three(apply(m, v))
                if xf:
                    w = xf(w)
                if bone.endswith("Foot"):
                    min_y = min(min_y, w[1])
                vs.append(sub(w, pivot))
            out.append(vs)
    for mat, tris in by_mat.items():
        pos, idx = cluster(tris)
        p_off = len(blob)
        blob += struct.pack(f"<{len(pos)}f", *pos)
        i_off = len(blob)
        blob += struct.pack(f"<{len(idx)}I", *idx)
        parts.append({
            "bone": bone,
            "material": mat,
            "color": materials.get(mat, [0.3, 0.3, 0.3, 1]),
            "positions": [p_off, len(pos)],
            "indices": [i_off, len(idx)],
        })
        print(f"{bone:14s} {mat:6s} tris {len(tris):6d} -> {len(idx)//3:6d}")

# Bone pivots relative to their skeleton parents (metres) so the runtime can re-proportion the rig.
parent = {
    "Spine2": "Hips", "LeftUpLeg": "Hips", "RightUpLeg": "Hips",
    "LeftLeg": "LeftUpLeg", "RightLeg": "RightUpLeg",
    "LeftFoot": "LeftLeg", "RightFoot": "RightLeg",
    "LeftArm": "Spine2", "RightArm": "Spine2",
    "LeftForeArm": "LeftArm", "RightForeArm": "RightArm",
    "LeftHand": "LeftForeArm", "RightHand": "RightForeArm",
}
offsets = {b: sub(pivots[b], pivots[p]) for b, p in parent.items()}

os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, "g1.bin"), "wb").write(blob)
json.dump(
    {
        "source": "unitreerobotics/unitree_ros g1_23dof (BSD-3-Clause)",
        "pelvisHeight": -min_y,
        "offsets": offsets,
        "parts": parts,
    },
    open(os.path.join(OUT, "g1.json"), "w"),
    indent=1,
)
print("pelvis height", round(-min_y, 3), "bin MB", round(len(blob) / 1e6, 2))
print({k: [round(x, 3) for x in v] for k, v in offsets.items()})
