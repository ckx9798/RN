-- 회원 탈퇴 RPC: A의 개인 데이터만 삭제되고, B와 기준정보/공공 캐시는
-- 그대로 남는지 검증한다 (설계 14장).
begin;
select plan(12);

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'delete-a@example.test'),
  ('55555555-5555-5555-5555-555555555555', 'delete-b@example.test');

insert into public.public_food_products (report_number, normalized_name, display_name, normalized_payload)
values ('DEL-TEST-001', '삭제 테스트 제품', '삭제 테스트 제품', '{}'::jsonb);

-- ---- A: 데이터 생성 ----
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '44444444-4444-4444-4444-444444444444', 'role', 'authenticated')::text,
  true);

insert into public.profiles (user_id, consent_version, has_no_known_disease)
values ('44444444-4444-4444-4444-444444444444', 'v1', true);

insert into public.user_allergens (user_id, allergen_id)
values ('44444444-4444-4444-4444-444444444444', 'FOOD-001');

insert into public.user_diseases (user_id, disease_id, note)
values ('44444444-4444-4444-4444-444444444444', 'DIS-002', null);

insert into public.analyses
  (id, user_id, status, corrected_ocr_payload, profile_snapshot, rule_set_version, data_quality)
values (
  '66666666-6666-6666-6666-666666666666',
  '44444444-4444-4444-4444-444444444444',
  'no_flags', '{}'::jsonb, '{}'::jsonb, '2026-09-30.1', '{}'::jsonb
);

insert into public.analysis_findings
  (analysis_id, user_id, category, severity, title, description, source)
values (
  '66666666-6666-6666-6666-666666666666',
  '44444444-4444-4444-4444-444444444444',
  'data_quality', 'info', '제목', '설명', 'rule'
);

-- ---- B: 데이터 생성 (탈퇴 이후에도 남아야 한다) ----
select set_config('request.jwt.claims',
  json_build_object('sub', '55555555-5555-5555-5555-555555555555', 'role', 'authenticated')::text,
  true);

insert into public.profiles (user_id, consent_version, has_no_known_disease)
values ('55555555-5555-5555-5555-555555555555', 'v1', true);

insert into public.user_allergens (user_id, allergen_id)
values ('55555555-5555-5555-5555-555555555555', 'FOOD-002');

insert into public.user_diseases (user_id, disease_id, note)
values ('55555555-5555-5555-5555-555555555555', 'DIS-003', null);

-- ---- A: 탈퇴 ----
select set_config('request.jwt.claims',
  json_build_object('sub', '44444444-4444-4444-4444-444444444444', 'role', 'authenticated')::text,
  true);

select lives_ok(
  $$ select public.delete_my_account() $$,
  'A는 delete_my_account()를 오류 없이 호출할 수 있다'
);

-- ---- 검증: RLS를 우회하는 세션 소유자 권한으로 확인 ----
reset role;

select is(
  (select count(*) from auth.users where id = '44444444-4444-4444-4444-444444444444')::bigint, 0::bigint,
  'auth.users에서 A가 삭제되었다'
);

select is(
  (select count(*) from public.profiles where user_id = '44444444-4444-4444-4444-444444444444')::bigint, 0::bigint,
  'profiles에서 A 행이 삭제되었다'
);

select is(
  (select count(*) from public.user_allergens where user_id = '44444444-4444-4444-4444-444444444444')::bigint, 0::bigint,
  'user_allergens에서 A 행이 삭제되었다'
);

select is(
  (select count(*) from public.user_diseases where user_id = '44444444-4444-4444-4444-444444444444')::bigint, 0::bigint,
  'user_diseases에서 A 행이 삭제되었다'
);

select is(
  (select count(*) from public.analyses where user_id = '44444444-4444-4444-4444-444444444444')::bigint, 0::bigint,
  'analyses에서 A 행이 삭제되었다'
);

select is(
  (select count(*) from public.analysis_findings where user_id = '44444444-4444-4444-4444-444444444444')::bigint, 0::bigint,
  'analysis_findings에서 A 행이 삭제되었다'
);

select is(
  (select count(*) from public.profiles where user_id = '55555555-5555-5555-5555-555555555555')::bigint, 1::bigint,
  'B의 profiles 행은 유지된다'
);

select is(
  (select count(*) from public.user_allergens where user_id = '55555555-5555-5555-5555-555555555555')::bigint, 1::bigint,
  'B의 user_allergens 행은 유지된다'
);

select is(
  (select count(*) from public.user_diseases where user_id = '55555555-5555-5555-5555-555555555555')::bigint, 1::bigint,
  'B의 user_diseases 행은 유지된다'
);

select cmp_ok(
  (select count(*) from public.allergen_standards), '>', 0::bigint,
  '기준정보(allergen_standards)는 탈퇴와 무관하게 유지된다'
);

select is(
  (select count(*) from public.public_food_products where report_number = 'DEL-TEST-001')::bigint, 1::bigint,
  '공공 데이터 캐시(public_food_products)는 탈퇴와 무관하게 유지된다'
);

select * from finish();
rollback;
