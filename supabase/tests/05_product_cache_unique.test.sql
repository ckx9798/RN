-- report_number가 없는 공공 제품 캐시 행의 중복 삽입 방지
-- (마이그레이션 20260930000500_product_name_unique.sql, S3 리뷰 반영:
-- 동시 요청이 "조회 후 없으면 삽입"을 동시에 실행하면 report_number가
-- null인 같은 (정규화 이름, 정규화 제조사) 조합의 행이 중복 삽입될 수
-- 있었다. 애플리케이션 코드가 아니라 DB 유니크 인덱스로 막는다.)
begin;
select plan(2);

insert into public.public_food_products
  (report_number, normalized_name, display_name, normalized_payload)
values
  (null, '테스트과자', '테스트 과자', '{}'::jsonb);

select throws_ok(
  $$ insert into public.public_food_products
       (report_number, normalized_name, display_name, normalized_payload)
     values (null, '테스트과자', '테스트 과자(다른 표시명)', '{}'::jsonb) $$,
  '23505',
  null,
  'report_number가 null이고 제조사도 null인 같은 정규화 이름 조합은 중복 삽입이 거부된다'
);

insert into public.public_food_products
  (report_number, normalized_name, display_name, normalized_manufacturer, normalized_payload)
values
  (null, '테스트과자2', '테스트 과자2', '테스트제과', '{}'::jsonb);

select throws_ok(
  $$ insert into public.public_food_products
       (report_number, normalized_name, display_name, normalized_manufacturer, normalized_payload)
     values (null, '테스트과자2', '다른 표시명', '테스트제과', '{}'::jsonb) $$,
  '23505',
  null,
  'report_number가 null이고 (정규화 이름, 정규화 제조사)가 같은 행도 중복 삽입이 거부된다'
);

select * from finish();
rollback;
