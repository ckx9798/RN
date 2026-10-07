# 배포 규칙

## 원칙

EAS를 사용해 빌드, 서명, 제출과 OTA 업데이트를 수행한다. 로컬 Xcode나
Android Studio를 공식 배포 경로로 사용하지 않는다.

Build, Submit, Update는 각각 외부 상태를 바꾸는 별도 작업이다. 사용자가
명시적으로 요청한 단계까지만 실행한다.

공식 기준:

- [Expo Application Services](https://docs.expo.dev/eas/)
- [프로덕션 빌드](https://docs.expo.dev/deploy/build-project/)
- [스토어 제출](https://docs.expo.dev/deploy/submit-to-app-stores/)
- [OTA 업데이트](https://docs.expo.dev/deploy/send-over-the-air-updates/)
- [런타임 버전](https://docs.expo.dev/eas-update/runtime-versions/)

## CLI

현재 npm 프로젝트에서는 전역 `eas` 명령 대신 다음 형식을 사용한다.

```bash
npx eas-cli@latest <command>
```

Bun 프로젝트로 전환된 경우에는 `bunx eas-cli <command>`를 사용한다.

## 빌드 프로필

실제 `eas.json`을 추가할 때 다음 목적을 분리한다.

- development: 네이티브 모듈과 디버깅을 포함한 개발 빌드
- preview: 내부 검토와 QA를 위한 배포 가능한 빌드
- production: 앱 스토어 제출용 서명 빌드

현재 `eas.json`에는 승인된 Android 테스트용 `preview` 프로필만 있다.
내부 배포용 APK를 생성하며 개발 서버 없이 실행한다. 웹 앱 URL은
`EXPO_PUBLIC_WEB_APP_URL`로 공개된 Vercel 운영 주소를 사용한다.
development·production 프로필과 OTA 채널은 아직 설정하지 않았다.
추가 프로필이나 배포 채널 도입은 별도 설계와 승인을 거친다.

## EAS Build

- 빌드 전에 대상 플랫폼, 프로필과 배포 목적을 확인한다.
- `npx expo-doctor`, lint, typecheck와 관련 테스트 결과를 확인한다.
- 네이티브 의존성이나 config plugin 변경을 포함하면 새 바이너리가
  필요한지 확인한다.
- iOS 인증서와 Android keystore를 저장소에 커밋하지 않는다.
- 빌드 URL과 결과를 PR 또는 배포 기록에 남긴다.
- 실패한 빌드를 성공으로 기록하지 않고 오류와 재시도 여부를 남긴다.

## EAS Submit

- 제출 전에 production 빌드와 대상 스토어를 명확히 지정한다.
- 앱 버전, 빌드 번호, 스토어 메타데이터와 개인정보 표시를 확인한다.
- Submit 요청은 Build 요청에 포함된 것으로 간주하지 않는다.
- 제출 결과와 스토어 처리 상태를 기록한다.

## EAS Update

- Update는 설치된 네이티브 런타임과 호환되는 JavaScript와 asset 변경에만
  사용한다.
- 네이티브 모듈, config plugin, 권한 또는 네이티브 설정 변경을 OTA로
  배포하지 않는다.
- 대상 채널·브랜치, 런타임 버전과 배포 메시지를 실행 전에 확인한다.
- production OTA는 사용자 승인 없이 실행하지 않는다.
- 업데이트 URL, 대상과 rollback 판단 기준을 배포 기록에 남긴다.

## 환경변수와 비밀

- 공개 가능한 클라이언트 설정과 서버 비밀값을 구분한다.
- `EXPO_PUBLIC_*` 값은 앱 번들에서 읽을 수 있으므로 비밀값을 넣지
  않는다.
- 서명 키, 토큰, 서비스 계정과 인증서는 EAS Secrets 또는 승인된 비밀
  관리 수단을 사용한다.
- 로컬 비밀 파일을 Git에 추가하지 않는다.
- 배포 로그와 PR 본문에 비밀값을 복사하지 않는다.

## 제출 전 확인

- 대상 플랫폼과 프로필
- 앱 버전과 빌드 번호
- lint, typecheck, 테스트와 Expo Doctor 결과
- iOS·Android 핵심 흐름 확인
- 권한 문구와 개인정보 처리 내용
- 환경변수와 비밀값 주입 상태
- 사용자에게 보이는 변경과 릴리스 노트
- rollback 또는 이전 버전 복구 방법

## 실패와 rollback

- 실패 원인과 영향을 확인하기 전에 동일 명령을 반복하지 않는다.
- OTA 문제는 호환되는 이전 업데이트로 되돌릴 수 있는지 우선 확인한다.
- 네이티브 바이너리 문제는 수정 빌드와 스토어 제출이 필요함을 명시한다.
- rollback, 재빌드와 재제출도 각각 사용자 승인 후 실행한다.
