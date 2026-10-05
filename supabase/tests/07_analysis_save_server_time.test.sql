-- 분석 저장 시각은 호출자가 보낸 analyzedAt이 아니라 DB 시각이다.
begin;
select plan(2);

insert into auth.users (id, email) values
  ('77777777-7777-7777-7777-777777777777', 'analysis-time@example.test');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);

select lives_ok($test$
  select public.save_my_analysis('{
    "scan":{"ingredientsText":"설탕"}, "profile":{"consentVersion":"v1"},
    "productId":null,
    "result":{
      "status":"needs_review","product":null,"ruleSetVersion":"2026-09-30.1",
      "dataQuality":{"missing":[]},"analyzedAt":"2000-01-01T00:00:00Z",
      "findings":[]
    }
  }'::jsonb)
$test$, '과거 analyzedAt으로도 저장은 성공');

select ok(
  (select created_at from public.analyses) > now() - interval '1 minute',
  '저장 시각은 analyzedAt이 아닌 DB 시각'
);

select * from finish();
rollback;
