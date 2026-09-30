# FSD 폴더 구조 도입 설계

작성일: 2026-09-22
상태: 승인됨

## 배경

Expo 템플릿에서 시작한 저장소로, 화면 2개와 템플릿 컴포넌트 9개가 `src/components`, `src/hooks`, `src/constants`에 평평하게 놓여 있다. 기능이 늘기 전에 구조를 고정해 두려 한다. 코드 규칙은 `AGENTS.md`가 담당하며, 이 문서는 그 구조 결정의 근거와 이행 범위를 남긴다.

## 목표

- 레이어 간 의존 방향을 한쪽으로 고정해, 시간이 지나도 임포트 그래프가 엉키지 않게 한다.
- 규칙을 문서가 아니라 린터가 강제하게 한다.
- 웹 대상 제외 결정에 따라 남아 있는 템플릿 잔재를 같은 작업에서 정리한다.

## 결정 사항

### 채택하는 레이어

Feature-Sliced Design을 축소 적용한다. 레이어는 위에서 아래로:

```
src/app/      Expo Router 라우트 + _layout (FSD app 레이어 역할)
src/pages/    화면 단위 슬라이스
src/widgets/  여러 기능을 조합한 큰 블록
src/features/ 사용자 행위 단위
src/shared/   ui / lib / config — 도메인 무관 재사용 코드
```

**`entities`는 채택하지 않는다.** 현재 도메인 모델과 백엔드가 없다. 도메인이 생기면 `shared`에서 승격시킨다.

**`processes`도 채택하지 않는다.** FSD에서도 사용 중단된 레이어다.

`src/features/`는 첫 기능이 생길 때 만든다. 빈 디렉터리를 미리 만들지 않는다.

### FSD `app` 레이어와 Expo Router의 충돌 해소

FSD의 `app`은 앱 초기화 레이어이고 Expo Router의 `src/app/`은 라우트 디렉터리다. 이름과 역할이 겹친다. 해소 방식:

- `src/app/`은 Expo Router 전용으로 둔다.
- 라우트 파일은 화면을 re-export 하는 껍데기로만 쓴다: `export { default } from '@/pages/home'`
- 실제 화면 구현은 `src/pages/<slice>/`에 둔다.
- `_layout.tsx`가 FSD `app` 레이어 역할(프로바이더 주입, 스플래시, 네비게이터 조립)을 맡는다.

Expo Router가 라우트를 인식하려면 default export가 유지되어야 하므로 re-export 형태를 지킨다.

### 임포트 규칙

1. 각 레이어는 자기보다 아래 레이어만 임포트한다.
2. 같은 레이어의 다른 슬라이스끼리는 임포트하지 않는다. 공통이 필요하면 아래 레이어로 내린다.
3. `shared`는 어떤 레이어도 임포트하지 않는다.
4. 슬라이스는 `index.ts` public API를 통해서만 외부에 노출한다. 슬라이스 내부 경로를 직접 임포트하지 않는다.

`shared`는 슬라이스 개념이 없고 세그먼트만 있으므로, `@/shared/ui/themed-text`처럼 직접 임포트한다.

### 슬라이스 내부 구조

슬라이스 루트에 배럴 `index.ts`를 두고, 구현 파일은 kebab-case로 같은 레벨에 둔다 (`pages/home/home-screen.tsx`). 세그먼트(`ui/`, `model/`, `api/`, `lib/`)는 파일이 여러 개로 늘 때 나눈다. 빈 `ui/` 폴더를 남기지 않기 위한 결정이다. 현재 규모에서 `pages/home/`은 `index.ts`와 `home-screen.tsx` 두 파일이면 충분하다.

### 규칙 강제 수단

`npx expo lint`로 ESLint를 초기화한 뒤(`eslint-config-expo` 기반 flat config), 새 의존성 없이 `no-restricted-imports` 오버라이드로 방향을 막는다.

| 대상 경로 | 금지 패턴 |
|---|---|
| `src/shared/**` | `@/pages/*`, `@/widgets/*`, `@/features/*` |
| `src/features/**` | `@/pages/*`, `@/widgets/*` |
| `src/widgets/**` | `@/pages/*` |
| 전역 | `@/pages/*/**`, `@/widgets/*/**`, `@/features/*/**` (배럴 우회 차단) |

