-- RLS 격리 테스트: 사용자 A/B 상호 격리, 기준정보·캐시 테이블 권한.
--
-- disease_rules는 이번 작업(S1)에서 근거 있는 행을 시드하지 않았으므로
-- (11.1: "임계값을 임의로 만들지 않는다"), 다른 기준정보 테이블과 달리
-- "행 수 > 0"이 아니라 "오류 없이 조회 가능"만 검증한다.
begin;
select plan(36);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'user-a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'user-b@example.test');

-- ===================== A: 본인 소유 행 생성 =====================
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);

select lives_ok(
  $$ insert into public.profiles (user_id, consent_version, has_no_known_disease)
     values ('11111111-1111-1111-1111-111111111111', 'v1', true) $$,
  'A는 본인 profiles 행을 만들 수 있다'
);

select lives_ok(
  $$ insert into public.user_allergens (user_id, allergen_id)
     values ('11111111-1111-1111-1111-111111111111', 'FOOD-001') $$,
  'A는 본인 user_allergens 행을 만들 수 있다'
);

select lives_ok(
  $$ insert into public.user_diseases (user_id, disease_id, note)
     values ('11111111-1111-1111-1111-111111111111', 'DIS-002', null) $$,
  'A는 본인 user_diseases 행을 만들 수 있다'
);

select lives_ok(
  $$ insert into public.analyses
       (id, user_id, status, corrected_ocr_payload, profile_snapshot, rule_set_version, data_quality)
     values (
       '33333333-3333-3333-3333-333333333333',
       '11111111-1111-1111-1111-111111111111',
       'no_flags', '{}'::jsonb, '{}'::jsonb, '2026-09-30.1', '{}'::jsonb
     ) $$,
  'A는 본인 analyses 행을 만들 수 있다'
);

select lives_ok(
  $$ insert into public.analysis_findings
       (analysis_id, user_id, category, severity, title, description, source)
     values (
       '33333333-3333-3333-3333-333333333333',
       '11111111-1111-1111-1111-111111111111',
       'data_quality', 'info', '제목', '설명', 'rule'
     ) $$,
  'A는 본인 analyses에 딸린 analysis_findings 행을 만들 수 있다'
);

-- ===================== 기준정보 / 공공 캐시 테이블 =====================

select cmp_ok(
  (select count(*) from public.allergen_standards), '>', 0::bigint,
  'authenticated는 allergen_standards를 읽을 수 있다(행 수 > 0)'
);

select cmp_ok(
  (select count(*) from public.allergen_match_terms), '>', 0::bigint,
  'authenticated는 allergen_match_terms를 읽을 수 있다(행 수 > 0)'
);

select cmp_ok(
  (select count(*) from public.disease_standards), '>', 0::bigint,
  'authenticated는 disease_standards를 읽을 수 있다(행 수 > 0)'
);

select lives_ok(
  $$ select count(*) from public.disease_rules $$,
  'authenticated는 disease_rules를 오류 없이 조회할 수 있다'
);

select throws_ok(
  $$ insert into public.public_food_products (report_number, normalized_name, display_name, normalized_payload)
     values ('X', 'x', 'x', '{}'::jsonb) $$,
  '42501',
  null,
  'authenticated는 public_food_products에 쓸 수 없다(service_role 전용)'
);

select throws_ok(
  $$ insert into public.public_api_snapshots (service_id, request_fingerprint, raw_payload)
     values ('mfds_nutrition', 'fp', '{}'::jsonb) $$,
  '42501',
  null,
  'authenticated는 public_api_snapshots에 쓸 수 없다(service_role 전용)'
);

