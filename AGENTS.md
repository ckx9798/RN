# 프로젝트 작업 지침

Expo SDK 57과 React Native 0.86 기반의 iOS·Android 모바일 앱입니다.
모바일 우선 패턴, 성능과 두 플랫폼 호환성을 우선합니다. 웹은 지원하지
않습니다.

## 규칙 우선순위

충돌이 생기면 다음 순서로 판단합니다.

1. 현재 작업에서 사용자가 명시한 요구사항
2. 이 `AGENTS.md`
3. `CONTRIBUTING.md`와 `docs/rules/`의 기준 문서
4. 승인된 설계와 구현 계획
5. 기존 코드의 관례

동일한 우선순위의 문서가 충돌하면 더 최근에 승인된 결정을 적용하고
오래된 문서를 함께 갱신합니다. 두 가지로 해석되는 요구사항은 임의로
선택하지 말고 확인합니다.

## Expo는 공식 문서로 확인

Expo는 SDK 릴리스마다 API가 바뀔 수 있습니다. Expo, EAS 또는 React
Native API를 사용하는 코드를 쓰기 전에 다음을 수행합니다.

1. `package.json`에서 `expo` major 버전을 확인합니다. 현재는 SDK 57입니다.
2. `https://docs.expo.dev/versions/v<major>.0.0/`의 버전 문서를 읽습니다.
3. 다른 주제는 `https://docs.expo.dev/llms.txt`에서 공식 페이지를 찾아
   읽습니다.
4. 기억하고 있는 API 이름이나 예제에 의존하지 않습니다.

상세 기준: [`docs/rules/development.md`](docs/rules/development.md)

## 명령어

현재 `package-lock.json`을 사용하므로 `npx`를 사용합니다. `bun.lock`으로
전환된 경우에만 `bunx`를 사용합니다.

```bash
npx expo install <package>
npx expo start
npx expo lint
npx tsc --noEmit
npx expo-doctor
npx expo install --fix
```

- 새 의존성은 사용자 승인을 먼저 받고 `npx expo install`로 추가합니다.
- 상태 관리, 데이터 패칭과 로컬 스토리지 라이브러리는 항상 사전
  승인받습니다.
- 검증 명령이 설정 생성이나 의존성 자동 설치를 요구하면 중단하고
  승인받습니다.

## 플랫폼 범위

**iOS와 Android만 대상으로 하며 웹은 대상이 아닙니다.**

- `.web.tsx` 분기 파일을 새로 만들지 않습니다.
- `Platform.OS`와 `Platform.select`는 iOS·Android 차이에만 사용합니다.
- iOS 전용 API에는 Android 폴백을 함께 구현합니다.
- CNG 프로젝트의 `ios/`, `android/` 디렉터리를 직접 만들거나 수정하지
  않습니다. 네이티브 동작은 app config와 config plugin으로 설정합니다.
- 네이티브 코드가 있는 라이브러리를 추가하면 개발 빌드 필요 여부를
  확인합니다.

기존 Expo 템플릿의 다음 웹 잔재는 Task N1(FSD 이동 작업)에서 제거했습니다.

- `src/components/animated-icon.web.tsx`
- `src/components/animated-icon.module.css`
- `src/components/app-tabs.web.tsx`
- `src/components/web-badge.tsx`
- `src/hooks/use-color-scheme.web.ts`
- `src/global.css`와 해당 임포트
- `app.json`의 `expo.web`
- `package.json`의 `web` 스크립트

## FSD 프로젝트 구조

```text
src/app/       Expo Router 라우트와 앱 초기화
src/pages/     화면 단위 슬라이스
src/widgets/   여러 기능을 조합한 화면 블록
src/features/  사용자 행동 단위 기능
src/shared/    공용 UI, 유틸리티와 설정
assets/        이미지와 폰트
```

- 의존 방향은 `app → pages → widgets → features → shared`입니다.
- `src/app/`에는 라우트와 `_layout.tsx`만 둡니다.
- 실제 화면 구현은 `src/pages/<slice>/`에 둡니다.
- 슬라이스 외부에서는 `index.ts` public API를 사용합니다.
- 프로젝트 내부 임포트는 `@/` alias를 사용합니다.
- 파일명은 kebab-case, 컴포넌트는 PascalCase를 사용합니다.
- named export를 기본으로 하되 Expo Router 연결에는 default export를
  유지합니다.
- 빈 레이어와 세그먼트를 미리 만들지 않습니다.

