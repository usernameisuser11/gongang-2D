# Moonlit lookout — original mesh asset

The **moonlit-lookout.obj** is a modeled scenic landmark (bench with curved ironwork, beveled timber planks, wrought metal lantern, weathered stones, ferns and flowers). It is intended as an atmospheric foreground element in Gongang's existing Three.js diorama.

- Blender: **File → Import → Wavefront (.obj)**. Then select `moonlit-lookout.obj`. Both OBJ and MTL are editable assets. No downloads from stock libraries.
- Three.js: `public/scenic-model-loader.js` parses the small OBJ model once and groups mesh geometry by material.
- Coordinate system: y-up, roughly 8.7 × 3.2 × 6 units, origin at ground level.
- Target: a scenic detail layer, not a replacement for the existing mountains, starfield, people, or multiplayer.
- The .obj is generated independently; Blender is not a runtime dependency. A native .blend scene has **not** been produced or verified.
- The existing 2D Canvas2D fallback still runs without WebGL.

Model generated for the Gongang project. Keep the model file, material file and loader together.
