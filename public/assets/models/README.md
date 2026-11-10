# Moonlit lookout — original mesh asset

The **moonlit-lookout.obj** is a modeled scenic landmark (bench with curved ironwork, beveled timber planks, wrought metal lantern, weathered stones, ferns and flowers). It is intended as an atmospheric foreground element in Gongang's existing Three.js diorama.

- Blender: **File → Import → Wavefront (.obj)**. Then select `moonlit-lookout.obj`. Both OBJ and MTL are editable assets. No downloads from stock libraries.
- Three.js: `public/scenic-model-loader.js` parses the small OBJ model once and groups mesh geometry by material.
- Coordinate system: y-up, roughly 8.7 × 3.2 × 6 units, origin at ground level.
- Target: a scenic detail layer, not a replacement for the existing mountains, starfield, people, or multiplayer.
- The .obj is generated independently; Blender is not a runtime dependency. A native .blend scene has **not** been produced or verified.
- The existing 2D Canvas2D fallback still runs without WebGL.

Model generated for the Gongang project. Keep the model file, material file and loader together.

## Blender 편집용 프로젝트 만들기 (선택)

Blender가 설치된 개발 환경에서 `blender --background --python blender/prepare_moonlit_lookout.py`를 실행하면 기존 OBJ를 가져오고 조명·카메라·재질을 설정한 `blender/moonlit-lookout.blend` 파일을 생성합니다. 앱 실행이나 웹 배포에는 필요하지 않습니다. 이 스크립트는 Blender 실행 환경에서 아직 검증하지 못했습니다.
