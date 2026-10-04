# 하이브리드 식품 개인화 분석 MVP 구현 계획

## 2026-10-05 통합 결과

- 구현 트랙 S1–S4, N1–N3, W1–W3를 통합 브랜치에 병합했다.
- 최종 통합 리뷰 Important 4건을 수정하고 회귀 테스트를 추가했다.
- Expo lint/tsc/Jest 70개, 웹 lint/typecheck/Vitest 73개/production build,
  Deno 396개/check/lint, `expo config --type prebuild`가 통과했다.
- Expo doctor는 20/21이다. ML Kit New Architecture 경고를 기록하고
  개발 빌드 검증을 후속 작업으로 남긴 채 병합하도록 사용자가 승인했다.
- Docker DB·pgTAP·gateway 검증은 사용자 승인으로 생략했다.
  실제 DB 실행과 실기기 OCR은 검증 완료를 뜻하지 않는다.
- 기존 트랙별 미체크 항목은 이전 작업자의 실행 기록이며, 최종 통합 결과와
  승인된 검증 예외는 이 절과 [PR #3 이력](../../history/2026-10-05-pr-3-hybrid-food-analysis-mvp.md)을 기준으로 한다.
- N2의 `originWhitelist={[origin]}` 계획은 설치된 WebView의 자동 외부 열기
  우회가 확인돼 `['*']` + 엄격한 `decideNavigation` 콜백으로 대체했다.
- N3 이미지 수명은 전체 목록 정리 대신 작업별 소유권·취소·완료 정리로
  보강했다. 취소 이후 생성된 파일도 지우고 이전 결과를 적용하지 않는다.
- HTTP 요청은 48KiB와 후보 선택 UUID 공간을 웹에서 검사한다.
  근거를 자르지 않고 초과 시 재촬영을 안내한다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 라벨 촬영(네이티브 OCR) → WebView 웹 앱 → Supabase Edge Function 분석 → 알레르기·질환 개인화 결과까지 동작하는 MVP 코드를 저장소에 구현한다.

**Architecture:** Expo 앱은 WebView 셸과 촬영·OCR만 맡고, `web/`의 Next.js 앱이 인증·설정·결과·이력을 맡는다. `supabase/`는 스키마·RLS·기준정보 시드와 Deno Edge Function(`analyze-food`, `food-data`)을 가진다. 세 하위 시스템은 이 문서의 "공유 계약"만으로 연결되며 서로의 코드를 임포트하지 않는다.

**Tech Stack:** Expo SDK 57 / RN 0.86 / Expo Router, react-native-webview, expo-camera, expo-image-manipulator, expo-file-system, expo-dev-client, ML Kit Text Recognition v2 래퍼, jest-expo · Next.js(App Router) + @supabase/ssr + vitest · Supabase(Postgres, RLS, pgTAP, Deno Edge Functions)

**Spec:** `docs/superpowers/specs/2026-09-30-hybrid-food-analysis-mvp-design.md`

## Global Constraints

- 규칙 우선순위: 사용자 요구 > `AGENTS.md` > `docs/rules/` > 설계·계획 > 기존 코드. 모든 작업자는 시작 전에 `AGENTS.md`와 `docs/rules/architecture.md`, `docs/rules/development.md`를 읽는다.
- **구조 결정(설계와 다름):** 설계 4.3은 평면 구조를 가정했지만 이후 승인된 `AGENTS.md`가 FSD(`app → pages → widgets → features → shared`)를 요구하므로 Expo 앱은 FSD로 구현한다. 이 차이는 PR 이력에 기록한다.
- Expo 루트: iOS·Android만. `.web.tsx` 금지, `className` 금지(NativeWind 미설치), 색상 하드코딩 금지(`src/shared/config/theme.ts` 토큰 + `useTheme` 사용), `@/` alias만, 파일명 kebab-case, named export(라우트만 default re-export), `ios/`·`android/` 생성·커밋 금지.
- Expo 의존성은 SDK 57 문서(`https://docs.expo.dev/versions/v57.0.0/`) 확인 후 `npx expo install`로만 추가. 사용자는 이 계획의 의존성 목록 설치를 승인했다. 목록 밖 의존성은 추가하지 않는다. NativeWind·상태관리·데이터 패칭 라이브러리 금지.
- 사용자 문구 금지어: `안심`, `안전`, `섭취 적합`. 부정문("안전을 보장하지 않습니다")에도 쓰지 않고 "주의 항목이 없다는 뜻은 아니에요" 같은 표현을 쓴다. 테스트로 강제한다.
- `특이사항 없음`(`no_flags`)은 데이터가 불완전하면 절대 반환하지 않는다. 결과 화면에는 항상 "현재 확인 가능한 정보에서 주의 항목을 찾지 못했어요. 실제 제품 표시를 다시 확인해 주세요." 취지 문구를 표시한다.
- 이미지·Base64·파일 URI·인증 토큰·API 키는 브리지 메시지, 네트워크 요청 본문, 로그 어디에도 넣지 않는다.
- 로그에는 이메일·질환·알레르기·OCR 원문을 남기지 않는다.
- 비밀값을 저장소에 커밋하지 않는다. `.env.example`만 커밋한다. `EXPO_PUBLIC_`에는 웹 앱 URL만 둔다.
- 커밋 제목: `<type>(<scope>): <한글 명사형 제목>` 50자 이내, 본문에 이유·사용자 영향·검증 결과, 72자 줄바꿈, 끝에 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. 한 커밋 한 목적.
- 실행하지 않은 검증을 통과했다고 쓰지 않는다. Docker가 없는 환경이면 `supabase start`/`test db`는 "미실행"으로 보고한다.
- Deno는 `~/.deno/bin/deno`에 설치되어 있다(PATH에 없을 수 있음).

---

## 실행 구성

작업은 세 트랙으로 나뉘며 트랙끼리는 독립적이다. 각 트랙은 통합 브랜치
`feat/hybrid-food-analysis-mvp`에서 갈라진 자체 worktree·브랜치에서 순서대로
진행한다.

| 트랙 | worktree | 브랜치 | 작업 |
| --- | --- | --- | --- |
| S 서버 | `.worktrees/server` | `feat/mvp-server` | S1 → S2 → S3 → S4 |
| W 웹 | `.worktrees/web` | `feat/mvp-web` | W1 → W2 → W3 |
| N 네이티브 | `.worktrees/native` | `feat/mvp-native` | N1 → N2 → N3 |

마지막으로 통합 브랜치에 세 트랙을 병합하고 Task F(전체 검증·이력·PR·병합)를 수행한다.

---

## 공유 계약 (세 트랙 공통, 문자 그대로 사용)

### C1. 브리지 메시지 (설계 6장)

```ts
export const BRIDGE_VERSION = 1;
export const MAX_BRIDGE_MESSAGE_BYTES = 64 * 1024; // 네이티브→웹 결과
export const MAX_BRIDGE_REQUEST_BYTES = 1024;      // 웹→네이티브 요청

export type ScanPayload = {
  productName: string | null;          // ≤ 200자
  manufacturer: string | null;         // ≤ 200자
  reportNumber: string | null;         // 숫자만, ≤ 20자
  ingredientsText: string;             // 1..8000자, 공백만이면 무효
  allergenStatement: string | null;    // ≤ 1000자
  crossContaminationStatement: string | null; // ≤ 1000자
  rawText: string;                     // ≤ 20000자
  userReviewed: true;
};

export type ScanRequestV1 = { version: 1; type: 'SCAN_REQUEST'; requestId: string };
export type ScanResultV1 = { version: 1; type: 'SCAN_RESULT'; requestId: string; payload: ScanPayload };
export type ScanCancelledV1 = { version: 1; type: 'SCAN_CANCELLED'; requestId: string };
export type ScanFailedV1 = {
  version: 1; type: 'SCAN_FAILED'; requestId: string;
  code: 'permission_denied' | 'ocr_failed' | 'invalid_image' | 'unknown';
};
export type WebToNativeMessage = ScanRequestV1;
export type NativeToWebMessage = ScanResultV1 | ScanCancelledV1 | ScanFailedV1;
```

- `requestId`: `/^[A-Za-z0-9-]{8,64}$/`.
- 금지 내용 검사 `containsForbiddenContent(value: string): boolean` — 다음 중 하나라도 있으면 true:
  `/data:[a-z]+\/[a-z0-9.+-]+;base64,/i`, `/\b(file|content|ph|assets-library):\/\//i`,
  공백 없이 이어진 `[A-Za-z0-9+/=]` 연속 500자 이상, `/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./`(JWT).
- 거부 대상: JSON 파싱 실패, 크기 초과, `version !== 1`, 알 수 없는 `type`, 추가 키, 타입·길이 위반, 금지 내용, 중복 `requestId`, (웹) 대기 중인 요청과 다른 `requestId`.
- 전달 방식: 웹→네이티브 `window.ReactNativeWebView.postMessage(JSON.string)`. 네이티브→웹 `webView.injectJavaScript("window.dispatchEvent(new MessageEvent('message',{data:" + JSON.stringify(JSON.stringify(msg)) + "}));true;")`. 웹은 `window`의 `message` 이벤트에서 `event.data`가 문자열일 때만 처리한다.
- 네이티브는 WebView `onMessage`의 `event.nativeEvent.url` origin이 허용 origin과 같을 때만 처리한다.

### C2. analyze-food / food-data HTTP 계약

`POST {SUPABASE_URL}/functions/v1/analyze-food`, `Authorization: Bearer <사용자 access token>`, 본문 ≤ 48KB.

```ts
export type AnalyzeFoodRequest = {
  scan: ScanPayload;
  selectedProductId?: string | null; // public_food_products.id(uuid). 후보 선택 후 재요청 시
};

export type ProductCandidate = {
  id: string; reportNumber: string | null; name: string;
  manufacturer: string | null; score: number; // 0..1, 정렬용
};

export type Nutrients = Partial<Record<NutrientKey, { value: number; unit: 'kcal' | 'g' | 'mg' }>>;
export type NutrientKey =
  | 'energy' | 'carbohydrate' | 'sugars' | 'protein' | 'fat' | 'saturated_fat'
  | 'cholesterol' | 'sodium' | 'potassium' | 'phosphorus' | 'calcium';

export type ProductMatch = {
  id: string; reportNumber: string | null; name: string; manufacturer: string | null;
  foodType: string | null; servingSize: string | null; nutrients: Nutrients | null;
  ingredientsText: string | null; sourceUpdatedAt: string | null; fetchedAt: string;
  matchType: 'report_number' | 'name_manufacturer' | 'user_selected';
};

export type DataQuality = {
  ocrReviewed: boolean;
  productMatch: 'matched' | 'ambiguous' | 'not_found' | 'unavailable';
  nutritionAvailable: boolean;
  apiStatus: 'ok' | 'cache' | 'error';
  conflicts: string[];   // 사람이 읽을 충돌 설명
  missing: string[];     // 부족한 데이터 설명
  sourceDate: string | null;
};

export type Finding = {
  category: 'allergen' | 'cross_contamination' | 'disease_nutrition' | 'data_quality';
  severity: 'caution' | 'needs_review' | 'info';
  standardId: string | null; title: string; description: string;
  matchedText: string | null;
  source: 'label' | 'mfds_api' | 'user_profile' | 'rule';
  evidenceUrl: string | null;
};

export type AnalysisResult = {
  status: 'caution' | 'needs_review' | 'no_flags';
  product: ProductMatch | null; findings: Finding[]; dataQuality: DataQuality;
  analyzedAt: string; ruleSetVersion: string;
};

export type AnalyzeFoodResponse = {
  analysisId: string;
  result: AnalysisResult;
  candidates: ProductCandidate[]; // 비어 있지 않으면 웹이 후보 선택 화면을 띄운다
};

export type ApiError = { error: { code: 'unauthorized' | 'invalid_request' | 'payload_too_large' | 'rate_limited' | 'internal'; message: string } };
```

HTTP 상태: 200 성공, 400 invalid_request, 401 unauthorized, 413 payload_too_large, 429 rate_limited, 500 internal. CORS: `OPTIONS` 허용, `Access-Control-Allow-Origin`은 env `ALLOWED_WEB_ORIGINS`(쉼표 구분) 중 일치하는 값.

`POST /functions/v1/food-data` 본문 `{ query: string (2..100자), manufacturer?: string | null }` → `{ candidates: ProductCandidate[] }` (최대 10개). 후보 선택 화면의 수동 검색용.

### C3. DB 식별자

- 알레르기 ID `FOOD-001`..`FOOD-019`, 질환 ID `DIS-001`..`DIS-028` (설계 9.1, 9.2 표 그대로).
- `disease_standards.analysis_support`: `'exclusive'`(DIS-001), `'nutrition_candidate'`(관련 영양정보 후보, UI "분석 지원"), `'limited'`(제한적, UI "일부 지원"), `'unsupported'`(자동 판정 안 함, UI "정보 저장만"), `'memo_only'`(DIS-028, UI "정보 저장만").
- `disease_standards.related_nutrients text[]`(설계 데이터 모델에 추가하는 열 — 11.2 매핑 저장용):
  DIS-002, 011, 012, 013, 014, 027 → `{sodium}`; DIS-003, 026 → `{carbohydrate,sugars}`; DIS-004 → `{saturated_fat,cholesterol}`; DIS-016 → `{sodium,protein,potassium,phosphorus}`; DIS-010 → `{calcium}`; 나머지 `{}`.
- 규칙 세트 버전 상수 `RULE_SET_VERSION = '2026-09-30.1'`.

---

## Track S — Supabase 서버 (worktree `.worktrees/server`)

### Task S1: Supabase 프로젝트·스키마·RLS·기준정보 시드

**Files:**
- Create: `supabase/config.toml` (`npx supabase init`로 생성 후 편집), `supabase/templates/magic-link.html`, `supabase/templates/confirmation.html`
- Create: `supabase/migrations/20260930000100_core_schema.sql`, `20260930000200_rls.sql`, `20260930000300_reference_seed.sql`, `20260930000400_account_rpc.sql`
- Create: `supabase/tests/00_schema.test.sql`, `01_rls_isolation.test.sql`, `02_account_delete.test.sql`, `03_reference_data.test.sql`
- Create: `supabase/.env.example`
- Modify: `.gitignore` (`supabase/.branches`, `supabase/.temp`, `supabase/functions/.env`)

**Interfaces:** Produces C3 테이블·RPC. `save_my_profile(p_consent_version text, p_has_no_known_disease boolean, p_allergen_ids text[], p_diseases jsonb)` — `p_diseases`는 `[{ "diseaseId": "DIS-002", "note": null }]`. `delete_my_account()`. 분석 저장은 S4의 `save_my_analysis(p_record jsonb) returns uuid`가 담당한다(2026-10-05 리뷰에서 별도 insert 두 번의 부분 저장 문제를 확인해 단일 트랜잭션으로 변경).

- [ ] **Step 1: 초기화.** 저장소 루트에서 `npx supabase init --yes`(또는 대화형이면 `--with-vscode-settings=false` 등 필요한 플래그 확인 `npx supabase init --help`). `config.toml`에서:
  - `[auth] site_url = "http://localhost:3000"`, `additional_redirect_urls = []`
  - `[auth.email] enable_signup = true`, `otp_length = 6`, `otp_expiry = 600`, `enable_confirmations = false`
  - `[auth.email.template.magic_link] subject = "로그인 인증 코드"`, `content_path = "./supabase/templates/magic-link.html"` (그리고 confirmation 템플릿 동일 방식). 템플릿 본문은 `{{ .Token }}` 6자리 코드만 안내하고 링크(`{{ .ConfirmationURL }}`)를 넣지 않는다.
  - `[functions.analyze-food] verify_jwt = true`, `[functions.food-data] verify_jwt = true`
  - `[auth.external.*]` 비활성 유지. SMTP는 주석으로 `[auth.email.smtp]` 예시만 두고 값은 env 참조(`env(SMTP_PASS)`).

- [ ] **Step 2: 실패하는 pgTAP 테스트 작성.** `supabase/tests/00_schema.test.sql`:

```sql
begin;
select plan(12);
select has_table('public', t, t || ' exists') from unnest(array[
  'profiles','allergen_standards','allergen_match_terms','disease_standards','disease_rules',
  'user_allergens','user_diseases','public_food_products','public_api_snapshots',
  'analyses','analysis_findings']) as t;
select has_function('public', 'delete_my_account', 'delete_my_account exists');
select * from finish();
rollback;
```

`01_rls_isolation.test.sql`: 두 사용자(`auth.users`에 id·email 직접 insert)를 만들고, 사용자 A 컨텍스트(`set local role authenticated; select set_config('request.jwt.claims', json_build_object('sub', A, 'role','authenticated')::text, true);`)에서 A 소유 profiles/user_allergens/user_diseases/analyses/analysis_findings 행을 insert → 성공, B 컨텍스트로 전환 후 `select count(*)`가 0, B가 A 행 update/delete 시 영향 0행, B가 `user_id = A`로 insert 시 `throws_ok`. `anon` 역할은 사용자 테이블 select 0행, `public_food_products`·`public_api_snapshots` insert는 authenticated에서 `throws_ok`(쓰기는 service_role만). 기준정보 테이블은 authenticated select 가능(행 수 > 0).
`02_account_delete.test.sql`: A로 데이터 생성 후 A 컨텍스트에서 `select delete_my_account()` → `auth.users`, profiles, user_allergens, user_diseases, analyses, analysis_findings에 A 행 0, B 행과 기준정보·`public_food_products`는 유지.
`03_reference_data.test.sql`: `allergen_standards` 19행·ID 연속, 각 기준에 `term = name`인 match term 존재, `disease_standards` 28행, `disease_rules`의 `active` 행은 `evidence_url`·`reviewed_at`·`threshold`가 모두 not null(체크 제약 확인용으로 위반 insert가 `throws_ok`), DIS-001 `analysis_support = 'exclusive'`.

- [ ] **Step 3: 테스트 실행 시도.** `docker info`가 실패하면 `npx supabase start`/`npx supabase test db --local`은 실행하지 않고 "Docker 없음 — 미실행"으로 보고한다. Docker가 있으면 `npx supabase start && npx supabase db reset --local && npx supabase test db --local`로 FAIL을 확인한다.

- [ ] **Step 4: 스키마 마이그레이션.** `20260930000100_core_schema.sql`:

```sql
create extension if not exists pg_trgm with schema extensions;

create table public.allergen_standards (
  id text primary key check (id ~ '^FOOD-\d{3}$'),
  name text not null unique,
  source_url text not null,
  source_version text not null,
  active boolean not null default true
);

create table public.allergen_match_terms (
  id bigint generated always as identity primary key,
  allergen_id text not null references public.allergen_standards(id),
  term text not null,
  match_type text not null check (match_type in ('exact_token','phrase','label_context')),
  confidence text not null check (confidence in ('confirmed','possible')),
  priority smallint not null default 100,
  active boolean not null default true,
  unique (allergen_id, term)
);

create table public.disease_standards (
  id text primary key check (id ~ '^DIS-\d{3}$'),
  category text not null,
  name text not null unique,
  source_codes text,
  classification_version text not null,
  analysis_support text not null check (analysis_support in ('exclusive','nutrition_candidate','limited','unsupported','memo_only')),
  related_nutrients text[] not null default '{}',
  active boolean not null default true
);

create table public.disease_rules (
  id bigint generated always as identity primary key,
  disease_id text not null references public.disease_standards(id),
  target_type text not null check (target_type in ('nutrient')),
  target_key text not null,
  operator text not null check (operator in ('gt','gte','lt','lte')),
  threshold numeric,
  unit text not null check (unit in ('kcal','g','mg')),
  severity text not null check (severity in ('caution','needs_review')),
  message text not null,
  evidence_url text,
  rule_version text not null,
  reviewed_at timestamptz,
  active boolean not null default false,
  constraint active_rule_requires_evidence check (
    not active or (evidence_url is not null and reviewed_at is not null and threshold is not null))
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consent_version text not null,
  has_no_known_disease boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_allergens (
  user_id uuid not null references auth.users(id) on delete cascade,
  allergen_id text not null references public.allergen_standards(id),
  created_at timestamptz not null default now(),
  primary key (user_id, allergen_id)
);

create table public.user_diseases (
  user_id uuid not null references auth.users(id) on delete cascade,
  disease_id text not null references public.disease_standards(id),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  primary key (user_id, disease_id)
);

create table public.public_food_products (
  id uuid primary key default gen_random_uuid(),
  report_number text unique,
  normalized_name text not null,
  display_name text not null,
  manufacturer text,
  normalized_manufacturer text,
  normalized_payload jsonb not null,
  source_updated_at timestamptz,
  fetched_at timestamptz not null default now()
);
create index public_food_products_name_trgm on public.public_food_products using gin (normalized_name extensions.gin_trgm_ops);

create table public.public_api_snapshots (
  id bigint generated always as identity primary key,
  product_id uuid references public.public_food_products(id) on delete set null,
  service_id text not null check (service_id in ('mfds_nutrition','foodsafety_c002')),
  request_fingerprint text not null,
  raw_payload jsonb not null,
  source_updated_at timestamptz,
  fetched_at timestamptz not null default now()
);
create index public_api_snapshots_fingerprint on public.public_api_snapshots (service_id, request_fingerprint, fetched_at desc);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null check (status in ('caution','needs_review','no_flags')),
  product_id uuid references public.public_food_products(id) on delete set null,
  product_snapshot jsonb,
  corrected_ocr_payload jsonb not null,
  profile_snapshot jsonb not null,
  rule_set_version text not null,
  data_quality jsonb not null,
  created_at timestamptz not null default now()
);
create index analyses_user_created on public.analyses (user_id, created_at desc);

create table public.analysis_findings (
  id bigint generated always as identity primary key,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null check (category in ('allergen','cross_contamination','disease_nutrition','data_quality')),
  severity text not null check (severity in ('caution','needs_review','info')),
  standard_id text,
  title text not null,
  description text not null,
  matched_text text,
  source text not null check (source in ('label','mfds_api','user_profile','rule')),
  evidence_url text,
  sort_order smallint not null default 0
);
create index analysis_findings_analysis on public.analysis_findings (analysis_id);
```

(`product_snapshot`, `display_name`, `normalized_manufacturer`, `analysis_findings.user_id`, `sort_order`는 설계 데이터 모델에 추가한 열이다 — 스냅샷 보존과 RLS 단순화를 위해 필요. 주석으로 이유를 남긴다.)

- [ ] **Step 5: RLS 마이그레이션.** `20260930000200_rls.sql`: 모든 public 테이블 `enable row level security`. 사용자 소유 5개 테이블(profiles, user_allergens, user_diseases, analyses, analysis_findings)에 `to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)`의 select/insert/update/delete 정책. `analyses`·`analysis_findings`는 update 정책 없음(과거 결과 불변). `analysis_findings` insert는 추가로 `exists (select 1 from analyses a where a.id = analysis_id and a.user_id = (select auth.uid()))`. 기준정보 4개 테이블은 `to authenticated using (true)` select만. `public_food_products`, `public_api_snapshots`는 authenticated select만(쓰기 정책 없음 → service_role만 쓰기). `revoke all on ... from anon` for 사용자 테이블. `updated_at` 트리거(profiles).

- [ ] **Step 6: 기준정보 시드.** `20260930000300_reference_seed.sql`에 설계 9.1 표의 19종과 9.2 표의 28종을 그대로 insert. `source_url`은 설계 20장의 식약처 안내 URL, `source_version = '식품등의 표시기준 2026'`; 질환 `classification_version = 'KCD-9 (2026 시행, 원문 대조 필요)'`, `source_codes`는 표 값(해당 없음은 null). 알레르기 match term 규칙:
  - 모든 기준 물질명 자체를 term으로 넣는다. `알류`, `조개류`, `아황산류`는 `label_context/confirmed`, 그 외 기준명은 `exact_token/confirmed`.
  - 한 글자 또는 의미가 넓은 용어는 `exact_token`: `게`, `밀`, `콩`, `잣`, `굴`, `소맥`, `우육`, `돈육`, `닭육`, `전란`, `난분`, `유당`, `버터`, `치즈`, `두부`, `된장`, `간장`, `두유`, `호두`, `땅콩`, `메밀`, `대두`, `우유`, `새우`, `오징어`, `고등어`, `복숭아`, `토마토`, `닭고기`, `돼지고기`, `쇠고기`, `소고기`, `전복`, `홍합`, `바지락`, `가리비`, `꽃게`, `대게`, `계란`, `달걀`, `난백`, `난황`, `메추리알`, `카제인`, `유청`, `글루텐`, `낙화생`.
  - 나머지 합성어(예: `밀가루`, `탈지분유`, `대두레시틴`, `토마토페이스트`, `메타중아황산나트륨`)는 `phrase/confirmed`.
  - `possible`: `크림`(`exact_token`, 식물성 크림 가능성), `유당`, `간장`, `된장`(대두 외 원료 가능성) — 이 네 개만 possible, 나머지 confirmed.
  - 영문 용어(`crab`, `shrimp`, `prawn`, `squid`, `mackerel`, `oyster`, `abalone`, `mussel`, `clam`, `scallop`, `peach`, `tomato`, `chicken`, `pork`, `beef`, `sulfite`)는 `exact_token/confirmed`, `sulfur dioxide`는 `phrase/confirmed`. 모두 소문자.
  - 표에 없는 용어는 추가하지 않는다.

- [ ] **Step 7: 계정 RPC.** `20260930000400_account_rpc.sql`:

```sql
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  delete from auth.users where id = uid; -- 사용자 테이블은 on delete cascade
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

create or replace function public.save_my_profile(
  p_consent_version text, p_has_no_known_disease boolean,
  p_allergen_ids text[], p_diseases jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_has_no_known_disease and jsonb_array_length(coalesce(p_diseases,'[]'::jsonb)) > 0 then
    raise exception 'DIS-001 is exclusive' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_diseases,'[]')) d where d->>'diseaseId' = 'DIS-001') then
    raise exception 'use p_has_no_known_disease for DIS-001' using errcode = '22023';
  end if;
  insert into public.profiles (user_id, consent_version, has_no_known_disease)
  values (uid, p_consent_version, p_has_no_known_disease)
  on conflict (user_id) do update set consent_version = excluded.consent_version,
    has_no_known_disease = excluded.has_no_known_disease, updated_at = now();
  delete from public.user_allergens where user_id = uid;
  insert into public.user_allergens (user_id, allergen_id) select uid, unnest(coalesce(p_allergen_ids,'{}'));
  delete from public.user_diseases where user_id = uid;
  insert into public.user_diseases (user_id, disease_id, note)
  select uid, d->>'diseaseId', case when d->>'diseaseId' = 'DIS-028' then nullif(d->>'note','') else null end
  from jsonb_array_elements(coalesce(p_diseases,'[]')) d;
end $$;
revoke all on function public.save_my_profile(text, boolean, text[], jsonb) from public, anon;
grant execute on function public.save_my_profile(text, boolean, text[], jsonb) to authenticated;
```

pgTAP에 `save_my_profile` 배타 규칙 테스트(DIS-001 + 다른 질환 → throws)도 `00_schema` 또는 새 `04_save_profile.test.sql`에 추가한다.

- [ ] **Step 8: 검증.** Docker 있으면 Step 3 명령으로 PASS 확인. 없으면 최소한 `npx supabase --version`과 SQL 문법 자체 점검(`grep -n` 로 표 19/28행 수 확인: `grep -c "'FOOD-" ...`)을 수행하고 결과를 보고한다. `supabase/.env.example`에 `MFDS_DATA_GO_KR_SERVICE_KEY=`, `FOODSAFETY_KOREA_API_KEY=`, `ALLOWED_WEB_ORIGINS=http://localhost:3000` 을 적는다.

- [ ] **Step 9: 커밋.** `feat(db): 식품 분석 스키마와 RLS 추가` (본문: 테이블·RLS·시드·탈퇴 RPC 이유, 설계 대비 추가 열, 검증 결과·미실행 항목).

### Task S2: 분석 도메인 로직 (정규화·알레르기 매칭·질환 규칙·판정)

**Files:**
- Create: `supabase/deno.json`
- Create: `supabase/functions/_shared/domain/types.ts` (C2 타입 전부 + `ScanPayload` + 아래 내부 타입)
- Create: `supabase/functions/_shared/domain/normalize.ts`
- Create: `supabase/functions/_shared/domain/ingredient-parser.ts`
- Create: `supabase/functions/_shared/domain/label-statements.ts`
- Create: `supabase/functions/_shared/domain/allergen-matcher.ts`
- Create: `supabase/functions/_shared/domain/disease-evaluator.ts`
- Create: `supabase/functions/_shared/domain/decide-status.ts`
- Create: `supabase/functions/_shared/domain/copy.ts` (사용자 문구 상수)
- Test: `supabase/functions/tests/normalize.test.ts`, `ingredient-parser.test.ts`, `label-statements.test.ts`, `allergen-matcher.test.ts`, `allergen-regression.test.ts`, `seed-consistency.test.ts`, `disease-evaluator.test.ts`, `decide-status.test.ts`, `copy.test.ts`
- Test fixtures: `supabase/functions/tests/fixtures/reference-data.ts`, `supabase/functions/tests/fixtures/allergen-regression.ts`

**Interfaces:**
```ts
// types.ts (내부)
export type AllergenTerm = { allergenId: string; term: string; matchType: 'exact_token' | 'phrase' | 'label_context'; confidence: 'confirmed' | 'possible'; priority: number };
export type AllergenStandard = { id: string; name: string; sourceUrl: string };
export type DiseaseStandard = { id: string; name: string; analysisSupport: 'exclusive' | 'nutrition_candidate' | 'limited' | 'unsupported' | 'memo_only'; relatedNutrients: NutrientKey[] };
export type DiseaseRule = { id: number; diseaseId: string; targetKey: NutrientKey; operator: 'gt' | 'gte' | 'lt' | 'lte'; threshold: number | null; unit: 'kcal' | 'g' | 'mg'; severity: 'caution' | 'needs_review'; message: string; evidenceUrl: string | null; ruleVersion: string; reviewedAt: string | null; active: boolean };
export type UserProfileSnapshot = { allergenIds: string[]; diseaseIds: string[]; hasNoKnownDisease: boolean; consentVersion: string };
export type IngredientNode = { raw: string; normalized: string; children: IngredientNode[] };
export type AllergenMatch = { allergenId: string; term: string; matchedText: string; kind: 'direct' | 'cross_contamination'; source: 'label' | 'mfds_api'; matchType: AllergenTerm['matchType'] | 'statement'; confidence: 'confirmed' | 'possible' };

// normalize.ts
export function normalizeText(input: string): string; // NFKC, 소문자, 연속 공백 1칸, trim
export function normalizeName(input: string): string;  // normalizeText 후 공백·괄호·특수문자 제거(한글·영숫자만)

// ingredient-parser.ts
export function parseIngredients(text: string): IngredientNode[];
export function flattenAtoms(nodes: IngredientNode[]): string[]; // 모든 깊이 노드를 ':'·공백·'%' 수치 기준으로 쪼갠 원자 토큰(정규화)

// label-statements.ts
export function extractStatements(scan: Pick<ScanPayload,'ingredientsText'|'allergenStatement'|'crossContaminationStatement'|'rawText'>): { allergen: string | null; crossContamination: string | null; ingredientsBody: string };

// allergen-matcher.ts
export function matchAllergens(input: { ingredientsText: string | null; allergenStatement: string | null; crossContaminationStatement: string | null; source: 'label' | 'mfds_api' }, terms: AllergenTerm[]): AllergenMatch[];

// disease-evaluator.ts
export function evaluateDiseases(input: { profile: UserProfileSnapshot; diseases: DiseaseStandard[]; rules: DiseaseRule[]; nutrients: Nutrients | null }): Finding[];

// decide-status.ts
export function buildAllergenFindings(matches: AllergenMatch[], profile: UserProfileSnapshot, standards: AllergenStandard[]): Finding[];
export function decideStatus(findings: Finding[], quality: DataQuality): AnalysisResult['status'];

// copy.ts
export const COPY: { noFlagsNotice: string; /* 모든 사용자 문구 */ };
export const FORBIDDEN_WORDS = ['안심', '안전', '섭취 적합'] as const;
export const RULE_SET_VERSION = '2026-09-30.1';
```

- [ ] **Step 1: deno.json.**

```json
{
  "tasks": { "test": "deno test supabase/functions/tests/ --allow-env --allow-read" },
  "imports": { "@std/assert": "jsr:@std/assert@1", "@supabase/supabase-js": "npm:@supabase/supabase-js@2" },
  "compilerOptions": { "strict": true }
}
```
(설계 17장은 `--allow-env`만 명시했지만 시드 일치 테스트가 마이그레이션 SQL을 읽으므로 `--allow-read`를 추가한다. `deno task test`는 저장소 루트에서 `--config supabase/deno.json`으로 또는 `cd supabase && deno task test`로 실행되도록 경로를 맞춘다 — 실제로 실행해 확인하고 README 수준 주석 없이 PR 이력에 명령을 기록한다. 권장: tasks 경로를 `deno test functions/tests/ ...`로 하고 `cd supabase && ~/.deno/bin/deno task test`로 실행.)

- [ ] **Step 2: fixtures.** `tests/fixtures/reference-data.ts`에 S1 시드와 동일한 `ALLERGEN_STANDARDS`, `ALLERGEN_TERMS`, `DISEASE_STANDARDS` 배열을 작성한다. `seed-consistency.test.ts`는 `supabase/migrations/20260930000300_reference_seed.sql`을 `Deno.readTextFile`로 읽어 정규식으로 `('FOOD-xxx', '<term>', '<match_type>', '<confidence>'` 튜플과 질환 행을 추출하고 fixture와 **집합이 완전히 같음**을 assert한다(시드 SQL의 VALUES 형식을 이 파서가 읽을 수 있도록 한 줄에 하나씩 작성).

- [ ] **Step 3: 정규화·파서 테스트 먼저.** 필수 케이스:
  - `normalizeText('  Ｃｒａｂ  추출물 ')` → `'crab 추출물'`
  - `parseIngredients('밀가루(밀:미국산), 혼합제제[설탕, 대두레시틴(대두)]·정제소금/난백분\n버터')` → 최상위 5개(`밀가루`, `혼합제제`, `정제소금`, `난백분`, `버터`), `혼합제제.children`에 `설탕`, `대두레시틴`(children `대두`).
  - 짝이 맞지 않는 괄호도 예외 없이 처리(`'밀가루(밀'` → 1개 노드, children `밀`).
  - `flattenAtoms`는 `'밀:미국산'`을 `밀`, `미국산`으로, `'정제수 12.5%'`를 `정제수`로 만든다.

- [ ] **Step 4: 문장 추출 테스트.** `extractStatements`: 필드가 주어지면 그대로 사용. 비어 있으면 `ingredientsText`·`rawText`에서 문장 분리(`.`, `\n`, `。`) 후 `/(같은|동일한)\s*(제조)?\s*시설|혼입\s*가능/` 문장 → crossContamination, `/알레르기|알러지|함유/` 문장(교차혼입 문장 제외) → allergen. `ingredientsBody`는 두 문장을 제거한 원재료 본문.

- [ ] **Step 5: 알레르기 매처 테스트.** `allergen-matcher.test.ts` 필수 케이스(모두 fixture terms 사용):
  1. `'밀가루, 설탕'` → FOOD-006 direct confirmed(`phrase` 밀가루).
  2. `'메밀가루, 정제소금'` → FOOD-003만, FOOD-006 **없음**(부정 합성어).
  3. `'땅콩버터'` → FOOD-004, FOOD-002 없음(`버터`는 exact_token).
  4. `'게맛살향'`에서 FOOD-009(게) 없음, `'게, 새우'` → FOOD-009·FOOD-010.
  5. `'강낭콩, 완두'` → FOOD-005 없음. `'콩(국산)'` → FOOD-005.
  6. `'혼합제제[대두레시틴(대두)]'` → FOOD-005(복합원재료 내부).
  7. 영문 대소문자 `'Shrimp Extract'` → FOOD-010.
  8. `'식물성크림'` → 크림은 exact_token이라 불일치, `'크림'` → FOOD-002 possible.
  9. allergenStatement `'알류, 우유, 조개류(굴) 함유'` → FOOD-001, FOOD-002, FOOD-013 direct `matchType:'statement'` confirmed(label_context 용어는 문장에서만 매칭). `'우유를'`처럼 조사(`을 를 이 가 와 과 및 등 은 는 으로 로`)가 붙어도 매칭.
  10. crossContaminationStatement `'이 제품은 땅콩, 게를 사용한 제품과 같은 제조시설에서 제조'` → FOOD-004·FOOD-009 `kind:'cross_contamination'`.
  11. 원재료 본문에 `'알류'`만 있으면(label_context) 매칭하지 않는다.
  12. `'이산화황'`, `'메타중아황산칼륨'`, `'Sulfur Dioxide'` → FOOD-019.
  13. 모든 fixture term 각각에 대해: term을 단독 원재료로 넣었을 때(label_context는 allergenStatement에 `<term> 함유`로 넣었을 때) 해당 allergenId가 매칭된다 — 반복문 테스트(설계 16장 "19종 및 모든 시드 별칭").
  14. source 값이 입력 `source`로 전달된다.

  구현 규칙: 원재료 원자 토큰에 대해 `exact_token`은 토큰 === term, `phrase`는 토큰.includes(term) 이고 `NEGATIVE_COMPOUNDS[term]`의 어떤 단어도 토큰에 포함되지 않을 때. `NEGATIVE_COMPOUNDS = { '밀가루': ['메밀가루'], '밀분': ['메밀분'], '밀전분': ['메밀전분'] }`를 코드 상수로 둔다. `phrase`로 매칭된 토큰이 다른 기준의 더 긴 phrase에 포함되면(예: `메밀가루`) 긴 쪽만 남긴다. 문장(statement)은 구분자·공백·조사로 토큰화한 뒤 모든 match_type을 exact 비교(phrase는 includes)한다. 같은 allergenId·kind·source 조합은 confirmed 우선으로 1건으로 합치되 `matchedText`는 처음 일치 원문을 쓴다.

- [ ] **Step 6: 회귀 데이터셋.** `fixtures/allergen-regression.ts`에 최소 25개 실제 라벨형 사례(과자, 라면, 음료, 소스, 빵, 통조림, 햄 등; 복합원재료·교차혼입·영문 포함)를 `{ name, ingredientsText, allergenStatement, crossContaminationStatement, expectDirect: string[], expectCross: string[], expectAbsent: string[] }`로 작성. `allergen-regression.test.ts`는 모든 `expectDirect`/`expectCross`가 매칭(미탐 0건)이고 `expectAbsent`는 없음을 assert. 19종 각각이 최소 1개 사례의 `expectDirect`에 등장해야 한다(테스트로 검증).

- [ ] **Step 7: 질환 평가 테스트.** `disease-evaluator.test.ts`:
  - `hasNoKnownDisease` → 빈 배열.
  - `unsupported`/`memo_only` 질환 → `needs_review`, category `disease_nutrition`, source `user_profile`, title에 질환명, description "자동 분석 대상이 아니에요" 취지.
  - `nutrition_candidate` + nutrients null → `needs_review`("영양정보가 없어 판단할 수 없어요").
  - 관련 영양값 존재 + 활성 규칙 없음 → `info` finding(값·단위 표시, source `mfds_api`).
  - 규칙 `active:false` 또는 `reviewedAt:null` 또는 `evidenceUrl:null` 또는 `threshold:null`이면 조건을 만족해도 실행하지 않음(설계 16장 "비활성·미검수 규칙 실행 차단").
  - 활성·검수 규칙(`sodium gt 600 mg`, nutrients sodium 800) → `caution`, source `rule`, evidenceUrl 전달. 단위 불일치면 실행하지 않고 `needs_review`.
  - `limited` 질환은 relatedNutrients가 비어 있으면 `needs_review`(일부 지원 안내), 있으면 candidate와 동일 처리.

- [ ] **Step 8: 판정·문구 테스트.** `decide-status.test.ts`:
  - caution 1건 + needs_review 1건 → `caution`.
  - needs_review만 → `needs_review`.
  - info만 + quality 완전(`ocrReviewed`, `productMatch:'matched'`, `conflicts:[]`, `missing:[]`) → `no_flags`.
  - findings 비었지만 `ocrReviewed:false` / `productMatch` ∈ {ambiguous, not_found, unavailable} / conflicts 비어있지 않음 / missing 비어있지 않음 → 각각 `needs_review`(no_flags 금지).
  - `buildAllergenFindings`: 등록하지 않은 알레르기 매칭은 finding을 만들지 않는다. confirmed direct → caution/allergen, cross → caution/cross_contamination, possible만 → needs_review. title은 `"<기준명> 포함"` / `"<기준명> 교차혼입 가능"` / `"<기준명> 확인 필요"`, evidenceUrl은 기준 sourceUrl.
  - `copy.test.ts`: `COPY`의 모든 문자열과 도메인 모듈이 만드는 모든 title/description 샘플에 `FORBIDDEN_WORDS`가 없음. `COPY.noFlagsNotice === '현재 확인 가능한 정보에서 주의 항목을 찾지 못했어요. 실제 제품 표시를 다시 확인해 주세요.'`

- [ ] **Step 9: 테스트 실패 확인 → 구현 → 통과.** `cd supabase && ~/.deno/bin/deno task test` FAIL 후 각 모듈 구현, 다시 실행해 전부 PASS. `~/.deno/bin/deno check functions/**/*.ts`, `~/.deno/bin/deno lint functions/` 통과.

- [ ] **Step 10: 커밋.** `feat(analysis): 알레르기·질환 판정 로직 추가`.

### Task S3: 공공 API 어댑터·캐시·제품 매칭

**Files:**
- Create: `supabase/functions/_shared/data/http-client.ts` (타임아웃 fetch)
- Create: `supabase/functions/_shared/data/mfds-nutrition-client.ts`
- Create: `supabase/functions/_shared/data/foodsafety-c002-client.ts`
- Create: `supabase/functions/_shared/data/product-repository.ts`
- Create: `supabase/functions/_shared/data/product-matcher.ts`
- Create: `supabase/functions/_shared/data/product-service.ts`
- Test: `supabase/functions/tests/mfds-nutrition-client.test.ts`, `foodsafety-c002-client.test.ts`, `product-matcher.test.ts`, `product-service.test.ts`

**Interfaces:**
```ts
// http-client.ts
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export async function fetchJson(fetcher: FetchLike, url: string, timeoutMs: number): Promise<unknown>; // AbortController, !ok → throw PublicApiError

export class PublicApiError extends Error { constructor(readonly service: 'mfds_nutrition' | 'foodsafety_c002', readonly reason: 'timeout' | 'http' | 'parse' | 'config') }

// 두 클라이언트 공통 출력
export type PublicProductRecord = {
  service: 'mfds_nutrition' | 'foodsafety_c002';
  reportNumber: string | null; name: string; manufacturer: string | null;
  foodType: string | null; servingSize: string | null;
  nutrients: Nutrients | null; ingredientsText: string | null;
  sourceUpdatedAt: string | null; raw: unknown;
};
export function createMfdsNutritionClient(opts: { serviceKey: string; fetcher?: FetchLike; timeoutMs?: number }): { search(q: { name?: string; reportNumber?: string; manufacturer?: string }): Promise<PublicProductRecord[]> };
export function createFoodSafetyC002Client(opts: { apiKey: string; fetcher?: FetchLike; timeoutMs?: number }): { search(q: { name?: string; reportNumber?: string; manufacturer?: string }): Promise<PublicProductRecord[]> };

// product-repository.ts (DB 추상화 — 테스트는 인메모리 구현 사용)
export type CachedProduct = ProductMatch & { normalizedName: string; normalizedManufacturer: string | null };
export interface ProductRepository {
  findByReportNumber(reportNumber: string): Promise<CachedProduct | null>;
  findById(id: string): Promise<CachedProduct | null>;
  searchByName(normalizedName: string, limit: number): Promise<CachedProduct[]>;
  upsert(records: PublicProductRecord[]): Promise<CachedProduct[]>; // report_number 기준 병합, 스냅샷 저장
}
export function createSupabaseProductRepository(serviceClient: SupabaseClient): ProductRepository;
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// product-matcher.ts
export function rankCandidates(scan: ScanPayload, products: CachedProduct[]): ProductCandidate[]; // score 내림차순
export function pickAutomatic(scan: ScanPayload, products: CachedProduct[]): { product: CachedProduct; matchType: 'report_number' | 'name_manufacturer' } | null;

// product-service.ts
export type ProductLookup = {
  product: ProductMatch | null; candidates: ProductCandidate[];
  productMatch: DataQuality['productMatch']; apiStatus: DataQuality['apiStatus'];
};
export function createProductService(deps: { repo: ProductRepository; nutrition: ReturnType<typeof createMfdsNutritionClient>; c002: ReturnType<typeof createFoodSafetyC002Client>; now?: () => Date }): {
  lookup(scan: ScanPayload, selectedProductId: string | null): Promise<ProductLookup>;
  search(query: string, manufacturer: string | null): Promise<ProductCandidate[]>;
};
```

- [ ] **Step 1: API 문서 확인.** WebFetch로 `https://www.data.go.kr/data/15127578/openapi.do`와 `https://foodsafetykorea.go.kr/api/openApiInfo.do?svc_no=C002`를 읽어 엔드포인트·파라미터·응답 필드를 확인한다. 확인하지 못하면 다음 기본값을 쓰고 필드 매핑을 각 클라이언트 상단의 단일 상수 `FIELD_MAP`에 모아 "공식 문서 대조 필요" 주석을 남긴다:
  - 영양: `https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02?serviceKey=&pageNo=1&numOfRows=20&type=json&FOOD_NM_KR=&ITEM_REPORT_NO=&MAKER_NM=` → `body.items[]`의 `FOOD_NM_KR`, `MAKER_NM`, `ITEM_REPORT_NO`, `FOOD_CAT1_NM`, `SERVING_SIZE`, `AMT_NUM1`(kcal), `AMT_NUM3`(단백질 g), `AMT_NUM4`(지방 g), `AMT_NUM6`(탄수화물 g), `AMT_NUM7`(당류 g), `AMT_NUM9`(칼슘 mg), `AMT_NUM11`(인 mg), `AMT_NUM12`(칼륨 mg), `AMT_NUM13`(나트륨 mg), `AMT_NUM24`(포화지방 g), `AMT_NUM23`(콜레스테롤 mg), `UPDATE_DATE`.
  - C002: `https://openapi.foodsafetykorea.go.kr/api/{key}/C002/json/1/20/PRDLST_NM={name}` (또는 `/PRDLST_REPORT_NO={no}`, `&BSSH_NM=`) → `C002.row[]`의 `PRDLST_REPORT_NO`, `PRDLST_NM`, `BSSH_NM`, `PRDLST_DCNM`, `RAWMTRL_NM`, `CHNG_DT`(YYYYMMDD). `C002.RESULT.CODE`가 `INFO-000` 외(`INFO-200` 데이터 없음은 빈 배열)면 에러.
  - 빈 문자열·`'-'`·`'N/A'` 수치는 누락으로 처리(0 아님).

- [ ] **Step 2: 클라이언트 테스트.** 가짜 `fetcher`로 정상 응답 매핑, 수치 누락 처리, `INFO-200` → `[]`, HTTP 500 → `PublicApiError('http')`, 지연 응답 → `timeoutMs: 50`에서 `PublicApiError('timeout')`, 키 없음 → `PublicApiError('config')`를 검증. URL에 키가 들어가지만 에러 메시지·`raw`에는 키가 없어야 한다(assert).

- [ ] **Step 3: 매처 테스트.** `product-matcher.test.ts`:
  - 품목보고번호 정확 일치 후보가 있으면 `pickAutomatic` → `report_number`.
  - 번호 없음, 정규화 이름·제조사 모두 정확 일치 후보가 **정확히 1개** → `name_manufacturer`.
  - 같은 조건 후보 2개 → null. 이름만 일치 → null. 유사도만 높음 → null(설계 8.2-5, "유사도만으로 자동 선택 안 함").
  - `rankCandidates`: 점수 = 0.6×이름 유사도(bigram Dice) + 0.25×제조사 일치(0/1) + 0.15×원재료 토큰 Jaccard(제품 ingredientsText 있을 때). 0개/1개/복수 입력 모두 동작, 최대 10개.

- [ ] **Step 4: 서비스 테스트.** 인메모리 `ProductRepository`로 `product-service.test.ts`:
  - `selectedProductId`가 주어지면 repo.findById → `matchType:'user_selected'`, productMatch `matched`. 없는 id → `not_found`.
  - 캐시 hit(만료 전) → 외부 API 호출 없음, apiStatus `ok`.
  - 캐시 만료(`fetchedAt` + TTL < now) → **현재 요청에서** API 재조회 후 upsert(설계 8.3), apiStatus `ok`.
  - API 오류 + 유효하지 않지만 존재하는 캐시 → 캐시 사용, apiStatus `cache`. API 오류 + 캐시 없음 → product null, productMatch `unavailable`, apiStatus `error`.
  - 후보 0 → `not_found`, 1개지만 자동 선택 조건 불충족 또는 복수 → `ambiguous` + candidates.
  - 영양(nutrition)과 C002 결과는 reportNumber가 같으면 한 제품으로 병합(nutrients는 영양 API, ingredientsText·foodType은 C002). 한쪽 API만 실패해도 다른 쪽 데이터로 진행하고 apiStatus는 `cache`가 아니라 `ok`이되 `missing`에 반영할 수 있도록 서비스 결과에 `partialFailure: boolean`을 추가해도 된다(추가 시 인터페이스를 S4에 맞춰 사용).

- [ ] **Step 5: 구현 → 테스트 통과 → `deno check`/`deno lint`.** `createSupabaseProductRepository`는 `public_food_products`와 `public_api_snapshots`에 쓰며 `request_fingerprint`는 `sha-256(service + 정규화 쿼리)` hex. 이 구현은 단위 테스트 대상이 아니다(S4 통합 시 타입 체크만).

- [ ] **Step 6: 커밋.** `feat(analysis): 공공 식품 API 어댑터와 제품 매칭 추가`.

### Task S4: analyze-food·food-data Edge Function

**실행 상태 (2026-10-05):** 구현과 Deno 자동 검증, 별도 코드 리뷰 및
회귀 수정까지 진행했다. 새 저장 RPC의 마이그레이션·pgTAP 실행은 Docker
부재로 미실행이다. 커밋·푸시는 사용자 승인으로 진행하며 서버 트랙
통합은 아직 수행하지 않았다.

**Files:**
- Create: `supabase/functions/_shared/http/cors.ts`, `http/responses.ts`, `http/auth.ts`, `http/rate-limit.ts`, `http/request-validation.ts`, `http/logger.ts`
- Create: `supabase/functions/_shared/analysis/run-analysis.ts` (순수 오케스트레이션, 의존성 주입)
- Create: `supabase/functions/_shared/analysis/analysis-store.ts` (user-scoped 클라이언트로 저장, 프로필·기준정보 로드)
- Create: `supabase/functions/_shared/analysis/runtime.ts`, `supabase/functions/_shared/http/post-handler.ts`
- Create: `supabase/migrations/20261005000100_analysis_save_rpc.sql`
- Modify: `supabase/.env.example` (Supabase 서버 환경변수 예시)
- Create: `supabase/functions/analyze-food/index.ts`, `supabase/functions/food-data/index.ts`
- Test: `supabase/functions/tests/request-validation.test.ts`, `rate-limit.test.ts`, `logger.test.ts`, `run-analysis.test.ts`, `analyze-food-handler.test.ts`
- Test: `supabase/functions/tests/auth.test.ts`, `analysis-store.test.ts`, `supabase/tests/06_analysis_save.test.sql`

**Interfaces:**
```ts
// request-validation.ts
export const MAX_REQUEST_BYTES = 48 * 1024;
export function parseAnalyzeFoodRequest(body: unknown): { ok: true; value: AnalyzeFoodRequest } | { ok: false; message: string };
export function parseFoodDataRequest(body: unknown): { ok: true; value: { query: string; manufacturer: string | null } } | { ok: false; message: string };
export function containsForbiddenContent(value: string): boolean; // C1 규칙과 동일

// rate-limit.ts — isolate 메모리 기반 best-effort
export function createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number }): { take(key: string): boolean };

// logger.ts — 허용 필드만 출력
export function logEvent(event: string, fields?: Record<string, string | number | boolean | null>): void; // 값에 '@' 포함 문자열은 maskEmail 적용, 키 화이트리스트: status, code, durationMs, productMatch, apiStatus, findingsCount

// auth.ts
export async function requireUser(req: Request, deps: { supabaseUrl: string; anonKey: string }): Promise<{ userId: string; client: SupabaseClient } | null>; // Authorization 헤더로 user-scoped client, auth.getUser()로 검증

// run-analysis.ts
export type AnalysisDeps = {
  loadReference(): Promise<{ allergenStandards: AllergenStandard[]; terms: AllergenTerm[]; diseases: DiseaseStandard[]; rules: DiseaseRule[] }>;
  loadProfile(): Promise<UserProfileSnapshot | null>;
  products: { lookup(scan: ScanPayload, selectedProductId: string | null): Promise<ProductLookup> };
  save(record: { result: AnalysisResult; scan: ScanPayload; profile: UserProfileSnapshot; productId: string | null }): Promise<string>; // analysisId
  now(): Date;
};
export async function runAnalysis(req: AnalyzeFoodRequest, deps: AnalysisDeps): Promise<AnalyzeFoodResponse | { error: 'profile_required' }>;

// analyze-food/index.ts
export function createAnalyzeFoodHandler(deps: { authenticate(req: Request): Promise<{ userId: string; deps: AnalysisDeps } | null>; limiter: { take(key: string): boolean } }): (req: Request) => Promise<Response>;
// 파일 하단: Deno.serve(createAnalyzeFoodHandler(실제 의존성)) — import.meta.main 가드로 테스트 임포트 시 서버 기동 방지
```

- [x] **Step 1: 검증·로깅·속도제한 테스트.** `request-validation.test.ts`: 정상 요청 통과, `scan` 누락, `userReviewed !== true`, `ingredientsText` 공백만, 필드 길이 초과, 추가 키(`imageBase64`, `user_id`) 존재, `data:image/png;base64,` 포함, `file:///` 포함, 500자 base64 연속 문자열, JWT 형태 문자열, `selectedProductId`가 uuid 아님 → 모두 `ok:false`. `rate-limit.test.ts`: limit 20/60초, 21번째 false, 창 경과 후 true. `logger.test.ts`: `console.log`를 스텁해 화이트리스트 외 키는 출력되지 않고 이메일은 `j***@example.com` 형태로 마스킹.

- [x] **Step 2: runAnalysis 테스트.** 가짜 deps로:
  - 프로필 없음 → `{ error: 'profile_required' }`(핸들러는 400 `invalid_request`, message `profile_required`).
  - 라벨에 등록 알레르기 → status `caution`, save 1회 호출, 반환 analysisId 전달.
  - 제품 `ambiguous` → candidates 전달, status `needs_review`, `data_quality` finding(title "제품을 선택해 주세요") 포함, 질환 판정 finding 없이 "제품 선택 후 질환 관련 정보를 확인할 수 있어요" needs_review 1건(설계 13장 "복수 후보: 사용자 선택 전 질환 판정 보류").
  - 제품 `not_found` → 라벨 원재료만으로 알레르기 분석, 질환은 nutrients null로 평가(→ needs_review).
  - 라벨과 API 원재료가 모두 있고 감지된 알레르기 ID 집합이 다르면 `conflicts`에 `"<기준명>: 제품 라벨/식약처 API 중 한쪽에서만 확인"` 기록 + needs_review data_quality finding, 두 출처 finding 모두 유지(제거하지 않음, 설계 8.3).
  - 모든 데이터 완전 + 매칭 없음 → `no_flags`.
  - `result.ruleSetVersion === RULE_SET_VERSION`, `analyzedAt === deps.now().toISOString()`.
  - save에 넘기는 `scan`은 요청 scan 그대로(교정 OCR 스냅샷), `profile`은 로드한 프로필 스냅샷.
  - 선택한 알레르기·질환의 활성 기준 또는 매칭 용어가 누락되면 `missing`과 `needs_review` finding 추가.
  - 선택 질환의 관련 영양값 일부가 없으면 누락을 안내하고 `no_flags` 차단(있는 값은 정보로 유지).

- [x] **Step 3: 핸들러 테스트.** `analyze-food-handler.test.ts`: `OPTIONS` → 204 + CORS 헤더; `GET` → 405; 인증 실패 → 401; 본문 > 48KB(`content-length` 또는 실제 길이) → 413; 잘못된 JSON → 400; 속도 제한 → 429; 정상 → 200 + `AnalyzeFoodResponse`; deps 예외 → 500 `internal`이고 응답·로그에 예외 메시지 원문(사용자 데이터 가능성)을 넣지 않음. 응답 본문에 요청의 `rawText`가 되돌아가지 않음.

- [x] **Step 4: 구현.** `analysis-store.ts`: `loadReference`는 user-scoped client로 기준정보 4개 테이블 select(active만). `loadProfile`은 profiles/user_allergens/user_diseases select(RLS로 본인만). `save`는 동일한 user-scoped client로 `save_my_analysis(p_record)` RPC 호출. RPC는 `security invoker`로 `analyses`와 `analysis_findings`를 한 트랜잭션에서 insert한다(`user_id`는 `auth.uid()` default, `sort_order`는 배열 index, 제품·OCR·프로필은 당시 스냅샷). 원래의 별도 REST insert 두 번은 실패·프로세스 종료 시 불완전한 이력을 남길 수 있어 대체했다. 제품 캐시 쓰기만 service-role client(`SUPABASE_SERVICE_ROLE_KEY` env) 사용. env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MFDS_DATA_GO_KR_SERVICE_KEY`, `FOODSAFETY_KOREA_API_KEY`, `ALLOWED_WEB_ORIGINS`. `food-data/index.ts`는 인증·검증·속도제한 후 `productService.search`.

- [x] **Step 5: 전체 테스트·체크.** Deno 테스트/check/lint 통과. Docker 검증은 사용자 승인으로 생략(통과로 간주하지 않음).
  - Deno 테스트 396개 통과(동시에 반영된 S3 캐시 수정 테스트 포함), entrypoint·테스트 타입 검사 및 Deno lint 통과.
  - 두 entrypoint 직접 실행 시 로컬 `OPTIONS` 204, 미인증 `POST` 401 확인.
  - 기존 통합 worktree에서 Expo lint·타입 검사와 네이티브 테스트 66개, 웹 lint·타입 검사와 테스트 67개 통과. S4 서버 트랙은 아직 통합하지 않았으므로 전체 MVP 통합 검증을 뜻하지 않는다.
  - `docker info`: command not found. 새 RPC 적용·pgTAP·gateway는 미실행.
    이후 사용자가 Docker 테스트 생략을 승인했다.

- [x] **Step 6: 커밋.** `adf85fd` — `feat(analysis): 식품 분석 Edge Function 추가`, 서버 브랜치 push 완료.

---

## Track W — Next.js 웹 앱 (worktree `.worktrees/web`)

모든 W 작업: 시작 전에 설치된 Next 버전의 문서(`web/node_modules/next/dist/docs/` 또는 context7 `/vercel/next.js`)와 `@supabase/ssr` 문서를 확인한다. Next 16 이상이면 `middleware.ts` 대신 `proxy.ts` 규약을 따른다. 스타일은 CSS Modules + `web/src/app/globals.css`의 CSS 변수 토큰(라이트/다크 `prefers-color-scheme`)만 쓴다. Tailwind를 넣지 않는다. 컴포넌트에 색 리터럴을 쓰지 않고 토큰 변수만 쓴다. 모바일 WebView 기준 레이아웃(최대 폭 480px, 터치 타깃 44px 이상, `viewport-fit=cover`, safe-area 패딩).

### Task W1: 웹 프로젝트 골격·Supabase 클라이언트·이메일 OTP 로그인

**Files:**
- Create: `web/` (`npx create-next-app@latest web --ts --eslint --app --src-dir --import-alias "@/*" --use-npm --no-tailwind --yes` — 플래그는 `--help`로 확인), 생성된 샘플 페이지·이미지·README 템플릿 문구 제거
- Create: `web/.env.example` (`NEXT_PUBLIC_SUPABASE_URL=`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`)
- Create: `web/src/lib/supabase/client.ts`, `web/src/lib/supabase/server.ts`, `web/src/lib/supabase/session-proxy.ts`, `web/src/proxy.ts`(또는 버전에 맞는 middleware 파일)
- Create: `web/src/app/(auth)/login/page.tsx`, `web/src/app/(auth)/login/login-form.tsx`, `web/src/app/(auth)/login/login.module.css`
- Create: `web/src/lib/auth/otp.ts` (이메일·코드 검증 순수 함수)
- Create: `web/vitest.config.ts`, `web/src/lib/auth/otp.test.ts`
- Modify: `web/package.json` scripts: `"lint": "eslint ."`, `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`
- 루트 파일(`tsconfig.json`, 루트 ESLint 설정, 루트 `package.json`)은 수정하지 않는다. 루트 타입 체크·린트에서 `web/`을 제외하는 일은 Task N1이 맡는다.

