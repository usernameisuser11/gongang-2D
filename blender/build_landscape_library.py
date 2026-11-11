"""Exported Gongang landscape OBJ collection into editable Blender .blend sources.

Optional authoring tool, never needed for the web site or multiplayer.
Run from the cloned repository root:
  blender --background --python blender/build_landscape_library.py
Produces: blender/alpine-valley.blend and blender/alpine-pine.blend.
This script requires Blender 4.3+; it has not been executed in ChatGPT.
"""
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "assets" / "models"
TARGET_DIR = ROOT / "blender"


def make_project(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = str(ASSET_DIR / (name + ".obj"))
    # Wavefront OBJ is Y-up; Blender is Z-up.
    bpy.ops.wm.obj_import(
        filepath=source, forward_axis="NEGATIVE_Z", up_axis="Y"
    )

    imported = [obj for obj in bpy.context.selected_objects if obj.type == "MESH"]
    assert imported, "No meshes imported: " + source
    for obj in imported:
        obj.name = "Gongang_" + obj.name
        for slot in obj.material_slots:
            material = slot.material
            if material is None:
                continue
            material.use_nodes = True
            shader = material.node_tree.nodes.get("Principled BSDF")
            if shader is None:
                continue
            shader.inputs["Roughness"].default_value = 0.91
            if "PineNeedles" in material.name:
                shader.inputs["Roughness"].default_value = 0.80
            shader.inputs["Metallic"].default_value = 0.0

    bpy.ops.wm.save_as_mainfile(filepath=str(TARGET_DIR / (name + ".blend")))
    print("Editable Blender asset saved:", name, len(imported))


TARGET_DIR.mkdir(parents=True, exist_ok=True)
for name in ("alpine-valley", "alpine-pine"):
    make_project(name)
