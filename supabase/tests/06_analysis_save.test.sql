-- 분석과 findings는 한 트랜잭션으로 저장되고 JWT 사용자에게만 귀속된다.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('88888888-8888-8888-8888-888888888888', 'analysis-a@example.test'),
  ('99999999-9999-9999-9999-999999999999', 'analysis-b@example.test');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);

select lives_ok($test$
  select public.save_my_analysis('{
    "user_id":"99999999-9999-9999-9999-999999999999",
    "scan":{"ingredientsText":"밀가루"}, "profile":{"consentVersion":"v1"},
    "productId":null,
    "result":{
      "status":"caution","product":null,"ruleSetVersion":"2026-09-30.1",
      "dataQuality":{"missing":[]},"analyzedAt":"2026-10-05T00:00:00Z",
      "findings":[
        {"category":"allergen","severity":"caution","standardId":"FOOD-006",
         "title":"밀 포함","description":"표시 확인","matchedText":"밀가루","source":"label","evidenceUrl":null},
        {"category":"data_quality","severity":"needs_review","standardId":null,
         "title":"출처 확인","description":"정보 확인","matchedText":null,"source":"rule","evidenceUrl":null}
      ]
    }
  }'::jsonb)
$test$, '분석과 findings 저장 성공');

select is((select count(*) from public.analyses)::bigint, 1::bigint, '본인 분석 1건');
select is((select count(*) from public.analysis_findings)::bigint, 2::bigint, '본인 findings 2건');
select is((select title from public.analysis_findings where sort_order = 0), '밀 포함', '첫 finding 순서 보존');
select is((select corrected_ocr_payload->>'ingredientsText' from public.analyses), '밀가루', '교정 스냅샷 보존');

select throws_ok($test$
  select public.save_my_analysis('{
    "scan":{}, "profile":{}, "productId":null,
    "result":{
      "status":"caution","product":null,"ruleSetVersion":"v1","dataQuality":{},
      "analyzedAt":"2026-10-05T00:00:00Z",
      "findings":[{"category":"allergen","severity":"invalid","title":"제목","description":"설명","source":"label"}]
    }
  }'::jsonb)
$test$, '23514', null, 'findings 제약 위반은 저장 실패');
select is((select count(*) from public.analyses)::bigint, 1::bigint, '실패한 분석은 남지 않음');
select is((select count(*) from public.analysis_findings)::bigint, 2::bigint, '실패한 findings는 남지 않음');

select set_config('request.jwt.claims',
  '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}', true);
select is((select count(*) from public.analyses)::bigint, 0::bigint, '본문 user_id는 무시되고 B는 A 이력을 볼 수 없음');
reset role;
select ok(not has_function_privilege('anon', 'public.save_my_analysis(jsonb)', 'EXECUTE'), '익명 사용자 RPC 실행 권한 없음');

select * from finish();
rollback;