**Interfaces:**
```ts
// otp.ts
export function normalizeEmail(input: string): string | null; // trim·lowercase, 간단한 형식 검사 실패 시 null
export function normalizeOtp(input: string): string | null;   // 숫자 6자리만
// client.ts
export function createBrowserSupabase(): SupabaseClient; // @supabase/ssr createBrowserClient 싱글턴
// server.ts
export async function createServerSupabase(): Promise<SupabaseClient>; // cookies() 사용
```

- [ ] **Step 1: 생성·의존성.** `create-next-app` 실행 후 `cd web && npm install @supabase/supabase-js @supabase/ssr && npm install -D vitest`. `web/` 안에 `.git`이 생기면 삭제한다. 루트 `.gitignore`에 `web/.next/`, `web/node_modules/`, `web/.env*.local`이 무시되는지 확인(웹 자체 `.gitignore`로도 충분).
- [ ] **Step 2: 실패 테스트.** `otp.test.ts`: `normalizeEmail(' A@B.co ')` → `'a@b.co'`, `'abc'` → null; `normalizeOtp(' 123 456 ')` → `'123456'`, `'12345'`·`'abcdef'` → null. `npm test` FAIL 확인.
- [ ] **Step 3: 구현.** 로그인 폼 2단계: 이메일 입력 → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` → 코드 입력(`inputMode="numeric"`, `autoComplete="one-time-code"`, maxLength 6) → `supabase.auth.verifyOtp({ email, token, type: 'email' })` → `router.replace('/')`. 매직링크 문구 없음. 오류는 사용자 친화 문구(원문 에러 메시지 노출 금지), 재전송 60초 쿨다운. 세션 proxy는 `@supabase/ssr` 공식 패턴으로 쿠키 갱신 + 비로그인 사용자가 `(service)` 경로 접근 시 `/login` 리다이렉트, 로그인 사용자가 `/login` 접근 시 `/`.
- [ ] **Step 4: 검증.** `cd web && npm run lint && npm run typecheck && npm test && npm run build`(env 없으면 build는 더미 값 `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy`로 실행) 모두 통과.
- [ ] **Step 5: 커밋.** `feat(web): 웹 앱 골격과 이메일 OTP 로그인 추가`.

### Task W2: 네이티브 브리지 클라이언트·분석 API 클라이언트·개인화 설정

**Files:**
- Create: `web/src/lib/native-bridge/contract.ts` (C1 타입·상수 그대로), `web/src/lib/native-bridge/validate.ts`, `web/src/lib/native-bridge/bridge-client.ts`
- Create: `web/src/lib/analysis/types.ts` (C2 타입 그대로, "supabase/functions/_shared/domain/types.ts와 동일하게 유지" 주석), `web/src/lib/analysis/analyze-client.ts`
- Create: `web/src/lib/profile/reference.ts` (기준정보 조회), `web/src/lib/profile/profile-form.ts` (폼 상태 순수 로직)
- Create: `web/src/app/(service)/layout.tsx`, `web/src/app/(service)/profile/page.tsx`, `web/src/app/(service)/profile/profile-form-view.tsx`, `profile.module.css`
- Create: `web/src/components/support-badge.tsx`, `web/src/components/page-header.tsx`, `web/src/components/consent-notice.tsx`
- Test: `web/src/lib/native-bridge/validate.test.ts`, `bridge-client.test.ts`, `web/src/lib/profile/profile-form.test.ts`, `web/src/lib/analysis/analyze-client.test.ts`

**Interfaces:**
```ts
// validate.ts
export function containsForbiddenContent(value: string): boolean;
export function parseNativeMessage(raw: unknown): { ok: true; message: NativeToWebMessage } | { ok: false; reason: 'not_string' | 'too_large' | 'invalid_json' | 'unsupported_version' | 'unknown_type' | 'invalid_shape' | 'forbidden_content' };
// bridge-client.ts
export type ScanOutcome = { kind: 'result'; payload: ScanPayload } | { kind: 'cancelled' } | { kind: 'failed'; code: ScanFailedV1['code'] };
export function isNativeApp(win?: Window): boolean; // typeof window.ReactNativeWebView?.postMessage === 'function'
export function createBridgeClient(win: Window, opts?: { timeoutMs?: number; createId?: () => string }): { requestScan(): Promise<ScanOutcome>; dispose(): void };
// 동시에 1건만 대기. 대기 중 재요청 시 이전 요청을 cancelled로 종료. 대기 requestId와 다른 메시지·이미 처리한 requestId·검증 실패 메시지는 무시. timeoutMs 기본 10분 → failed/unknown.
// analyze-client.ts
export async function analyzeFood(supabase: SupabaseClient, req: AnalyzeFoodRequest): Promise<{ ok: true; data: AnalyzeFoodResponse } | { ok: false; code: ApiError['error']['code'] | 'network' }>;
export async function searchFoodCandidates(supabase: SupabaseClient, query: string, manufacturer: string | null): Promise<{ ok: true; candidates: ProductCandidate[] } | { ok: false; code: string }>;
// profile-form.ts
export type ProfileFormState = { consent: boolean; allergenIds: Set<string>; hasNoKnownDisease: boolean; diseaseIds: Set<string>; otherNote: string };
export function toggleDisease(state: ProfileFormState, id: string): ProfileFormState; // DIS-001 선택 시 나머지 해제·hasNoKnownDisease true, 다른 질환 선택 시 DIS-001 해제
export function toSaveArgs(state: ProfileFormState, consentVersion: string): { p_consent_version: string; p_has_no_known_disease: boolean; p_allergen_ids: string[]; p_diseases: { diseaseId: string; note: string | null }[] }; // DIS-001은 p_diseases에 넣지 않음, note는 DIS-028만
export const CONSENT_VERSION = '2026-09-30';
export const SUPPORT_LABEL: Record<DiseaseSupport, '분석 지원' | '일부 지원' | '정보 저장만' | '선택 상태'>;
```

- [ ] **Step 1: 실패 테스트 작성.** `validate.test.ts`: 정상 SCAN_RESULT/CANCELLED/FAILED 통과; 문자열 아님, 64KB 초과, 깨진 JSON, `version: 2`, `type: 'EVAL'`, payload 추가 키, `userReviewed: false`, 알 수 없는 failed code, `data:image/jpeg;base64,...`, `file:///var/...`, JWT 문자열 → 각 reason. `bridge-client.test.ts`(jsdom 환경 `// @vitest-environment jsdom`, `npm i -D jsdom`): 가짜 `ReactNativeWebView.postMessage`가 받은 요청이 C1 형식; `window.dispatchEvent(new MessageEvent('message', { data }))`로 결과 전달 시 resolve; 다른 requestId 무시; 같은 결과 두 번 보내도 1회만 처리; 타임아웃 → failed/unknown. `profile-form.test.ts`: 배타 선택, note는 DIS-028일 때만. `analyze-client.test.ts`: `supabase.functions.invoke` 스텁으로 성공·HTTP 오류 코드 매핑(`FunctionsHttpError`의 context 응답 JSON의 `error.code`)·네트워크 오류.
- [ ] **Step 2: FAIL 확인 → 구현 → PASS.**
- [ ] **Step 3: 서비스 레이아웃.** `(service)/layout.tsx`: 서버에서 사용자 확인(없으면 `/login`), 하단 내비게이션(홈·이력·설정, 프로필은 설정·홈에서 진입), `ScanSessionProvider`(W3에서 추가하므로 이 작업에서는 레이아웃만).
- [ ] **Step 4: 프로필 화면.** 서버 컴포넌트에서 기준정보(`allergen_standards` active 정렬, `disease_standards` 카테고리 그룹)와 현재 선택값을 읽어 클라이언트 폼에 전달. 동의 안내(`consent-notice.tsx`: 수집 항목=알레르기·질환·분석 이력, 목적=개인화 주의 정보 표시, 보유=탈퇴 시까지, 삭제=설정의 회원 탈퇴 즉시 삭제, "의료 진단·치료·처방을 제공하지 않습니다") + 필수 체크박스. 알레르기 19종 체크리스트, 질환 카테고리별 체크리스트 + 각 항목 `SupportBadge`, DIS-028 선택 시 메모 입력(200자). 저장은 `supabase.rpc('save_my_profile', toSaveArgs(...))`. 저장 성공 시 홈으로. 동의 없으면 저장 버튼 비활성.
- [ ] **Step 5: 검증.** `npm run lint && npm run typecheck && npm test && npm run build`(더미 env).
- [ ] **Step 6: 커밋.** `feat(web): 브리지 클라이언트와 개인화 설정 화면 추가`.

