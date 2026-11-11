"""Open an original Gongang Wavefront mesh in Blender and save an editable .blend.

Usage from the cloned project root:
  blender --background --python blender/prepare_moonlit_lookout.py

The website never needs Blender to run. This optional asset-authoring script
sets up a look-development scene without downloading third-party models.
Tested for Python syntax only; Blender is not installed in the build sandbox.
"""
from pathlib import Path
import math
import bpy

ROOT = Path(__file__).resolve().parents[1]
OBJ = ROOT / "public" / "assets" / "models" / "moonlit-lookout.obj"
OUTPUT = ROOT / "blender" / "moonlit-lookout.blend"

bpy.ops.wm.read_factory_settings(use_empty=True)

# Blender 4.x has built-in Wavefront import. Convert the source y-up OBJ
# to Blender z-up, preserving correct object proportions and material names.
if hasattr(bpy.ops.wm, "obj_import"):
    bpy.ops.wm.obj_import(filepath=str(OBJ), forward_axis="NEGATIVE_Z", up_axis="Y")
else:
    bpy.ops.import_scene.obj(filepath=str(OBJ), axis_forward="-Z", axis_up="Y")

asset_objects = [obj for obj in bpy.context.selected_objects if obj.type == "MESH"]
for item in asset_objects:
    item.name = "Gongang_" + item.name
    for slot in item.material_slots:
        if not slot.material:
            continue
        mat = slot.material
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if not bsdf:
            continue
        bsdf.inputs["Roughness"].default_value = 0.84
        if "Iron" in mat.name or "LanternMetal" in mat.name:
            bsdf.inputs["Metallic"].default_value = 0.38
            bsdf.inputs["Roughness"].default_value = 0.50
        if mat.name == "LanternGlow":
            bsdf.inputs["Emission Color"].default_value = (1.0, 0.43, 0.12, 1.0)
            bsdf.inputs["Emission Strength"].default_value = 2.0

# Asset visualization only; don't export floor or lighting into the web mesh.
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.36))
floor = bpy.context.object
floor.name = "Preview floor - not an asset"
surface = bpy.data.materials.new("Dark soil - preview")
surface.diffuse_color = (0.037, 0.064, 0.075, 1)
floor.data.materials.append(surface)

def area(name, location, energy, size, color):
    bpy.ops.object.light_add(type="AREA", location=location)
    lamp = bpy.context.object
    lamp.name = name
    lamp.data.energy = energy
    lamp.data.shape = "DISK"
    lamp.data.size = size
    lamp.data.color = color
    return lamp

area("Cool moonlight", (6, -8, 9), 1450, 9, (0.54, 0.69, 1.0))
area("Soft fill", (-7, 2, 6), 950, 8, (0.38, 0.70, 0.80))
area("Warm lantern light", (3, 0, 3), 230, 2.4, (1.0, 0.55, 0.22))

bpy.ops.object.camera_add(location=(9.8, -12.5, 6.6))
camera = bpy.context.object
camera.name = "Asset preview camera"
target = (0.0, 0.0, 1.25)
direction = tuple(target[i] - camera.location[i] for i in range(3))
from mathutils import Vector
camera.rotation_euler = Vector(direction).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 11.4
bpy.context.scene.camera = camera

world = bpy.context.scene.world
world.use_nodes = True
background = world.node_tree.nodes.get("Background")
background.inputs["Color"].default_value = (0.035, 0.058, 0.090, 1)
background.inputs["Strength"].default_value = 0.55

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x = 1400
scene.render.resolution_y = 950
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(ROOT / "blender" / "moonlit-lookout-preview.png")
scene.view_settings.view_transform = "AgX"

bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT))
print("Gongang Blender asset saved:", OUTPUT)
# Optional: uncomment the next line to export a still preview.
# bpy.ops.render.render(write_still=True)
