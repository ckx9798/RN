-- 기준정보 시드 검증 (설계 9.1, 9.2)
begin;
select plan(7);

select is(
  (select count(*) from public.allergen_standards)::bigint, 19::bigint,
  'allergen_standards는 19행이다'
);

select is(
  (select array_agg(id order by id) from public.allergen_standards),
  (select array_agg('FOOD-' || lpad(n::text, 3, '0')) from generate_series(1, 19) n),
  'allergen_standards의 id는 FOOD-001..FOOD-019로 연속한다'
);

select is(
  (select count(*) from public.allergen_standards a
     where not exists (
       select 1 from public.allergen_match_terms m
       where m.allergen_id = a.id and m.term = a.name
     ))::bigint, 0::bigint,
  '모든 allergen_standards 기준에 term = name인 match term이 있다'
);

select is(
  (select count(*) from public.disease_standards)::bigint, 28::bigint,
  'disease_standards는 28행이다'
);

select is(
  (select array_agg(id order by id) from public.disease_standards),
  (select array_agg('DIS-' || lpad(n::text, 3, '0')) from generate_series(1, 28) n),
  'disease_standards의 id는 DIS-001..DIS-028로 연속한다'
);

select throws_ok(
  $$ insert into public.disease_rules
       (disease_id, target_type, target_key, operator, unit, severity, message, rule_version, active)
     values ('DIS-002', 'nutrient', 'sodium', 'gt', 'mg', 'caution', '나트륨 과다', 'v1', true) $$,
  '23514',
  null,
  'active=true인데 threshold/evidence_url/reviewed_at이 없으면 체크 제약 위반으로 거부된다'
);

select is(
  (select analysis_support from public.disease_standards where id = 'DIS-001'),
  'exclusive',
  'DIS-001(질환 없음)의 analysis_support는 exclusive이다'
);

select * from finish();
rollback;