### Task W3: 홈·스캔·후보 선택·결과·이력·설정

**Files:**
- Create: `web/src/components/scan-session-provider.tsx` (Context: 메모리에만 스캔 텍스트·후보 보관)
- Create: `web/src/app/(service)/page.tsx`, `web/src/app/(service)/home-scan-panel.tsx`, `home.module.css`
- Create: `web/src/app/(service)/analyses/page.tsx` (이력 목록), `analyses/[id]/page.tsx` (결과 상세), `analyses/select/page.tsx` + `candidate-picker.tsx` (후보 선택), `analyses/analyses.module.css`
- Create: `web/src/components/analysis-result-view.tsx`, `web/src/components/status-banner.tsx`, `web/src/components/finding-list.tsx`, `web/src/components/data-quality-panel.tsx`
- Create: `web/src/lib/analysis/present.ts` (상태·출처 라벨 순수 함수), `web/src/lib/analysis/load-analysis.ts` (DB 행 → AnalysisResult)
- Create: `web/src/app/(service)/settings/page.tsx`, `settings/settings-actions.tsx`, `settings.module.css`
- Test: `web/src/lib/analysis/present.test.ts`, `web/src/lib/analysis/load-analysis.test.ts`, `web/src/lib/analysis/copy-guard.test.ts`

