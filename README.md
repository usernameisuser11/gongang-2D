# 공강 2D

별도의 2D 멀티플레이·사진 촬영 사이트입니다.

- Railway: Node.js WebSocket server (`/presence`)와 정적 사이트
- Supabase: 익명 방문 기록만 저장 (`gongang2d_visits`)
- 같은 풍경에 최대 8명 접속, 실시간 위치·행동 동기화
- 4:5 사진 촬영, 포토존, 모바일 우선

기존 3D `gongang`과 별도 운영합니다.

`npm install && npm start` 로 로컬 실행합니다.
