-- report_number가 없는 공공 제품 캐시 행의 중복 삽입을 DB 레벨에서 막는다.
--
-- public_food_products.report_number는 nullable unique 컬럼이라 report_number가
-- 있는 행끼리는 이미 유일성이 보장된다. 하지만 report_number가 없는 행(품목
-- 보고번호가 없는 공공 API 레코드를 (정규화 이름, 정규화 제조사) 조합으로
-- 캐시할 때)은 아무 제약이 없어, 동시 요청이 "기존 행 조회 → 없으면 삽입"을
-- 동시에 수행하면 같은 조합의 행이 중복 삽입될 수 있었다(S3 리뷰 지적).
--
-- report_number is null인 행에 한해 (normalized_name, coalesce(normalized_manufacturer, ''))
-- 조합의 부분 유니크 인덱스를 추가해, 애플리케이션 코드가 아니라 DB가
-- 동시성을 보장하게 한다. coalesce로 manufacturer가 null인 행끼리도 유일성이
-- 적용되게 한다(postgres unique 인덱스는 null을 서로 다른 값으로 취급해
-- null끼리는 중복을 허용하므로, coalesce로 고정값을 넣어야 한다).
create unique index public_food_products_null_report_number_name_manufacturer
  on public.public_food_products (normalized_name, coalesce(normalized_manufacturer, ''))
  where report_number is null;