**Interfaces:**
```ts
// present.ts
export const STATUS_LABEL = { caution: '주의', needs_review: '확인 필요', no_flags: '특이사항 없음' } as const;
export const SOURCE_LABEL = { label: '제품 라벨', mfds_api: '식약처 API', user_profile: '내 설정', rule: '분석 규칙' } as const;
export const NO_FLAGS_NOTICE = '현재 확인 가능한 정보에서 주의 항목을 찾지 못했어요. 실제 제품 표시를 다시 확인해 주세요.';
export const DISCLAIMER = '이 결과는 의료 진단·치료·처방이나 섭취 허가가 아니에요. 공공 데이터와 촬영 정보에 없는 성분이 있을 수 있어요.';
export function sortFindings(findings: Finding[]): Finding[]; // caution → needs_review → info
// load-analysis.ts
export type AnalysisRow = { id: string; status: AnalysisResult['status']; product_snapshot: ProductMatch | null; data_quality: DataQuality; rule_set_version: string; created_at: string; analysis_findings: { category: Finding['category']; severity: Finding['severity']; standard_id: string | null; title: string; description: string; matched_text: string | null; source: Finding['source']; evidence_url: string | null; sort_order: number }[] };
export function rowToResult(row: AnalysisRow): AnalysisResult;
// scan-session-provider.tsx
export type PendingScan = { scan: ScanPayload; candidates: ProductCandidate[]; draftAnalysisId: string };
export function ScanSessionProvider(props: { children: React.ReactNode }): JSX.Element;
export function useScanSession(): { pending: PendingScan | null; setPending(p: PendingScan | null): void };
```

