-- 하이브리드 식품 분석 MVP 핵심 스키마 (설계 9.3)
--
-- 설계의 데이터 모델(9.3)에 없는 열을 추가한 곳은 아래처럼 이유를 남긴다.
--   * public_food_products.display_name, normalized_manufacturer:
--     검색/정규화에는 normalized_* 열을 쓰고, 사용자에게 보여줄 원문
--     표기는 display_name에 별도로 보존한다(정규화 과정에서 원문 표기가
--     손실되지 않도록).
--   * analyses.product_snapshot: product_id가 가리키는 공공 데이터는
--     이후 갱신될 수 있으므로, 분석 시점의 제품 정보를 그대로 스냅샷으로
--     보존해 과거 분석 결과가 바뀌지 않게 한다.
--   * analysis_findings.user_id: RLS 정책을 analyses와의 서브쿼리 조인 없이
--     단순 컬럼 비교로 표현하기 위해 비정규화한다(select/update/delete).
--   * analysis_findings.sort_order: findings 표시 순서를 프론트엔드가
--     임의로 재계산하지 않고 서버가 부여한 순서를 그대로 쓰기 위함.

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
