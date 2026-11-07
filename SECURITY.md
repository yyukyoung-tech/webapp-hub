# 공개 전 보안·개인정보 검토

## 공개 파일과 개인정보 분리

- 원본 명렬표, 추출 JSON, SQLite 및 보조 파일, CSV, 인증 파일, 로그, 화면 캡처를 Git에서 제외합니다.
- Pages 빌드는 정적 UI 파일 13개만 생성합니다. 로컬 DB나 데이터 폴더를 복사하지 않습니다.
- Firebase 설정에는 공개용 Web SDK 식별자만 사용합니다. Firebase API 키는 접근 권한을 부여하는 비밀 키가 아니며, 데이터 접근은 인증과 Security Rules로 제한합니다.
- 실제 학생 이름이 공개 소스 파일에 포함되지 않았는지도 로컬 검사합니다. CI에서는 민감한 파일 경로와 비밀 키 패턴을 검사합니다.

## 사용자별 데이터 접근

- Google 로그인 및 인증된 이메일을 요구합니다. users/{uid} 아래에서 본인 경로만 읽고 쓸 수 있습니다.
- 일기, 학생 기록, 명렬표는 모두 비공개입니다. 다른 사용자와 공유하거나 공개하는 기능은 없습니다.
- Firestore 규칙은 허용 필드·타입·크기·분류, 서버 타임스탬프, 생성 시 버전 및 수정 시 버전 증가를 검증합니다.
- 명렬표에 연결한 학생 기록은 본인 명렬표의 이름·반·번호와 일치해야 합니다.
- 초안과 인증은 세션 범위로 보관하며 Firestore 영구 오프라인 캐시는 활성화하지 않습니다. 로그아웃은 해당 계정의 초안을 삭제합니다.
- 페이지 본문에 사용자 입력을 표시할 때 HTML을 이스케이프합니다. 계정 이름은 textContent로 삽입합니다.
- CSP는 스크립트 공급자를 자기 사이트와 Firebase 공식 CDN으로 제한하며 인라인 스크립트를 허용하지 않습니다.

## 데이터 이전과 남은 한계

- 현재 컴퓨터의 일기·학생 명단은 클라우드에 자동 업로드하지 않습니다. 웹 계정은 빈 상태로 시작합니다.
- Google/Firebase에서 로그인 및 선택한 기록 저장을 처리합니다. 실제 학생 개인정보를 클라우드에 새로 기록하기 전 소속 기관의 사용 기준을 확인해야 합니다.
- 클라우드에는 암호화된 통신·저장소를 사용하지만 종단간 암호화는 제공하지 않습니다. Firebase 프로젝트 관리자 권한도 별도로 관리해야 합니다.
- App Check, 조직 계정 허용 목록, 기관별 공동 접근, 자동 보존기간·복구·감사 로그는 아직 구성하지 않았습니다.
- GitHub Pages는 공용 프런트엔드 호스팅입니다. 비공개 데이터는 이 정적 사이트가 아니라 Firebase 접근 규칙으로 보호합니다.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for private Google-authenticated per-user records with schema and version validation. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

## 로컬 검증 결과 (2026-11-07)

- 앱·입력 검증·정적 배포 패키지 테스트 5개 통과.
- Firestore Standard 에뮬레이터에서 보안 규칙 통합 테스트 4개 통과. 비로그인/타 계정의 조회·목록·생성·수정·삭제, 위조 필드, 버전·타임스탬프 변조, 타 계정 명렬표 연결 차단을 확인했습니다.
- 실제 로컬 명렬표의 이름 252개를 기준으로 공개 대상 텍스트를 검사해 학생 이름 포함 0건, 인증 비밀 패턴 0건을 확인했습니다.
- 이 결과는 로컬 코드와 에뮬레이터 검사입니다. Firebase 실제 프로젝트 및 Google 로그인, GitHub Pages 실제 배포 검증은 별도 완료 확인이 필요합니다.