- [ ] **Step 1: 실패 테스트.** `present.test.ts`(정렬·라벨), `load-analysis.test.ts`(행 → 결과, sort_order 정렬), `copy-guard.test.ts`: `web/src` 아래 모든 `.ts/.tsx` 파일을 `fs`로 읽어 문자열 리터럴·JSX 텍스트에 `안심`, `안전`, `섭취 적합`이 없음을 검사(테스트 파일 자신과 금지어 정의 줄은 제외).
- [ ] **Step 2: 구현 — 홈.** 프로필(동의) 없으면 `/profile`로 리다이렉트. `isNativeApp()`이면 "라벨 촬영하기" 버튼 → `requestScan()` → result면 `analyzeFood({ scan })`; 응답 candidates 비어있지 않으면 `setPending` 후 `/analyses/select`, 아니면 `/analyses/{analysisId}`. cancelled는 조용히 복귀, failed는 코드별 안내(`permission_denied`: 카메라 권한 설정 안내, `ocr_failed`/`invalid_image`: 다시 촬영, `unknown`). 분석 요청 실패 시 스캔 텍스트를 Context에 유지하고 "다시 시도" 버튼(설계 13장 — 영구 저장 금지). 일반 브라우저면 "라벨 촬영은 앱에서만 사용할 수 있어요" 안내. 최근 이력 3건 링크.
- [ ] **Step 3: 구현 — 후보 선택.** pending 없으면 홈으로. 후보 목록(이름·제조사·품목보고번호, 점수 비노출), "목록에 없어요"(선택 없이 현재 draft 결과로 이동), 수동 검색 입력(`searchFoodCandidates`). 선택 시 `analyzeFood({ scan, selectedProductId })` → 새 analysisId로 이동, pending 해제.
- [ ] **Step 4: 구현 — 결과 상세.** 서버 컴포넌트에서 `analyses` + `analysis_findings` 조회(RLS). `StatusBanner`(상태 라벨, no_flags면 `NO_FLAGS_NOTICE` 항상 표시), 제품 정보(출처·기준일), `FindingList`(심각도·제목·설명·일치 원문·`SOURCE_LABEL`·근거 링크는 `target="_blank" rel="noopener noreferrer"` — 네이티브가 시스템 브라우저로 연다), `DataQualityPanel`(OCR 확인 여부, 제품 매칭 상태, API 상태, 충돌·부족 목록), `DISCLAIMER` 상시 표시. 이력 목록: 최신순 20건 페이지네이션(`range`), 상태·제품명·날짜.
- [ ] **Step 5: 구현 — 설정.** 프로필 수정 링크, 개인정보 처리 안내(동의 문구 재사용), 로그아웃(`auth.signOut()` → `/login`), 회원 탈퇴: 확인 단계(페이지 내 2단계 버튼, `confirm()` 사용 금지) → `rpc('delete_my_account')` → `signOut()` → `/login`.
- [ ] **Step 6: 검증.** `npm run lint && npm run typecheck && npm test && npm run build`(더미 env).
- [ ] **Step 7: 커밋.** `feat(web): 스캔·결과·이력·설정 화면 추가`.

