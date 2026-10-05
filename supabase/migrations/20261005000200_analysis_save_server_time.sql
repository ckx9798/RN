-- 저장 시각은 호출자가 보낸 analyzedAt이 아니라 DB 시각(default now())을
-- 쓴다. RPC를 직접 호출해 이력 시각을 조작하지 못하게 한다.
create or replace function public.save_my_analysis(p_record jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_analysis_id uuid;
  v_result jsonb := p_record->'result';
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;
  if jsonb_typeof(v_result) is distinct from 'object'
    or jsonb_typeof(p_record->'scan') is distinct from 'object'
    or jsonb_typeof(p_record->'profile') is distinct from 'object'
    or jsonb_typeof(v_result->'findings') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'invalid_analysis_record';
  end if;

  -- user_id is never read from p_record: both tables default to auth.uid().
  insert into public.analyses (
    status, product_id, product_snapshot, corrected_ocr_payload,
    profile_snapshot, rule_set_version, data_quality
  ) values (
    v_result->>'status', (p_record->>'productId')::uuid,
    nullif(v_result->'product', 'null'::jsonb), p_record->'scan',
    p_record->'profile', v_result->>'ruleSetVersion', v_result->'dataQuality'
  ) returning id into v_analysis_id;

  insert into public.analysis_findings (
    analysis_id, category, severity, standard_id, title, description,
    matched_text, source, evidence_url, sort_order
  )
  select
    v_analysis_id, finding->>'category', finding->>'severity',
    finding->>'standardId', finding->>'title', finding->>'description',
    finding->>'matchedText', finding->>'source', finding->>'evidenceUrl',
    (ordinal - 1)::smallint
  from jsonb_array_elements(v_result->'findings') with ordinality as items(finding, ordinal);

  return v_analysis_id;
end;
$$;

revoke all on function public.save_my_analysis(jsonb) from public, anon;
grant execute on function public.save_my_analysis(jsonb) to authenticated;
