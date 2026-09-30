# 아키텍처 규칙

## 적용 상태

이 문서는 프로젝트가 적용한 구조의 기준이다. Expo 템플릿의 평면 구조에서
이 기준으로의 이동은 Task N1(FSD 구조 이동·템플릿 정리)에서 완료했다.

`src/app`, `src/shared`, `src/pages/web-shell`가 이 구조를 따른다.
`src/widgets`, `src/features`는 각 레이어의 첫 슬라이스가 생길 때
디렉터리를 만든다.

Task N1은 하이브리드 식품 분석 MVP 설계(4.3)가 가정한 평면 구조 대신
FSD를 적용하면서, 웹 지원 제외 결정에 따라 템플릿의 홈·탐색 탭 화면
(`app-tabs`, `explore`, `hint-row`, `collapsible`, `external-link`,
`web-badge` 등)을 이동하지 않고 삭제했다. 이는
[FSD 폴더 구조 도입 설계](../superpowers/specs/2026-09-22-fsd-structure-design.md)의
파일 매핑(탭 화면을 `widgets/app-tabs`로 이동)과 다른 결정이며, 앱이
탭 네비게이션 없는 단일 웹 셸 화면(`pages/web-shell`)으로 시작하기
때문이다. 배경은 Task N1 커밋 이력을 참조한다.

구조 결정의 배경과 최초 파일별 이동 범위는
[FSD 폴더 구조 도입 설계](../superpowers/specs/2026-09-22-fsd-structure-design.md)를
참조한다.

## FSD 레이어

Feature-Sliced Design을 현재 프로젝트 규모에 맞게 축소 적용한다.

```text
src/app/       Expo Router 라우트와 앱 초기화
src/pages/     화면 단위 슬라이스
src/widgets/   여러 기능을 조합한 큰 화면 블록
src/features/  사용자 행동 단위 기능
src/shared/    도메인에 독립적인 UI, 유틸리티와 설정
assets/        이미지와 폰트
```

### `app`

- Expo Router가 인식하는 라우트 파일과 `_layout.tsx`만 둔다.
- 라우트 파일은 `pages` 화면의 default export를 연결하는 얇은
  진입점으로 유지한다.
- `_layout.tsx`는 네비게이터, 전역 프로바이더, 스플래시와 앱 초기화를
  조립한다.
- 재사용 컴포넌트, 비즈니스 로직, 훅과 일반 유틸리티를 두지 않는다.

### `pages`

- 하나의 라우트 화면을 구성하는 슬라이스를 둔다.
- 화면 전용 상태와 UI 조합을 소유한다.
- 다른 `pages` 슬라이스를 직접 임포트하지 않는다.

### `widgets`

- 여러 `features`와 `shared` 요소를 조합한 큰 화면 블록을 둔다.
- 한 화면에서만 쓰더라도 독립된 책임과 재사용 가능성이 있는 조합을
  대상으로 한다.
- 실제 위젯이 생길 때 디렉터리를 만든다.

### `features`

- 촬영, 검색, 저장처럼 사용자가 수행하는 행동 단위 기능을 둔다.
- 다른 `features` 슬라이스를 직접 임포트하지 않는다.
- 첫 기능이 생기기 전에는 빈 디렉터리를 만들지 않는다.

### `shared`

- 도메인에 독립적인 UI, 훅, 유틸리티와 설정을 둔다.
- `app`, `pages`, `widgets`, `features`를 임포트하지 않는다.
- 범용성을 예상해서 코드를 미리 올리지 않고 실제 공유되는 책임만
  배치한다.

## 의존 방향

허용되는 의존 방향은 다음과 같다.

```text
app → pages → widgets → features → shared
```

- 각 레이어는 오른쪽에 있는 하위 레이어만 임포트한다.
- 같은 레이어의 서로 다른 슬라이스끼리 직접 의존하지 않는다.
- 여러 슬라이스에서 필요한 코드는 책임에 맞는 하위 레이어로 내린다.
- `shared`는 다른 FSD 레이어에 의존하지 않는다.
- 순환 의존을 만들지 않는다.

`entities`는 도메인 모델과 서버 데이터가 생긴 뒤 별도 설계로 도입한다.
사용 중단된 `processes` 레이어는 사용하지 않는다.

## 슬라이스와 public API

- 슬라이스 외부에서는 슬라이스 루트의 `index.ts` public API만
  임포트한다.
- 다른 슬라이스가 구현 파일이나 내부 세그먼트 경로를 직접 임포트하지
  않는다.
- `shared`는 슬라이스가 아니라 `ui`, `lib`, `config` 세그먼트이므로
  `@/shared/ui/themed-text`처럼 책임 파일을 직접 임포트할 수 있다.
- `ui`, `model`, `api`, `lib` 세그먼트는 파일이 실제로 여러 개가 되어
  분리가 필요할 때 만든다.

예:

```ts
// 허용: pages/home의 public API
export { default } from '@/pages/home';

// 허용: shared 세그먼트의 책임 파일
import { ThemedText } from '@/shared/ui/themed-text';

// 금지: 다른 슬라이스 내부 구현 직접 접근
import { HomeScreen } from '@/pages/home/home-screen';
```

## Expo Router

- 모든 네비게이션은 Expo Router를 사용한다.
- `Link`, `router`, `useLocalSearchParams`는 `expo-router`에서 임포트한다.
- typed routes를 우회하기 위한 임의 문자열 캐스팅을 사용하지 않는다.
- 라우트 파일은 화면 구현을 포함하지 않고 `pages` public API를
  default export로 연결한다.
- 동적 라우트 파라미터는 라우트에서 읽어 화면이 요구하는 명시적
  입력으로 전달한다.

## 임포트와 이름

- 프로젝트 내부 임포트는 `@/` alias를 사용한다.
- `../../`처럼 상위 디렉터리로 올라가는 상대 경로를 사용하지 않는다.
- `@/*`는 `./src/*`, `@/assets/*`는 `./assets/*`를 가리킨다.
- 파일명은 kebab-case를 사용한다.
- React 컴포넌트 이름은 PascalCase를 사용한다.
- named export를 기본으로 하되 Expo Router 화면 연결에는 default
  export를 유지한다.

## 파일과 디렉터리 생성 기준

- 한 파일은 하나의 책임만 가진다.
- UI, 상태, 데이터 변환처럼 변경 이유가 달라지면 파일을 분리한다.
- 재사용 가능성을 추측해 빈 레이어나 세그먼트를 미리 만들지 않는다.
- 대체한 파일과 죽은 코드는 같은 작업에서 제거한다.
- `ios/`와 `android/`가 생성형 디렉터리라면 직접 구조를 추가하거나
  수정하지 않는다.

## 구조 변경 절차

1. 현재 레이어로 해결할 수 없는 이유를 설계에 기록한다.
2. 새 레이어나 공용 추상화가 필요한지 검토한다.
3. 파일 이동과 임포트 변경을 같은 PR에 포함한다.
4. 레이어 의존 규칙과 typed routes를 검증한다.
5. 관련 아키텍처 문서와 PR 이력을 갱신한다.