---

## Track N — Expo 네이티브 셸 (worktree `.worktrees/native`)

### Task N1: FSD 구조 이동·템플릿·웹 잔재 정리·린트 규칙·테스트 러너

**Files:**
- Delete: `src/components/animated-icon.web.tsx`, `animated-icon.module.css`, `app-tabs.web.tsx`, `web-badge.tsx`, `src/hooks/use-color-scheme.web.ts`, `src/global.css`, `src/app/explore.tsx`, `src/components/app-tabs.tsx`, `src/components/hint-row.tsx`, `src/components/ui/collapsible.tsx`, `src/components/external-link.tsx`, `scripts/reset-project.js`(템플릿 스크립트) 및 `package.json`의 `reset-project`, `web` 스크립트, `app.json`의 `expo.web`, 템플릿 전용 에셋(`assets/images/tabIcons/`, 사용처 없는 react-logo 등 — `grep`으로 사용처 확인 후)
- Move: `src/components/themed-text.tsx` → `src/shared/ui/themed-text.tsx`, `themed-view.tsx` → `src/shared/ui/themed-view.tsx`, `animated-icon.tsx` → `src/shared/ui/animated-icon.tsx`(스플래시 오버레이 유지 시), `src/hooks/use-color-scheme.ts` → `src/shared/lib/use-color-scheme.ts`, `use-theme.ts` → `src/shared/lib/use-theme.ts`, `src/constants/theme.ts` → `src/shared/config/theme.ts`(`global.css` 임포트·`web` 폰트 항목·`BottomTabInset` 제거)
- Create: `src/pages/web-shell/index.ts`, `src/pages/web-shell/web-shell-screen.tsx`(N1에서는 임시 placeholder가 아니라 "웹 앱 URL 미설정" 안내 화면으로 시작 — N2에서 WebView로 교체)
- Modify: `src/app/index.tsx` → `export { default } from '@/pages/web-shell';`, `src/app/_layout.tsx` → `Stack`(헤더 숨김) + 테마 + 스플래시
- Create: `eslint.config.js` (`npx expo lint`가 생성) + FSD `no-restricted-imports` 오버라이드 + `ignores: ['web/**', 'supabase/**', '.worktrees/**']`
- Create: `jest.config.js` (jest-expo preset), `package.json` `"test": "jest"`, `src/shared/lib/example-guard.test.ts` 대신 N2·N3에서 첫 테스트 추가(이 작업에서는 `npm test -- --passWithNoTests`로 러너 동작만 확인)
- Modify: `tsconfig.json` `"exclude": ["web", "supabase", ".worktrees"]`
- Modify: `AGENTS.md`/`docs/rules/architecture.md`에서 "현재 이동 중" 문구를 실제 상태로 갱신(필요한 최소 범위)