`eslint-plugin-boundaries`가 표현력은 더 좋지만 의존성이 하나 늘어난다. 규칙이 복잡해지면 그때 전환한다.

## 파일 매핑

| 현재 | 이동 후 |
|---|---|
| `src/app/_layout.tsx` | 위치 유지, 임포트만 갱신 (`@/shared/ui/animated-icon`, `@/widgets/app-tabs`) |
| `src/app/index.tsx` | `src/pages/home/` (라우트는 re-export 껍데기) |
| `src/app/explore.tsx` | `src/pages/explore/` (라우트는 re-export 껍데기) |
| `src/components/app-tabs.tsx` | `src/widgets/app-tabs/` |
| `src/components/animated-icon.tsx` | `src/shared/ui/animated-icon/` |
| `src/components/themed-text.tsx` | `src/shared/ui/themed-text.tsx` |
| `src/components/themed-view.tsx` | `src/shared/ui/themed-view.tsx` |
| `src/components/ui/collapsible.tsx` | `src/shared/ui/collapsible.tsx` |
| `src/components/external-link.tsx` | `src/shared/ui/external-link.tsx` |
| `src/components/hint-row.tsx` | `src/shared/ui/hint-row.tsx` |
| `src/hooks/use-color-scheme.ts` | `src/shared/lib/use-color-scheme.ts` |
| `src/hooks/use-theme.ts` | `src/shared/lib/use-theme.ts` |
| `src/constants/theme.ts` | `src/shared/config/theme.ts` |

`AnimatedIcon`과 `AnimatedSplashOverlay`는 한 파일에 함께 둔다. `_layout.tsx`(app 레이어)가 `shared`를 임포트하는 것은 규칙 위반이 아니다.

`hint-row`는 현재 home 화면에서만 쓰이지만 범용 프레젠테이션 컴포넌트이므로 `shared/ui`에 둔다. 향후 home 전용 로직이 붙으면 `pages/home/ui/`로 내린다.

`components/ui/` 중첩 디렉터리는 없앤다.

## 함께 정리하는 웹 잔재

플랫폼 범위를 iOS + Android로 확정했으므로 같은 작업에서 제거한다.

- `src/components/animated-icon.web.tsx`
- `src/components/animated-icon.module.css`
- `src/components/app-tabs.web.tsx`
- `src/components/web-badge.tsx`
- `src/hooks/use-color-scheme.web.ts`
- `src/global.css` 및 `constants/theme.ts`의 해당 임포트
- `app.json`의 `expo.web` 블록
- `package.json`의 `web` 스크립트
- 화면 코드의 `Platform.OS === 'web'` 분기와 `Platform.select`의 `web` 항목

## 범위 밖

- `react-dom`, `react-native-web` 의존성 제거 — 별도 판단
- NativeWind 도입 — 별도 승인 후 진행
- 테스트 인프라 구축
- 상태 관리 라이브러리 도입

## 검증

테스트가 없으므로 다음으로 확인한다.

1. `npx expo lint` — 레이어 규칙 위반이 0건이고, 의도적으로 역방향 임포트를 넣었을 때 에러가 나는지도 확인한다.
2. `npx tsc --noEmit` — 통과.
3. `npx expo start` 1회 기동 — `expo-env.d.ts`와 `.expo/types` 생성 및 두 화면 렌더 확인.

## 리스크

- **라우트 인식**: 라우트 파일이 default export를 잃으면 Expo Router가 화면을 찾지 못한다. re-export 형태를 지킨다.
- **typedRoutes**: 경로 타입이 재생성되기 전까지 `tsc`가 일시적으로 틀릴 수 있다. 개발 서버를 한 번 띄운 뒤 판단한다.
- **ESLint 초기화**: `expo lint`가 생성하는 flat config 형식이 SDK 버전에 따라 다르다. 오버라이드를 쓰기 전에 생성된 파일 구조를 확인한다.

## 후속 작업

`AGENTS.md`의 "프로젝트 구조" 섹션을 이 구조로 교체한다. 기존 섹션에 있던 `features/` 도입 유예 규칙은 이 결정으로 대체된다.
