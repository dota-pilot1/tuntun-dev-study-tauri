# tuntun-dev-study-tauri

튼튼 프로젝트의 개발 학습과 구현 기록을 정리하기 위한 Tauri 데스크톱 앱입니다.
기존 키오스크 앱의 인증, 좌측 메뉴 레이아웃, 개발 노트의 3단 구조를 재사용하고
학습 콘텐츠와 화면은 독립적으로 확장합니다.

## 실행

```bash
npm install
npm run dev
```

Tauri 데스크톱으로 실행하려면:

```bash
npm run tauri dev
```

웹 개발 서버는 `http://localhost:4330`을 사용합니다.
배포 API 기본 주소는 `https://dxline-tallent.com`이며,
로컬에서는 튼튼 병원 서버 `http://localhost:4301`을 함께 사용합니다.
개발 기본 계정은 `terecal@daum.net / password123`로 미리 입력됩니다.

## 확장 방향

- 개발 학습 노트: 기술 → 주제 → 문서
- 프로젝트별 구현 기록과 회고
- 코드 조각, 체크리스트, 참고 링크
- Spring Boot API 연동을 통한 동기화

이 앱은 `tuntun-kiosk-chatbot-tauri`와 별도 Tauri 앱으로 관리하므로
메뉴와 화면을 서로 독립적으로 변경할 수 있습니다.