상세 기준: [`docs/rules/architecture.md`](docs/rules/architecture.md)

## 라우팅, 스타일과 상태

- 모든 네비게이션은 Expo Router를 사용합니다.
- typed routes 오류를 임의 문자열 캐스팅으로 우회하지 않습니다.
- NativeWind가 설치되기 전에는 `className`을 사용하지 않습니다.
- 도입 전에는 기존 테마 토큰과 `useTheme`을 사용하고 색상을 직접
  하드코딩하지 않습니다.
- NativeWind 도입은 SDK 57·React Native 0.86 호환성을 공식 문서로
  확인하고 사용자 승인 후 진행합니다.
- 상태는 `useState` → Context → 상태 라이브러리 순서로 승급합니다.
- 서버가 생기기 전에 API 계층을 미리 만들지 않습니다.

## 작업 범위와 품질

- 기존 diff와 코드 패턴을 먼저 읽고 사용자 변경을 보존합니다.
- 요청 범위 밖의 리팩터링을 하지 않습니다.
- 한 파일은 하나의 책임만 가지도록 분리합니다.
- 대체한 코드, 템플릿 잔재와 죽은 파일을 남기지 않습니다.
- 접근성, 모바일 성능, 다크 모드와 iOS·Android 동작을 확인합니다.
- 비밀정보와 개인정보를 저장소나 로그에 남기지 않습니다.

## 검증과 완료 기준

- TypeScript·React Native 코드 변경은 `npx expo lint`와
  `npx tsc --noEmit`이 모두 통과해야 완료로 선언합니다.
- 관련 테스트가 있으면 함께 통과해야 합니다.
- 문서 전용 변경은 `git diff --check`와 링크·경로·명령어를 확인합니다.
- 실행하지 않은 검증을 통과했다고 기록하지 않습니다.
- 기존 오류가 있으면 요청 범위와의 관련성을 구분해 보고합니다.
- `expo-env.d.ts`와 `.expo/types`가 없는 새 clone에서는 개발 서버를 한
  번 실행한 뒤 생성된 타입을 기준으로 판단합니다.

## Git과 외부 상태 변경

- 저장소 파일을 변경하는 작업은 최신 `main`을 기준으로 새 worktree와
  목적별 브랜치를 만든 뒤 진행합니다. `main` 작업공간에서 직접 파일을
  수정하거나 커밋하지 않습니다.
- 표준 순서는 `새 worktree 생성 → 구현·검증 → commit → push → PR →
  main 병합`입니다. 읽기 전용 분석과 상태 확인은 새 worktree 없이
  수행할 수 있습니다.
- commit, push, PR 생성, Ready 전환, 병합과 배포는 각각 별도 권한입니다.
- 사용자가 명시적으로 요청한 단계까지만 수행합니다.
- 다른 작업자의 변경을 restore, reset 또는 checkout으로 제거하지
  않습니다.
- 강제 push, 브랜치 삭제, PR 병합과 배포는 항상 명시적 승인을 받습니다.
- 한 커밋과 한 PR에는 하나의 목적만 포함합니다.

상세 기준: [`docs/rules/workflow.md`](docs/rules/workflow.md)

## 커밋 메시지

```text
<type>(<scope>): <명사형 제목>
```

- 콜론 뒤에는 공백을 하나 둡니다.
- 제목은 한글 50자 이내의 명사형으로 작성합니다.
- `추가하라`, `구현하라` 같은 명령형·동사형을 사용하지 않습니다.
- `문서 추가`, `화면 구현`, `오류 수정`처럼 변경 결과를 명확히 씁니다.
- 제목 다음에 빈 줄을 두고 변경 이유, 사용자 영향과 검증 결과를
  본문에 포함합니다.
- 본문은 72자 안팎에서 줄바꿈합니다.

## 문서와 배포

- 설계는 `docs/superpowers/specs/`, 구현 계획은
  `docs/superpowers/plans/`에 둡니다.
- 구현 완료 결과는 PR 번호를 확보한 뒤 `docs/history/`에 PR 단위로
  기록합니다.
- 문서 분류와 이력 형식은
  [`docs/rules/documentation.md`](docs/rules/documentation.md)를 따릅니다.
- EAS Build, Submit, Update는 각각 명시적 요청이 있을 때만 실행합니다.
- 배포 상세 기준은 [`docs/rules/release.md`](docs/rules/release.md)를
  따릅니다.