-- ===================== B: A의 행이 보이지 않는다 =====================
select set_config('request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);

select is(
  (select count(*) from public.profiles)::bigint, 0::bigint,
  'B에게는 A의 profiles 행이 보이지 않는다'
);

select is(
  (select count(*) from public.user_allergens)::bigint, 0::bigint,
  'B에게는 A의 user_allergens 행이 보이지 않는다'
);

select is(
  (select count(*) from public.user_diseases)::bigint, 0::bigint,
  'B에게는 A의 user_diseases 행이 보이지 않는다'
);

select is(
  (select count(*) from public.analyses)::bigint, 0::bigint,
  'B에게는 A의 analyses 행이 보이지 않는다'
);

select is(
  (select count(*) from public.analysis_findings)::bigint, 0::bigint,
  'B에게는 A의 analysis_findings 행이 보이지 않는다'
);

-- B가 A 소유 행을 update 시도 -> 영향 0행 ------------------------------------

select is(
  (select count(*) from (
     update public.profiles set consent_version = 'hacked'
     where user_id = '11111111-1111-1111-1111-111111111111'
     returning 1
   ) t)::bigint, 0::bigint,
  'B는 A의 profiles 행을 update할 수 없다(0행 영향)'
);

select is(
  (select count(*) from (
     update public.user_allergens set created_at = now()
     where user_id = '11111111-1111-1111-1111-111111111111'
     returning 1
   ) t)::bigint, 0::bigint,
  'B는 A의 user_allergens 행을 update할 수 없다(0행 영향)'
);

select is(
  (select count(*) from (
     update public.user_diseases set note = 'hacked'
     where user_id = '11111111-1111-1111-1111-111111111111'
     returning 1
   ) t)::bigint, 0::bigint,
  'B는 A의 user_diseases 행을 update할 수 없다(0행 영향)'
);

select is(
  (select count(*) from (
     update public.analyses set status = 'caution'
     where user_id = '11111111-1111-1111-1111-111111111111'
     returning 1
   ) t)::bigint, 0::bigint,
  'B는 A의 analyses 행을 update할 수 없다(0행 영향, update 정책 자체가 없음)'
);

select is(
  (select count(*) from (
     update public.analysis_findings set title = 'hacked'
     where user_id = '11111111-1111-1111-1111-111111111111'
     returning 1
   ) t)::bigint, 0::bigint,
  'B는 A의 analysis_findings 행을 update할 수 없다(0행 영향, update 정책 자체가 없음)'
);

-- B가 A 소유 행을 delete 시도 -> 영향 0행 ------------------------------------

select is(
  (select count(*) from (
     delete from public.profiles
     where user_id = '11111111-1111-1111-1111-111111111111'
     returning 1
   ) t)::bigint, 0::bigint,
  'B는 A의 profiles 행을 delete할 수 없다(0행 영향)'
);

select is(
  (select count(*) from (
     delete from public.user_allergens
     where user_id = '11111111-1111-1111-1111-111111111111'
     returning 1
   ) t)::bigint, 0::bigint,
  'B는 A의 user_allergens 행을 delete할 수 없다(0행 영향)'
);

select is(
  (select count(*) from (
     delete from public.user_diseases
     where user_id = '11111111-1111-1111-1111-111111111111'
     returning 1
   ) t)::bigint, 0::bigint,
  'B는 A의 user_diseases 행을 delete할 수 없다(0행 영향)'
);

select is(
  (select count(*) from (
     delete from public.analyses
     where user_id = '11111111-1111-1111-1111-111111111111'
     returning 1
   ) t)::bigint, 0::bigint,
  'B는 A의 analyses 행을 delete할 수 없다(0행 영향)'
);

select is(
  (select count(*) from (
     delete from public.analysis_findings
     where user_id = '11111111-1111-1111-1111-111111111111'
     returning 1
   ) t)::bigint, 0::bigint,
  'B는 A의 analysis_findings 행을 delete할 수 없다(0행 영향)'
);

-- B가 user_id = A로 insert 시도 -> 거부 --------------------------------------

select throws_ok(
  $$ insert into public.profiles (user_id, consent_version, has_no_known_disease)
     values ('11111111-1111-1111-1111-111111111111', 'v1', true) $$,
  '42501',
  null,
  'B는 user_id를 A로 위장해 profiles에 insert할 수 없다'
);

select throws_ok(
  $$ insert into public.user_allergens (user_id, allergen_id)
     values ('11111111-1111-1111-1111-111111111111', 'FOOD-002') $$,
  '42501',
  null,
  'B는 user_id를 A로 위장해 user_allergens에 insert할 수 없다'
);

select throws_ok(
  $$ insert into public.user_diseases (user_id, disease_id)
     values ('11111111-1111-1111-1111-111111111111', 'DIS-003') $$,
  '42501',
  null,
  'B는 user_id를 A로 위장해 user_diseases에 insert할 수 없다'
);

select throws_ok(
  $$ insert into public.analyses
       (user_id, status, corrected_ocr_payload, profile_snapshot, rule_set_version, data_quality)
     values (
       '11111111-1111-1111-1111-111111111111',
       'no_flags', '{}'::jsonb, '{}'::jsonb, '2026-09-30.1', '{}'::jsonb
     ) $$,
  '42501',
  null,
  'B는 user_id를 A로 위장해 analyses에 insert할 수 없다'
);

select throws_ok(
  $$ insert into public.analysis_findings
       (analysis_id, user_id, category, severity, title, description, source)
     values (
       '33333333-3333-3333-3333-333333333333',
       '11111111-1111-1111-1111-111111111111',
       'data_quality', 'info', '제목', '설명', 'rule'
     ) $$,
  '42501',
  null,
  'B는 A 소유 analysis에 user_id를 A로 위장해 analysis_findings를 insert할 수 없다'
);

-- ===================== anon: 사용자 테이블은 보이지 않는다 =====================
set local role anon;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*) from public.profiles)::bigint, 0::bigint,
  'anon에게는 profiles가 보이지 않는다'
);

select is(
  (select count(*) from public.user_allergens)::bigint, 0::bigint,
  'anon에게는 user_allergens가 보이지 않는다'
);

select is(
  (select count(*) from public.user_diseases)::bigint, 0::bigint,
  'anon에게는 user_diseases가 보이지 않는다'
);

select is(
  (select count(*) from public.analyses)::bigint, 0::bigint,
  'anon에게는 analyses가 보이지 않는다'
);

select is(
  (select count(*) from public.analysis_findings)::bigint, 0::bigint,
  'anon에게는 analysis_findings가 보이지 않는다'
);

select * from finish();
rollback;
