# 나의 웹앱 허브

봄꽃 배경의 개인 일기장과 학생 기록 도구입니다.

- 로컬 실행: `cd diary-app` 후 `node server.mjs`. SQLite 데이터는 `diary-app/data/`에 저장됩니다.
- 웹 배포: GitHub Pages에 정적 화면을 배포하고 Firebase Google 로그인과 Firestore를 사용합니다.
- 로컬 일기, 학생 명단, 기록, 화면 캡처는 저장소와 배포 파일에 포함되지 않습니다.
- 기존 로컬 데이터는 클라우드로 자동 이전되지 않습니다.

## Firebase 설정

1. Firebase 프로젝트에서 웹 앱과 Google 로그인 공급자를 등록합니다.
2. Firestore 데이터베이스를 생성하고 `diary-app/firestore.rules`를 배포합니다. 테스트 모드 공개 규칙을 사용하지 마세요.
3. `diary-app/cloud/firebase-config.public.json`에 Firebase Web SDK 공개 설정(`apiKey`, `authDomain`, `projectId`, `appId`)과 `configured: true`를 넣습니다. 서비스 계정 키나 OAuth 클라이언트 비밀은 넣지 마세요.
4. Authentication 허용 도메인에 GitHub Pages 호스트 이름을 등록합니다. 경로나 포트, 프로토콜은 제외합니다.
5. 저장소 Settings → Pages → GitHub Actions를 선택합니다. main 브랜치의 workflow가 정적 허용 목록만 배포합니다.

## 검사

`cd diary-app` 후 `node --test`. 웹 빌드는 `node scripts/build-pages.mjs`.
프로젝트 연결 전 화면 검사는 `node scripts/build-pages.mjs --preview`로 가능하며, 이 빌드는 데이터 접근을 차단합니다.

보안 규칙 검사는 `.github/workflows/security-rules.yml`이 임시 Firebase 에뮬레이터에서 실행합니다. Firebase/GitHub 비밀 키 없이 테스트합니다.
보안 검토와 한계는 `SECURITY.md`를 확인하세요.