- [ ] **Step 1:** `npx expo lint`로 ESLint 초기화(eslint·eslint-config-expo 설치 허용). 생성된 flat config 구조를 읽고 FSD 설계 표(`docs/superpowers/specs/2026-09-22-fsd-structure-design.md` "규칙 강제 수단")대로 `no-restricted-imports` 오버라이드 추가.
- [ ] **Step 2:** 파일 이동·삭제·임포트 갱신. `Platform.OS === 'web'` 분기와 `Platform.select`의 `web` 키 제거. 사용처 없는 템플릿 파일이 남지 않았는지 `grep -rn "@/components\|@/hooks\|@/constants" src`로 확인(0건).
- [ ] **Step 3:** `npx expo install jest-expo jest @types/jest -- --save-dev`(문서 `https://docs.expo.dev/develop/unit-testing/` 확인). `jest.config.js`: `{ preset: 'jest-expo', testPathIgnorePatterns: ['/node_modules/', '/web/', '/supabase/', '/.worktrees/'] }`.
- [ ] **Step 4: 역방향 임포트 검증.** `src/shared/lib/tmp-violation.ts`에 `import '@/pages/web-shell';`를 넣고 `npx expo lint`가 에러를 내는지 확인 후 파일 삭제.
- [ ] **Step 5: 검증.** `npx expo start`를 한 번 백그라운드로 띄워 `.expo/types` 생성 후 종료(이미 있으면 생략), `npx expo lint`, `npx tsc --noEmit`, `npm test -- --passWithNoTests`, `npx expo-doctor` 실행. 실패 항목은 원인과 함께 보고.
- [ ] **Step 6: 커밋.** `refactor(structure): FSD 구조 이동과 템플릿 잔재 정리` (본문: 이동 매핑, 제거 파일, 린트 강제, 사용자 영향 = 템플릿 탭 화면이 사라지고 단일 셸 화면으로 바뀜).

### Task N2: WebView 셸·브리지·탐색 제한

**Files:**
- Create: `src/shared/config/bridge-contract.ts` (C1 타입·상수 그대로)
- Create: `src/shared/config/app-config.ts`
- Create: `src/features/native-bridge/index.ts`, `validate-message.ts`, `build-injection.ts`, `scan-session-context.tsx`, `use-native-bridge.ts`
- Create: `src/features/web-navigation/index.ts`, `navigation-policy.ts`
- Modify: `src/pages/web-shell/web-shell-screen.tsx` (WebView + 로드 실패 화면)
- Create: `src/pages/web-shell/web-load-error.tsx`
- Modify: `src/app/_layout.tsx` (`ScanSessionProvider` 주입)
- Create: `.env.example` (`EXPO_PUBLIC_WEB_APP_URL=https://example.invalid`)
- Test: `src/features/native-bridge/validate-message.test.ts`, `build-injection.test.ts`, `src/features/web-navigation/navigation-policy.test.ts`

**Interfaces:**
```ts
// app-config.ts
export type WebAppConfig = { url: string; origin: string } | { error: 'missing' | 'insecure' | 'invalid' };
export function resolveWebAppConfig(raw: string | undefined, isDev: boolean): WebAppConfig; // 프로덕션은 https만, 개발은 http 허용
export const webAppConfig: WebAppConfig; // resolveWebAppConfig(process.env.EXPO_PUBLIC_WEB_APP_URL, __DEV__)
// validate-message.ts
export function containsForbiddenContent(value: string): boolean;
export function parseWebMessage(raw: string, seenRequestIds: Set<string>): { ok: true; message: ScanRequestV1 } | { ok: false; reason: 'too_large' | 'invalid_json' | 'unsupported_version' | 'unknown_type' | 'invalid_shape' | 'duplicate_request' };
export function assertOutgoingMessage(msg: NativeToWebMessage): NativeToWebMessage; // 크기·금지 내용 위반 시 throw
// build-injection.ts
export function buildInjection(msg: NativeToWebMessage): string;
// navigation-policy.ts
export function decideNavigation(url: string, allowedOrigin: string): 'allow' | 'external' | 'block'; // 같은 origin → allow, http(s) 다른 origin → external(Linking.openURL), about:blank → allow, 그 외 스킴(javascript:, file:, data:, intent: 등) → block
// scan-session-context.tsx
export type ScanSession = { requestId: string } | null;
export function ScanSessionProvider(props: { children: React.ReactNode }): React.JSX.Element;
export function useScanSession(): {
  active: ScanSession;
  start(requestId: string): void;
  complete(msg: NativeToWebMessage): void;  // outbox에 넣고 active 해제
  outbox: NativeToWebMessage[]; drain(): NativeToWebMessage[];
};
// use-native-bridge.ts
export function useNativeBridge(webViewRef: React.RefObject<WebView | null>, allowedOrigin: string): { onMessage(event: WebViewMessageEvent): void };
// onMessage: origin 검사 → parseWebMessage → start(requestId) → router.push({ pathname: '/scanner', params: { requestId } })
// outbox가 생기면 injectJavaScript(buildInjection(msg))
```

