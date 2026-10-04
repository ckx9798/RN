# 개발 규칙

## 기술 기준

- Expo SDK 57 (`expo ~57.0.26`)
- React Native 0.86 (`react-native 0.86.3`)
- React 19.2
- TypeScript strict mode
- Expo Router와 typed routes
- 지원 플랫폼: iOS와 Android

Expo SDK 57은 React Native 0.86을 대상으로 한다. 버전 호환성은
[Expo SDK 57 공식 문서](https://docs.expo.dev/versions/v57.0.0/)를
기준으로 판단한다.

## 공식 문서 우선

Expo, EAS 또는 React Native API를 사용하는 코드를 작성하기 전에 다음
순서로 확인한다.

1. `package.json`에서 설치된 Expo major 버전을 확인한다.
2. `https://docs.expo.dev/versions/v<major>.0.0/`의 버전 문서를 읽는다.
3. 다른 주제는 [Expo LLM 문서 색인](https://docs.expo.dev/llms.txt)에서
   필요한 공식 페이지를 찾아 읽는다.
4. 기억하고 있는 API 이름이나 예제를 검증 없이 사용하지 않는다.

서드파티 라이브러리보다 Expo가 제공하거나 권장하는 모듈을 우선한다.

## 명령어와 패키지 관리

현재 저장소는 `package-lock.json`을 사용하므로 `npx`를 사용한다.
`bun.lock`으로 전환된 경우에만 `bunx` 규칙으로 바꾼다.

```bash
npm install
npx expo start
npx expo lint
npx tsc --noEmit
npx expo-doctor
npx expo install --fix
```

- 새 의존성은 종류와 도입 이유를 설명하고 사용자 승인을 먼저 받는다.
- 승인된 의존성은 `npm install` 대신 `npx expo install <package>`로
  추가해 SDK 호환 버전을 사용한다.
- 상태 관리, 데이터 패칭과 로컬 스토리지 라이브러리는 항상 사전
  승인을 받는다.
- 검증 명령이 설정 생성이나 패키지 자동 설치를 요구하면 중단하고
  승인받는다. 검증을 이유로 의존성을 몰래 추가하지 않는다.
- package manifest와 lockfile은 같은 커밋에서 변경한다.

## 플랫폼 범위

이 앱은 iOS와 Android만 지원한다.

- `.web.tsx` 분기 파일을 새로 만들지 않는다.
- `react-native-web` 호환성을 위해 네이티브 코드를 우회하지 않는다.
- `Platform.OS`와 `Platform.select`는 iOS와 Android 차이에만 사용한다.
- iOS 전용 API에는 Android 폴백을 함께 제공한다.
- 두 플랫폼에서 사용할 수 없는 기능은 UI에서 지원 범위를 명확히
  표시한다.

기존 Expo 템플릿의 다음 웹 파일과 설정은 FSD 이동 작업에서 제거한다.

- `src/components/animated-icon.web.tsx`
- `src/components/animated-icon.module.css`
- `src/components/app-tabs.web.tsx`
- `src/components/web-badge.tsx`
- `src/hooks/use-color-scheme.web.ts`
- `src/global.css`와 해당 임포트
- `app.json`의 `expo.web`
- `package.json`의 `web` 스크립트

## Continuous Native Generation

- `ios/`와 `android/` 디렉터리가 없다면 생성형 디렉터리로 취급한다.
- 생성형 네이티브 디렉터리를 직접 만들거나 수정하지 않는다.
- 네이티브 설정은 `app.json` 또는 app config와 config plugin으로
  관리한다.
- 네이티브 코드가 있는 라이브러리를 추가하면 Expo Go만으로 검증하지
  않고 개발 빌드 필요 여부를 확인한다.
- CNG 개념과 최신 명령은
  [공식 문서](https://docs.expo.dev/workflow/continuous-native-generation/)
  를 따른다.

## 라우팅

- 모든 네비게이션은 Expo Router를 사용한다.
- 라우트와 기능 코드의 경계는 [아키텍처 규칙](architecture.md)을 따른다.
- `Link`, `router`, `useLocalSearchParams`는 `expo-router`에서 임포트한다.
- typed routes 오류를 `as` 캐스팅으로 우회하지 않는다.
- 라우트 추가·이동 뒤에는 개발 서버가 생성하는 타입을 갱신하고 타입
  검사를 실행한다.

## 스타일과 테마

NativeWind 도입이 목표지만 현재 의존성에는 포함되어 있지 않다.

### 도입 전

- `className`을 사용하지 않는다.
- 기존 테마 토큰과 `useTheme` 훅을 사용한다.
- 색상을 화면이나 컴포넌트에서 직접 하드코딩하지 않는다.
- `userInterfaceStyle: automatic`에 맞춰 라이트·다크 모드를 지원한다.

### 도입 후

- SDK 57과 React Native 0.86 호환 버전을 공식 문서로 확인하고 승인 후
  설치한다.
- 색상, 간격과 타이포그래피는 Tailwind 설정의 토큰을 사용한다.
- 다크 모드는 `dark:` 변형을 함께 정의한다.
- `StyleSheet`는 Reanimated 스타일처럼 NativeWind로 표현할 수 없는
  경우에만 사용한다.

## 상태와 데이터

- 컴포넌트 지역 상태로 해결할 수 있으면 `useState`를 사용한다.
- 여러 하위 컴포넌트가 공유하면 Context를 검토한다.
- 앱 전역의 복잡한 상태가 실제로 생긴 뒤 상태 라이브러리를 검토한다.
- 서버가 생기기 전에 API client나 repository 계층을 미리 만들지 않는다.
- 비동기 상태와 캐시 요구가 생기기 전에 데이터 패칭 라이브러리를
  도입하지 않는다.
- 파생 가능한 값은 별도 상태로 저장하지 않는다.

## 코드 품질

- 파일명은 kebab-case, 컴포넌트는 PascalCase를 사용한다.
- named export를 기본으로 한다. Expo Router 화면 연결은 default export를
  유지한다.
- 프로젝트 내부 임포트는 `@/` alias를 사용한다.
- `any`와 타입 캐스팅으로 타입 오류를 숨기지 않는다.
- 한 파일에 UI, 상태와 데이터 변환처럼 서로 다른 변경 이유를 섞지
  않는다.
- 대체된 코드, 템플릿 잔재와 사용하지 않는 파일을 남기지 않는다.
- 요청 범위 밖의 리팩터링을 함께 수행하지 않는다.

## 접근성과 모바일 성능

- 아이콘만 있는 버튼에는 접근성 레이블을 제공한다.
- 터치 영역, 글자 확대와 스크린 리더 순서를 확인한다.
- 긴 목록은 가상화된 리스트를 사용하고 렌더 함수와 props를 불필요하게
  재생성하지 않는다.
- 큰 이미지와 카메라 결과는 목적에 맞게 리사이즈하고 메모리 사용량을
  확인한다.
- JS thread를 오래 점유하는 동기 작업을 피한다.
- UI 변경은 iOS·Android와 라이트·다크 모드에서 확인한다.

## 보안과 개인정보

- `.env`, 토큰, 인증서, 비공개 API 키를 커밋하지 않는다.
- `EXPO_PUBLIC_*` 값은 앱 번들에서 공개된다는 전제로 사용한다.
- 비밀값과 개인정보를 로그에 출력하지 않는다.
- 촬영 이미지와 OCR 결과는 저장 기간, 접근 권한과 삭제 정책이 승인되기
  전까지 영구 보관하지 않는다.
- 외부 서비스로 데이터를 전송할 때 사용자 동의와 실패 처리 방식을
  함께 설계한다.

## 변경 유형별 검증

| 변경 유형 | 필수 검증 |
| --- | --- |
| TypeScript·React Native 코드 | `npx expo lint`, `npx tsc --noEmit`, 관련 테스트 |
| 의존성·Expo 설정 | 코드 검증과 `npx expo-doctor` |
| UI·라우팅 | 코드 검증과 iOS·Android 수동 확인 |
| 네이티브 모듈 | 코드 검증과 개발 빌드 필요 여부 확인 |
| 문서 전용 | `git diff --check`, 링크·경로·명령어 확인 |

- 코드 작업은 lint와 typecheck가 모두 통과해야 완료로 선언한다.
- 테스트 체계가 생기면 변경과 관련된 테스트도 완료 조건에 포함한다.
- 실행하지 않은 검증을 통과했다고 기록하지 않는다.
- 기존 오류가 있으면 요청 범위와의 관련성을 구분해 명령과 오류를
  보고한다.
- `expo-env.d.ts`와 `.expo/types`가 없는 새 clone에서는 개발 서버를 한
  번 실행한 뒤 생성된 타입을 기준으로 판단한다.
- 문서 전용 변경에 코드 검증을 자동 적용해 설정이나 의존성을 만들지
  않는다.
