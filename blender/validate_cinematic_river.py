"""Geometry-level checks for the editable cinematic valley Blender scene.

Run: blender --background blender/output/gongang-cinematic-valley.blend \
    --python blender/validate_cinematic_river.py
"""
import bpy
import math

terrain = next(o for o in bpy.data.objects if o.name.startswith('Terrain | one uninterrupted sculpt'))
river = next(o for o in bpy.data.objects if o.name.startswith('River | true sculpted winding ribbon'))

across = 9
vertices = river.data.vertices
assert len(vertices) % across == 0, 'Water grid has incomplete rows'
sections = len(vertices) // across
assert sections >= 300, 'Water course has too few sections'
assert len(river.data.polygons) == (sections - 1) * (across - 1)

min_clearance = float('inf')
max_surface_drop = 0.0
previous_level = None
for row in range(sections):
    current = []
    for column in range(across):
        point = vertices[row * across + column].co
        hit, location, _, _ = terrain.ray_cast((point.x, point.y, 120), (0, 0, -1))
        assert hit, f'Missing ground below the river at {point.x:.2f}, {point.y:.2f}'
        clearance = point.z - location.z
        min_clearance = min(clearance, clearance)
        assert clearance > .21, f'Water intersects the terrain: {clearance:.3f} m in row {row}'
        current.append(point.z)
    level = sum(current) / across
    if previous_level is not None:
        max_surface_drop = max(max_surface_drop, abs(level - previous_level))
        # River rows go from far upstream to the nearer, lower terrace.
        assert level < previous_level + .004, f'Water unexpectedly rises at row {row}'
    previous_level = level

assert max_surface_drop < .045, f'Abrupt river slope step: {max_surface_drop:.3f}'
print(f'PASS continuous river: {sections} sections; '
      f'min bed clearance {min_clearance:.3f} m; '
      f'max slope step {max_surface_drop:.3f} m')
