# 공강 2D — 블렌더 원본 풍경 제작

이 브랜치는 기존 별빛 전망대, 익명 동행(8명), 사진 촬영, 이벤트를 유지한 상태에서 풍경만 **Blender로 제작한 실시간 3D 장면**으로 비교하는 실험이야. 운영 Railway는 아직 이전 브랜치에 연결되어 있어.

## 실제 제작 파일

- Blender 조형 코드: blender/build_cinematic_valley.py
- 편집 가능한 원본: blender/output/gongang-cinematic-valley.blend
- 웹 렌더용 모델: public/assets/models/blender-cinematic-valley.glb
- Blender 렌더 미리보기: blender/output/cinematic-valley-night.png
- 웹 실시간 조명/하늘: public/blender-vista-3d.js
- 시험 URL: /?map=stargaze&renderer=blender

예전처럼 OBJ를 가져와 편집 가능하게만 만들지 않고, Blender에서 연속 지형, 소나무와 활엽수의 개별 가지·수관, 불규칙 바위, 강, 풀밭을 생성해. 나무는 연결된 메쉬 데이터를 공유해 원본에서 위치·크기·회전을 개별 편집할 수 있어.

## 자동화

GitHub Actions의 build-blender-vista 작업이 블렌더 원본, GLB, PNG를 자동 생성하고 별도 브랜치에 저장해. 로컬에서도 다음 명령으로 재생성할 수 있어.

    blender --background --python blender/build_cinematic_valley.py -- --render

Blender의 프리뷰 조명과 웹의 실시간 조명은 구별돼. 웹에서는 실제 시간 및 기상에 따라 다른 분위기를 내고, 원본 모델 파일은 그대로 유지해.

## 안전장치

- WebGL2 미지원, 네트워크 오류, 모델 없음에는 기존 풍경으로 복귀
- 실제 접속자와 사진 기능은 원래 Canvas 시스템 사용
- 현재 기본 렌더러는 건드리지 않음. renderer=blender에서만 활성화
- 미리보기 확인 전 Railway 배포 브랜치 변경 금지

## 품질 기준

첫 자동 렌더는 구조 검증용 시안일 뿐 완성작이 아니야. 계곡의 깊이, 숲 실루엣, 나무 질감, 모바일 세로 구도, 시간·날씨별 장면, 8인 동행과 사진 기능, 모바일 FPS까지 확인한 뒤에 운영 적용 여부를 결정해. 특히 Ori나 Planet of Lana 수준에 도달했다고 성급하게 판단하지 않아.
