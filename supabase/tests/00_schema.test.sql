begin;
select plan(12);

select has_table('public', t, t || ' exists') from unnest(array[
  'profiles','allergen_standards','allergen_match_terms','disease_standards','disease_rules',
  'user_allergens','user_diseases','public_food_products','public_api_snapshots',
  'analyses','analysis_findings']) as t;

select has_function('public', 'delete_my_account', 'delete_my_account exists');

select * from finish();
rollback;
