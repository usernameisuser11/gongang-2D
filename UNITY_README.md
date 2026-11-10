# 공강 · 별이 머무는 밤 (Unity)

상명대 '공강'을 위한 **Unity 2D 풍경 실험 브랜치**입니다. 기존 웹사이트 코드와 배포용 \`main\` 브랜치는 수정하지 않았습니다.

## 바로 실행하기
1. GitHub에서 \`unity-nightscape\` 브랜치의 ZIP을 내려받아 압축을 풉니다.
2. Unity Hub → **Add project from disk** → 압축을 푼 최상위 폴더를 선택합니다.
3. Unity 6 에디터로 열고, \`Assets/Scenes/Nightscape.unity\`를 더블클릭합니다.
4. 상단 **Play**를 누릅니다.

검은 화면이나 스크립트 연결 오류가 나면 Unity 상단 메뉴 **Gongang → Build or Repair Nightscape Scene**을 실행하고 Play를 다시 눌러보세요. Unity 내부 렌더링은 아직 직접 검증하지 못했습니다.

## 조작
- \`Space\`: 유성우 (14초)
- \`T\`: 밤 / 노을 전환
- \`H\`: 안내 표시 / 숨기기
- \`P\`: 사진 촬영 (Unity Console에 저장 경로 출력)
- \`R\`: 카메라 시점 초기화
- 마우스 또는 손가락 드래그: 시점 이동
- 모바일 더블탭: 유성우

## 구성
- \`Assets/Scenes/Nightscape.unity\` — 프로젝트 기본 씬
- \`Assets/Scripts/NightscapeController.cs\` — 카메라, 입력, 유성우, 사진 기능
- \`Assets/Resources/Nightscape.shader\` — 별빛, 밤하늘, 은은한 은하수, 달, 구름, 산 능선, 물빛 반사
- \`Assets/Editor/NightscapeSceneSetup.cs\` — Unity 버전에 따른 씬 복구 도구
- \`Packages/manifest.json\`, \`ProjectSettings/\` — Unity 프로젝트 기본 정보

실제 사진이나 거대한 에셋을 포함하지 않은 가벼운 절차적 렌더링 방식입니다. 기존 공강의 친구 동행/온라인 네트워크 기능은 이 Unity 프로토타입에 아직 연결하지 않았습니다.
