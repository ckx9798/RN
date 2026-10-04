# 라벨 OCR 기반 식품 개인화 분석 MVP 구현

- 날짜: 2026-10-05
- PR 번호: #3
- PR 링크: https://github.com/ckx9798/RN/pull/3
- 상태: Ready for review (이 문서는 병합 전 작성, 최종 병합 상태는 PR 링크 기준)
- 관련 설계: [하이브리드 MVP 설계](../superpowers/specs/2026-09-30-hybrid-food-analysis-mvp-design.md)
- 관련 구현 계획: [하이브리드 MVP 계획](../superpowers/plans/2026-09-30-hybrid-food-analysis-mvp.md)

## 작업 배경

라벨 정보를 직접 확인하면서 등록 알레르기·질환 관련 주의 항목과 정보 부족을
구분하는 MVP가 필요했다. 네이티브 OCR, 웹 UI와 서버 트랙을 하나의 PR로 통합했다.

## 작업 목표

촬영·교정 → 브리지 → 개인화 분석 → 결과·이력 흐름의 코드 구현.
배포 완료나 실기기·실제 DB에서 전체 흐름이 확인됐다는 의미는 아니다.

## 작업 범위

- Expo iOS·Android 셸/FSD, 촬영·한국어 OCR·교정·임시 이미지 수명.
- 승인된 별도 Next.js 웹 앱의 OTP 인증, 건강 설정, 분석·후보·이력·탈퇴.
- Supabase 스키마·RLS·시드·RPC, 공공 API 어댑터와 인증된 Edge Functions.
- 세 트랙의 통합 리뷰, 회귀 테스트, SDK 57 패치 정렬.

## 주요 변경 사항

이미지를 업로드하지 않고 텍스트만 브리지로 전송한다. 웹은 인증과 개인화
설정·결과 표시를 담당한다. 서버는 사용자 인증/RLS, 요청 제한과 CORS를 적용하고
알레르기·질환 판정 및 제품 후보 조회를 수행한다. 불완전한 정보는 `no_flags`를
반환하지 않는다. 분석과 findings를 원자적으로 저장하며 당시 제품·프로필·OCR의
스냅샷으로 과거 이력을 보존한다.

최종 리뷰 Important 4건은 각각 회귀 테스트 실패를 확인한 뒤 수정했다.

- WebView 자동 외부 열기보다 엄격한 URL 정책을 먼저 적용.
- HTTP 48KiB와 후보 UUID 공간을 검사하고 크기 초과 시 재촬영 안내.
- 취소된 OCR의 늦은 이미지 생성 및 결과 갱신 차단, 작업별 파일 정리.
- 프로필/알레르기/질환 일부 조회 실패 시 편집 폼과 저장 차단.

## 핵심 기술 결정

- 설계의 평면 구조 대신 이후 승인된 규칙에 따라 네이티브 FSD 적용.
- 네이티브는 iOS·Android만, 웹 UI는 별도 `web/` 디렉터리.
- `originWhitelist`는 `['*']`로 모든 URL을 콜백에 전달하되 콜백이
  같은 origin만 허용하고 승인된 http(s) 외부 URL만 시스템 브라우저에 위임.
- `save_my_analysis`는 security invoker/RLS와 단일 트랜잭션 사용.
- 제품·OCR·프로필 스냅샷 등 저장 계약에 필요한 열과 findings 순서 추가.
- Deno 시드 일치 테스트가 SQL fixture를 읽으므로 `--allow-read` 사용.
- 기존 Expo 의존성만 SDK 57 권장 패치에 정렬. 새 라이브러리 추가 없음.
- OCR 경고를 제외 설정으로 숨기지 않고 미검증 사항과 사용자 예외 승인 기록.

## 사용자 영향

라벨 두 면 촬영과 필드 교정, 건강 설정, 주의/검토 필요/특이사항 없음 결과와
과거 이력을 제공하는 코드가 추가됐다. 결과는 의료 판단을 대체하지 않는다.
실제 제품 표시 재확인과 부족한 데이터 안내를 표시한다.

## 검증 결과

통합 worktree의 최종 코드에서 실행했다.

- `npx expo lint`: 통과.
- `npx tsc --noEmit`: 통과. 개발 서버를 실행해 라우트 타입 생성 후 종료.
- `npm test -- --runInBand`: 70개/11 suites 통과.
- `npx expo config --type prebuild`: 통과. `ios/`, `android/` 생성 없음.
- `web`: `npm run lint`, `npm run typecheck`, `npm test`: 73개/10 files 통과.
- `web`: 더미 공개 Supabase URL/키로 `npm run build` 통과.
- `supabase`: `~/.deno/bin/deno task test`: 396개 통과.
- `deno check` 두 함수 entrypoint, `deno lint functions/`: 통과.
- S4 로컬 직접 실행: 두 함수 OPTIONS 204, 미인증 POST 401 확인.
- `npx expo-doctor`: 20/21, ML Kit New Architecture 미검증 경고 1건.
  사용자가 경고 기록 후 병합을 승인했다. 호환성 통과로 표현하지 않는다.
- Docker DB reset/pgTAP/gateway: 사용자 명시 승인으로 생략, 미검증.
- `npm audit --omit=dev`: 높음 27/보통 11, 총 38건. 범위를 벗어나는
  자동 fix/다운그레이드는 미실행. 개발 툴 하위 의존성도 포함하므로 후속 분석 필요.
- 문서 `git diff --check`와 상대 링크·경로 확인.

## 제외 범위

배포, EAS Build/Submit/Update, 원격 DB 적용, 실제 공공 API·Supabase 운영 호출,
네이티브 개발 빌드와 실기기 UI/스크린샷 검증, 원격 브랜치 삭제.

## 후속 작업

- Docker 환경에서 마이그레이션·RLS·분석 저장/계정 RPC·pgTAP 실제 실행.
- iOS·Android 개발 빌드와 New Architecture 호환성 확인.
- 한국어 OCR, 출력 EXIF, 카메라 권한, 취소·뒤로가기, WebView 탐색 실기기 검증.
- 공공 API 실제 필드, 캐시 출처/신선도, 운영 인증/키/CORS 확인.
- 의존성 보안 권고의 실행 경로와 SDK 호환 수정안 분석.
