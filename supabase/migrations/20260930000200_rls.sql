-- Row Level Security (설계 9.3, 14장)
--
-- 사용자 소유 테이블(profiles, user_allergens, user_diseases, analyses,
-- analysis_findings)은 본인만 읽고 쓸 수 있다. analyses/analysis_findings는
-- 과거 분석 결과가 사후에 바뀌지 않도록 update 정책을 두지 않는다(불변).
-- 기준정보 4개 테이블은 authenticated에게 읽기만 허용한다. 공공 데이터
-- 캐시(public_food_products, public_api_snapshots)는 authenticated 읽기만
-- 허용하고 쓰기 정책은 두지 않는다 — service_role은 RLS를 우회하므로
-- Edge Function의 캐시 갱신 로직만 쓸 수 있다.

alter table public.profiles enable row level security;
alter table public.user_allergens enable row level security;
alter table public.user_diseases enable row level security;
alter table public.analyses enable row level security;
alter table public.analysis_findings enable row level security;
alter table public.allergen_standards enable row level security;
alter table public.allergen_match_terms enable row level security;
alter table public.disease_standards enable row level security;
alter table public.disease_rules enable row level security;
alter table public.public_food_products enable row level security;
alter table public.public_api_snapshots enable row level security;

-- anon은 사용자 소유 테이블에 쓰기 권한이 전혀 없다(로그인 사용자만 쓸 수
-- 있다). SELECT 권한은 일부러 남겨둔다 — Supabase는 새 테이블에 기본으로
-- anon/authenticated에 전체 권한을 부여하고, 아래 정책은 모두 `to
-- authenticated`로만 만들어져 있어 anon은 어떤 정책에도 해당하지 않는다.
-- 그 결과 anon의 SELECT는 오류 없이 항상 0행을 반환한다(테이블 자체가
-- 있다는 사실도 노출하지 않는 것보다, "조회는 되지만 아무 것도 보이지
-- 않는다"는 RLS의 표준 동작을 그대로 쓰는 쪽을 택했다). 반면 INSERT/
-- UPDATE/DELETE는 실수로라도 허용되지 않도록 권한 자체를 제거한다.
revoke insert, update, delete on public.profiles from anon;
revoke insert, update, delete on public.user_allergens from anon;
revoke insert, update, delete on public.user_diseases from anon;
revoke insert, update, delete on public.analyses from anon;
revoke insert, update, delete on public.analysis_findings from anon;

-- profiles ----------------------------------------------------------------

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "profiles_delete_own" on public.profiles
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- user_allergens ------------------------------------------------------------

create policy "user_allergens_select_own" on public.user_allergens
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_allergens_insert_own" on public.user_allergens
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_allergens_update_own" on public.user_allergens
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_allergens_delete_own" on public.user_allergens
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- user_diseases -------------------------------------------------------------

create policy "user_diseases_select_own" on public.user_diseases
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_diseases_insert_own" on public.user_diseases
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_diseases_update_own" on public.user_diseases
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_diseases_delete_own" on public.user_diseases
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- analyses (update 정책 없음 — 과거 결과 불변) --------------------------------

create policy "analyses_select_own" on public.analyses
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "analyses_insert_own" on public.analyses
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "analyses_delete_own" on public.analyses
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- analysis_findings (update 정책 없음 — 과거 결과 불변) ------------------------

create policy "analysis_findings_select_own" on public.analysis_findings
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "analysis_findings_insert_own" on public.analysis_findings
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.analyses a
      where a.id = analysis_id and a.user_id = (select auth.uid())
    )
  );

create policy "analysis_findings_delete_own" on public.analysis_findings
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 기준정보 (읽기 전용, authenticated) ------------------------------------------

create policy "allergen_standards_select_authenticated" on public.allergen_standards
  for select to authenticated
  using (true);

create policy "allergen_match_terms_select_authenticated" on public.allergen_match_terms
  for select to authenticated
  using (true);

create policy "disease_standards_select_authenticated" on public.disease_standards
  for select to authenticated
  using (true);

create policy "disease_rules_select_authenticated" on public.disease_rules
  for select to authenticated
  using (true);

-- 공공 데이터 캐시 (읽기 전용, authenticated; 쓰기는 service_role만) -------------

create policy "public_food_products_select_authenticated" on public.public_food_products
  for select to authenticated
  using (true);

create policy "public_api_snapshots_select_authenticated" on public.public_api_snapshots
  for select to authenticated
  using (true);

-- updated_at 트리거 (profiles) -----------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();