- [ ] **Step 1: 문서 확인.** `https://docs.expo.dev/versions/v57.0.0/sdk/webview/`와 react-native-webview 문서(`originWhitelist`, `onShouldStartLoadWithRequest`, `setSupportMultipleWindows`, `sharedCookiesEnabled`, `allowFileAccess`, `injectJavaScript`)를 읽는다. `npx expo install react-native-webview`.
- [ ] **Step 2: 실패 테스트.** `validate-message.test.ts`: 정상 요청, 1KB 초과, 깨진 JSON, `version: 2`, `type: 'SCAN_RESULT'`(웹이 보낼 수 없는 타입), 추가 키, requestId 형식 위반, 중복 requestId → 각 reason; `assertOutgoingMessage`는 payload에 `data:image/png;base64,`나 `file://`가 있으면 throw, 64KB 초과 throw. `build-injection.test.ts`: `</script>`·따옴표·줄바꿈·` `이 든 payload를 넣은 결과 문자열을 `new Function`으로 평가했을 때 dispatch되는 `data`가 원래 JSON과 동일(가짜 `window` 주입), 코드 실행 우회 불가. `navigation-policy.test.ts`: 같은 origin 경로 allow, `https://other.com` external, `javascript:alert(1)` block, `file:///` block, `http://`(prod origin이 https일 때 같은 host라도 스킴 다르면 external 아님 block) — 규칙을 명확히 테스트.
- [ ] **Step 3: 구현.** `WebShellScreen`: `webAppConfig` 오류면 설정 안내 화면. WebView props: `source={{ uri: url }}`, `originWhitelist={[origin]}`, `onShouldStartLoadWithRequest`(decideNavigation; external이면 `Linking.openURL` 후 false), `setSupportMultipleWindows={false}`, `javaScriptCanOpenWindowsAutomatically={false}`, `allowFileAccess={false}`, `allowingReadAccessToURL` 미사용, `sharedCookiesEnabled`, `onMessage`, `onError`/`onHttpError`(main frame 5xx) → `WebLoadError`(재시도 버튼 `reload`), `pullToRefreshEnabled` Android 대응은 선택. 안드로이드 하드웨어 뒤로가기: WebView `canGoBack`이면 `goBack`. 색은 `useTheme` 토큰, SafeArea 적용.
- [ ] **Step 4: 검증.** `npx expo lint && npx tsc --noEmit && npm test && npx expo-doctor`.
- [ ] **Step 5: 커밋.** `feat(shell): WebView 셸과 브리지 계약 추가`.

### Task N3: 촬영·OCR·교정·임시 이미지 수명

**Files:**
- Create: `src/features/food-ocr/index.ts`, `extract-label-fields.ts`, `merge-label-fields.ts`, `recognize-text.ts`, `prepare-image.ts`, `temp-image-store.ts`, `use-food-ocr.ts`, `scanner-camera.tsx`, `scanner-review.tsx`, `permission-notice.tsx`
- Create: `src/pages/scanner/index.ts`, `src/pages/scanner/scanner-screen.tsx`
- Create: `src/app/scanner.tsx` (`export { default } from '@/pages/scanner';`)
- Modify: `src/app/_layout.tsx` (`scanner`를 `fullScreenModal`로, 앱 시작 시 `cleanupStaleImages()` 호출)
- Modify: `app.json` (config plugins: `expo-camera` 권한 문구 `"라벨의 원재료와 알레르기 표시를 읽기 위해 카메라를 사용합니다. 사진은 기기 밖으로 전송되지 않습니다."`, 마이크 권한 비활성 `recordAudioAndroid: false` 등 문서에 맞춰, `expo-dev-client`)
- Test: `src/features/food-ocr/extract-label-fields.test.ts`, `merge-label-fields.test.ts`, `temp-image-store.test.ts`

**Interfaces:**
```ts
// extract-label-fields.ts
export type LabelFields = Omit<ScanPayload, 'userReviewed'>;
export function extractLabelFields(rawText: string): LabelFields;
// 제품명: /제품명\s*[:：]?\s*(.+)/, 제조사: /(제조원|제조사|제조업소|제조자)\s*[:：]?\s*(.+)/(주소 앞까지),
// 품목보고번호: /품목\s*보고\s*번호\s*[:：]?\s*([0-9\- ]{8,24})/ → 숫자만,
// 원재료: /원재료\s*명?(?:\s*및\s*함량)?\s*[:：]?\s*/ 이후 ~ 다음 표지(알레르기|이 제품은|내용량|보관|유통기한|소비기한|제조원|영양정보) 전,
// 알레르기 문구: '알레르기' 또는 '함유' 포함 문장(교차혼입 제외), 교차혼입: /(같은|동일한)\s*(제조)?\s*시설|혼입/ 문장.
// merge-label-fields.ts
export function mergeLabelFields(productSide: LabelFields | null, ingredientSide: LabelFields): LabelFields; // 제품 필드는 productSide 우선, 원재료·문구는 ingredientSide 우선, rawText는 두 면을 '\n---\n'으로 결합
// recognize-text.ts
export async function recognizeText(uri: string): Promise<string>; // ML Kit 한국어 스크립트, 실패 시 throw OcrError
// prepare-image.ts
export async function prepareImage(uri: string): Promise<string>; // expo-image-manipulator로 긴 변 2000px 리사이즈, JPEG 0.85, EXIF 미보존. 원본 삭제
// temp-image-store.ts
export type FileOps = { delete(uri: string): Promise<void>; listCacheDirs(): Promise<string[]> };
export function createTempImageStore(ops: FileOps): { track(uri: string): void; releaseAll(): Promise<void>; cleanupStale(): Promise<void> };
export const tempImageStore: ReturnType<typeof createTempImageStore>; // expo-file-system 구현
export function cleanupStaleImages(): Promise<void>;
// use-food-ocr.ts
export type OcrStep = 'product' | 'ingredients' | 'processing' | 'review';
export function useFoodOcr(): { step: OcrStep; capture(uri: string): Promise<void>; skipProduct(): void; retake(side: 'product' | 'ingredients'): Promise<void>; fields: LabelFields | null; error: 'ocr_failed' | 'invalid_image' | null; reset(): Promise<void> };
```

- [ ] **Step 1: 문서·래퍼 확인.** SDK 57 문서에서 `expo-camera`(CameraView, `takePictureAsync` 옵션 `exif: false`, `useCameraPermissions`), `expo-image-manipulator`(현재 API — `ImageManipulator.manipulate(...).resize().renderAsync()` / `saveAsync` 여부), `expo-file-system`(SDK 57의 `File`/`Directory`/`Paths.cache` API), `expo-dev-client`를 확인. OCR 래퍼는 `@react-native-ml-kit/text-recognition`(Korean `TextRecognitionScript.KOREAN`)을 1순위로 README를 확인해 RN 0.86·New Architecture 지원 여부를 기록한다. 설치: `npx expo install expo-camera expo-image-manipulator expo-file-system expo-dev-client @react-native-ml-kit/text-recognition`. 래퍼 설치가 불가능하거나 빌드 요구사항이 CNG와 충돌하면 `recognize-text.ts`만 교체 지점으로 남기고(명시적 `OcrUnavailableError` throw — 조용한 폴백 금지) 보고한다. 개발 빌드 실행(`npx expo run:*`)은 이 환경에서 하지 않으며 수동 검증 항목으로 남긴다.
- [ ] **Step 2: 실패 테스트.** `extract-label-fields.test.ts`: 대표 라벨 텍스트 5개 이상(줄바꿈이 뒤섞인 OCR 텍스트, `원재료명 및 함량`, `품목보고번호 : 2006 0123 456-78`, 교차혼입 문장, 필드 누락 시 null과 빈 원재료 `''`). `merge-label-fields.test.ts`: 우선순위 규칙. `temp-image-store.test.ts`: 가짜 FileOps로 track 후 releaseAll이 모두 삭제, 삭제 실패해도 나머지 계속 삭제하고 throw하지 않되 실패 수 반환 또는 로그(개인정보 없이), cleanupStale이 Camera·ImageManipulator 캐시 디렉터리 항목 삭제.
- [ ] **Step 3: 구현.** `ScannerScreen`: route param `requestId`를 `useLocalSearchParams`로 읽고 `useScanSession().active?.requestId`와 다르면 즉시 닫기. 단계 UI: 제품 정보면 촬영(건너뛰기 가능) → 원재료면 촬영(필수) → OCR 처리 중 표시 → `ScannerReview`(필드별 TextInput, 원재료 비었으면 "원재료가 인식되지 않았어요. 다시 촬영해 주세요." 경고와 전송 비활성, 재촬영 버튼, 취소). 전송 시 `complete({ version:1, type:'SCAN_RESULT', requestId, payload: { ...fields, userReviewed: true } })` → `releaseAll()` → `router.back()`. 취소·뒤로가기 → `SCAN_CANCELLED` + releaseAll. 권한 거부 → `PermissionNotice`(이유 설명 + `Linking.openSettings()` 버튼 + 닫기 시 `SCAN_FAILED permission_denied`). OCR 예외 → 재촬영/취소 선택, 취소 시 `SCAN_FAILED ocr_failed`. 모든 종료 경로에서 임시 파일 삭제(`useEffect` cleanup 포함). 이미지 URI·Base64는 절대 메시지·로그에 넣지 않는다. 색은 `useTheme`, 접근성 라벨·44pt 터치 타깃.
- [ ] **Step 4: 검증.** `npx expo lint && npx tsc --noEmit && npm test && npx expo-doctor`. `npx expo prebuild --no-install --clean`은 실행하지 않는다(생성 디렉터리 금지) — 대신 `npx expo config --type prebuild`로 플러그인 설정이 해석되는지 확인.
- [ ] **Step 5: 커밋.** `feat(scan): 라벨 촬영과 온디바이스 OCR 추가`.

---

## Task F: 통합·전체 검증·이력·PR·병합 (메인 세션)

- [x] **Step 1:** native/web 통합 브랜치에 최신 main과 서버 트랙을 병합. 기존 변경 보존, 충돌 없음.
- [x] **Step 2: 전체 검증.** 위 통합 결과와 PR 이력에 실제 결과 및 사용자 승인 예외 기록. Docker와 실기기 검증은 미실행.
- [x] **Step 3: 최종 코드 리뷰.** 전체 diff 리뷰 완료, Important 4건 수정 및 회귀 테스트 통과. Critical 없음.
- [ ] **Step 4: PR.** push 후 `gh pr create --draft`로 PR 번호 확보 → `docs/history/2026-09-30-pr-<n>-hybrid-food-analysis-mvp.md` 작성(템플릿 준수: 설계 대비 차이 — FSD 적용, 추가 열, `--allow-read`, 미실행 검증·수동 확인 항목) → 커밋·push → `gh pr ready` → `gh pr merge --merge`(사용자가 병합까지 명시 요청).
