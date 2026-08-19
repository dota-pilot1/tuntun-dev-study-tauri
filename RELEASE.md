# 튼튼 개발 학습 앱 배포 메모

## 주소

- API: `https://study-api.dxline-tallent.com`
- 로컬 API: `http://localhost:4302`
- 개발 웹뷰: `http://localhost:4330`

API 주소를 바꿀 때는 `VITE_API_BASE` 환경변수와
`src-tauri/capabilities/default.json`의 허용 origin을 함께 확인합니다.

## 자동 업데이트

릴리즈 저장소는 `dota-pilot1/tuntun-dev-study-tauri`를 사용합니다.

## 첫 릴리즈 준비

1. 이 폴더를 별도 저장소로 푸시합니다.
2. 저장소 Secrets에 `VITE_API_BASE`, `TAURI_SIGNING_PRIVATE_KEY`,
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`를 개발 학습 앱 전용으로 등록합니다.
3. `package.json`과 `src-tauri/tauri.conf.json`의 버전을 올리고 같은 버전의 태그를 푸시합니다.

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions가 Windows 설치 파일과 macOS universal DMG, updater `latest.json`을 자동으로
GitHub Release에 게시합니다.
