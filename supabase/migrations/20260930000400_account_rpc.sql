-- 계정 RPC: 탈퇴 삭제, 개인화 프로필 저장 (설계 9.3, 14장)

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
