-- save_my_profile RPC: DIS-001(질환 없음) 배타 규칙과 프로필/알레르기/
-- 질환 저장 동작을 검증한다.
begin;
select plan(11);

insert into auth.users (id, email) values
  ('77777777-7777-7777-7777-777777777777', 'profile-a@example.test');

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '77777777-7777-7777-7777-777777777777', 'role', 'authenticated')::text,
  true);

select throws_ok(
  $$ select public.save_my_profile('v1', true, array[]::text[], '[{"diseaseId":"DIS-002"}]'::jsonb) $$,
  '22023',
  null,
  '질환 없음(true)과 다른 질환을 함께 저장하면 거부된다'
);

select throws_ok(
  $$ select public.save_my_profile('v1', false, array[]::text[], '[{"diseaseId":"DIS-001"}]'::jsonb) $$,
  '22023',
  null,
  'p_diseases에 DIS-001을 직접 넣으면 거부된다(has_no_known_disease로만 표현)'
);

select lives_ok(
  $$ select public.save_my_profile(
       'v1', false, array['FOOD-001','FOOD-002'],
       '[{"diseaseId":"DIS-002"},{"diseaseId":"DIS-028","note":"기타 메모"}]'::jsonb
     ) $$,
  '유효한 프로필 저장은 성공한다'
);

select is(
  (select consent_version from public.profiles where user_id = '77777777-7777-7777-7777-777777777777'),
  'v1',
  'profiles.consent_version이 저장된다'
);

select is(
  (select has_no_known_disease from public.profiles where user_id = '77777777-7777-7777-7777-777777777777'),
  false,
  'profiles.has_no_known_disease가 저장된다'
);

select is(
  (select count(*) from public.user_allergens where user_id = '77777777-7777-7777-7777-777777777777')::bigint,
  2::bigint,
  '선택한 알레르기 2건이 저장된다'
);

select is(
  (select note from public.user_diseases
     where user_id = '77777777-7777-7777-7777-777777777777' and disease_id = 'DIS-002'),
  null,
  'DIS-028이 아닌 질환의 note는 무시되고 null로 저장된다'
);

select is(
  (select note from public.user_diseases
     where user_id = '77777777-7777-7777-7777-777777777777' and disease_id = 'DIS-028'),
  '기타 메모',
  'DIS-028(기타)의 자유 메모는 그대로 저장된다'
);

select lives_ok(
  $$ select public.save_my_profile('v1', false, array['FOOD-003'], '[]'::jsonb) $$,
  '재호출 시 기존 선택을 교체할 수 있다'
);

select is(
  (select count(*) from public.user_allergens where user_id = '77777777-7777-7777-7777-777777777777')::bigint,
  1::bigint,
  '재호출 후 알레르기 선택이 새 값으로 교체된다(기존 값 삭제)'
);

select is(
  (select count(*) from public.user_allergens
     where user_id = '77777777-7777-7777-7777-777777777777' and allergen_id = 'FOOD-003')::bigint,
  1::bigint,
  '재호출 후 새 알레르기(FOOD-003)가 저장된다'
);

select * from finish();
rollback;
