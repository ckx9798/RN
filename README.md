# RN

Expo SDK 57과 React Native 0.86으로 만드는 iOS·Android 모바일 앱입니다.
Expo Router의 파일 기반 라우팅과 TypeScript strict mode를 사용합니다.
웹은 지원 대상이 아닙니다.

## 기술 구성

- Expo SDK 57 (`expo ~57.0.24`)
- React Native 0.86.3
- React 19.2.3
- Expo Router
- TypeScript 6 strict mode
- npm과 `package-lock.json`

## 시작하기

Node.js와 npm을 준비한 뒤 의존성을 설치합니다.

```bash
npm install
```

개발 서버를 실행합니다.

```bash
npx expo start
```

터미널 안내에서 iOS 또는 Android 대상을 선택합니다. 네이티브 모듈이
Expo Go에 포함되지 않은 경우 개발 빌드가 필요합니다.

## 주요 명령어

```bash
npx expo start
npx expo lint
npx tsc --noEmit
npx expo-doctor
npx expo install --fix
```

새 Expo 호환 의존성은 승인 후 다음 형식으로 설치합니다.

```bash
npx expo install <package>
```

## 프로젝트 구조

프로젝트는 축소된 Feature-Sliced Design을 목표 구조로 사용합니다.

```text
src/app/       Expo Router 라우트와 앱 초기화
src/pages/     화면 단위 슬라이스
src/widgets/   여러 기능을 조합한 화면 블록
src/features/  사용자 행동 단위 기능
src/shared/    공용 UI, 유틸리티와 설정
assets/        이미지와 폰트
docs/          규칙, 설계, 계획, 조사와 PR 이력
```

현재 템플릿 구조에서 FSD 구조로 이동하는 중입니다. 새 코드의 위치와
레이어 의존 방향은 [아키텍처 규칙](docs/rules/architecture.md)을
따릅니다.

## 검증

TypeScript 또는 React Native 코드를 변경한 작업은 다음 명령이 모두
통과해야 완료로 판단합니다.

```bash
npx expo lint
npx tsc --noEmit
```

문서만 변경한 경우에는 `git diff --check`와 링크·경로·명령어를
확인합니다. 변경 유형별 전체 기준은
[개발 규칙](docs/rules/development.md)을 참고합니다.

## 프로젝트 규칙

- [기여 안내](CONTRIBUTING.md)
- [문서 지도](docs/README.md)
- [아키텍처 규칙](docs/rules/architecture.md)
- [개발 규칙](docs/rules/development.md)
- [Git 및 PR 규칙](docs/rules/workflow.md)
- [문서 관리 규칙](docs/rules/documentation.md)
- [배포 규칙](docs/rules/release.md)

AI 에이전트는 루트의 [`AGENTS.md`](AGENTS.md)를 먼저 따릅니다.
