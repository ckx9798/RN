-- 기준정보 시드 (설계 9.1 알레르기 19종, 9.2 질환 28종)
--
-- allergen_match_terms.priority는 설계 10.2 매칭 순서(공식 표시 문구 >
-- 직접 함유 문맥 > 정확 원재료 토큰/확정 별칭 > 복합원재료 내부 별칭 >
-- 교차혼입 > 간접 별칭)를 반영해 값이 작을수록 먼저 검사하도록 부여한다.
--   label_context/confirmed = 10 (공식 표시 문구 문맥에서만 확정)
--   exact_token/confirmed   = 20 (독립 토큰으로 확정)
--   phrase/confirmed        = 30 (복합어로 확정)
--   exact_token/possible    = 90 (간접 별칭, 확인 필요로 처리될 수 있음)
-- 이 값은 설계에 명시되지 않아 이번 작업에서 정한 결정이며, 실제 회귀
-- 데이터가 쌓이면 조정한다(설계 10.2).
--
-- [S2 리뷰 수정] "난백분", "유청분말", "계란흰자", "새우젓", "대두유"처럼
-- 표에 없는 파생 표기를 표 밖 용어 추가 없이 잡기 위해, 2글자 이상이고
-- 부분 문자열로 써도 다른 기준과 혼동되지 않는 표 9.1 용어의 match_type을
-- exact_token에서 phrase로 바꿨다(우선순위도 20->30). 1글자 용어(게, 밀,
-- 콩, 잣, 굴)와 버터·크림·간장·된장·두부·유당·영문 별칭은 예외로 남긴다
-- — 부분 문자열 오탐 위험(예: "버터"를 phrase로 바꾸면 무관한 복합어에서
-- 오탐할 여지, "굴"은 1글자라 처음부터 예외)과 짧은 토큰 오탐 방지라는
-- 설계 10.2 원칙을 지키기 위해서다. "굴소스"는 여전히 잡히지 않는
-- 알려진 공백이며 표 밖 용어를 추가하지 않기로 한 결정에 따라
-- 의도적으로 남겨둔다(task-S2-report.md 참고).

insert into public.allergen_standards (id, name, source_url, source_version) values
  ('FOOD-001', '알류', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-002', '우유', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-003', '메밀', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-004', '땅콩', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-005', '대두', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-006', '밀', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-007', '잣', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-008', '호두', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-009', '게', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-010', '새우', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-011', '오징어', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-012', '고등어', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-013', '조개류', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-014', '복숭아', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-015', '토마토', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-016', '닭고기', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-017', '돼지고기', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-018', '쇠고기', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026'),
  ('FOOD-019', '아황산류', 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412', '식품등의 표시기준 2026');

insert into public.allergen_match_terms (allergen_id, term, match_type, confidence, priority) values
  ('FOOD-001', '알류', 'label_context', 'confirmed', 10),
  ('FOOD-001', '계란', 'phrase', 'confirmed', 30),
  ('FOOD-001', '달걀', 'phrase', 'confirmed', 30),
  ('FOOD-001', '난백', 'phrase', 'confirmed', 30),
  ('FOOD-001', '난황', 'phrase', 'confirmed', 30),
  ('FOOD-001', '전란', 'phrase', 'confirmed', 30),
  ('FOOD-001', '난분', 'exact_token', 'confirmed', 20),
  ('FOOD-001', '메추리알', 'phrase', 'confirmed', 30),
  ('FOOD-002', '우유', 'phrase', 'confirmed', 30),
  ('FOOD-002', '유청', 'phrase', 'confirmed', 30),
  ('FOOD-002', '탈지분유', 'phrase', 'confirmed', 30),
  ('FOOD-002', '전지분유', 'phrase', 'confirmed', 30),
  ('FOOD-002', '카제인', 'phrase', 'confirmed', 30),
  ('FOOD-002', '유당', 'exact_token', 'possible', 90),
  ('FOOD-002', '버터', 'exact_token', 'confirmed', 20),
  ('FOOD-002', '크림', 'exact_token', 'possible', 90),
  ('FOOD-002', '치즈', 'phrase', 'confirmed', 30),
  ('FOOD-003', '메밀', 'phrase', 'confirmed', 30),
  ('FOOD-003', '메밀가루', 'phrase', 'confirmed', 30),
  ('FOOD-003', '메밀분', 'phrase', 'confirmed', 30),
  ('FOOD-003', '메밀전분', 'phrase', 'confirmed', 30),
  ('FOOD-004', '땅콩', 'phrase', 'confirmed', 30),
  ('FOOD-004', '낙화생', 'phrase', 'confirmed', 30),
  ('FOOD-004', '땅콩버터', 'phrase', 'confirmed', 30),
  ('FOOD-004', '땅콩분말', 'phrase', 'confirmed', 30),
  ('FOOD-005', '대두', 'phrase', 'confirmed', 30),
  ('FOOD-005', '콩', 'exact_token', 'confirmed', 20),
  ('FOOD-005', '두유', 'phrase', 'confirmed', 30),
  ('FOOD-005', '두부', 'exact_token', 'confirmed', 20),
  ('FOOD-005', '된장', 'exact_token', 'possible', 90),
  ('FOOD-005', '간장', 'exact_token', 'possible', 90),
  ('FOOD-005', '대두단백', 'phrase', 'confirmed', 30),
  ('FOOD-005', '대두레시틴', 'phrase', 'confirmed', 30),
  ('FOOD-006', '밀', 'exact_token', 'confirmed', 20),
  ('FOOD-006', '밀가루', 'phrase', 'confirmed', 30),
  ('FOOD-006', '소맥', 'phrase', 'confirmed', 30),
  ('FOOD-006', '소맥분', 'phrase', 'confirmed', 30),
  ('FOOD-006', '밀단백', 'phrase', 'confirmed', 30),
  ('FOOD-006', '글루텐', 'phrase', 'confirmed', 30),
  ('FOOD-007', '잣', 'exact_token', 'confirmed', 20),
  ('FOOD-007', '잣가루', 'phrase', 'confirmed', 30),
  ('FOOD-007', '잣분말', 'phrase', 'confirmed', 30),
  ('FOOD-008', '호두', 'phrase', 'confirmed', 30),
  ('FOOD-008', '호두분말', 'phrase', 'confirmed', 30),
  ('FOOD-009', '게', 'exact_token', 'confirmed', 20),
  ('FOOD-009', '게살', 'phrase', 'confirmed', 30),
  ('FOOD-009', '게추출물', 'phrase', 'confirmed', 30),
  ('FOOD-009', '꽃게', 'phrase', 'confirmed', 30),
  ('FOOD-009', '대게', 'phrase', 'confirmed', 30),
  ('FOOD-009', 'crab', 'exact_token', 'confirmed', 20),
  ('FOOD-010', '새우', 'phrase', 'confirmed', 30),
  ('FOOD-010', '새우살', 'phrase', 'confirmed', 30),
  ('FOOD-010', '새우분말', 'phrase', 'confirmed', 30),
  ('FOOD-010', '새우추출물', 'phrase', 'confirmed', 30),
  ('FOOD-010', 'shrimp', 'exact_token', 'confirmed', 20),
  ('FOOD-010', 'prawn', 'exact_token', 'confirmed', 20),
  ('FOOD-011', '오징어', 'phrase', 'confirmed', 30),
  ('FOOD-011', '오징어분말', 'phrase', 'confirmed', 30),
  ('FOOD-011', '오징어추출물', 'phrase', 'confirmed', 30),
  ('FOOD-011', 'squid', 'exact_token', 'confirmed', 20),
  ('FOOD-012', '고등어', 'phrase', 'confirmed', 30),
  ('FOOD-012', '고등어살', 'phrase', 'confirmed', 30),
  ('FOOD-012', '고등어추출물', 'phrase', 'confirmed', 30),
  ('FOOD-012', 'mackerel', 'exact_token', 'confirmed', 20),
  ('FOOD-013', '조개류', 'label_context', 'confirmed', 10),
  ('FOOD-013', '굴', 'exact_token', 'confirmed', 20),
  ('FOOD-013', '전복', 'phrase', 'confirmed', 30),
  ('FOOD-013', '홍합', 'phrase', 'confirmed', 30),
  ('FOOD-013', '바지락', 'phrase', 'confirmed', 30),
  ('FOOD-013', '가리비', 'phrase', 'confirmed', 30),
  ('FOOD-013', 'oyster', 'exact_token', 'confirmed', 20),
  ('FOOD-013', 'abalone', 'exact_token', 'confirmed', 20),
  ('FOOD-013', 'mussel', 'exact_token', 'confirmed', 20),
  ('FOOD-013', 'clam', 'exact_token', 'confirmed', 20),
  ('FOOD-013', 'scallop', 'exact_token', 'confirmed', 20),
  ('FOOD-014', '복숭아', 'phrase', 'confirmed', 30),
  ('FOOD-014', '복숭아농축액', 'phrase', 'confirmed', 30),
  ('FOOD-014', '복숭아퓨레', 'phrase', 'confirmed', 30),
  ('FOOD-014', 'peach', 'exact_token', 'confirmed', 20),
  ('FOOD-015', '토마토', 'phrase', 'confirmed', 30),
  ('FOOD-015', '토마토페이스트', 'phrase', 'confirmed', 30),
  ('FOOD-015', '토마토퓨레', 'phrase', 'confirmed', 30),
  ('FOOD-015', '토마토농축액', 'phrase', 'confirmed', 30),
  ('FOOD-015', 'tomato', 'exact_token', 'confirmed', 20),
  ('FOOD-016', '닭고기', 'phrase', 'confirmed', 30),
  ('FOOD-016', '닭육', 'phrase', 'confirmed', 30),
  ('FOOD-016', '닭고기분말', 'phrase', 'confirmed', 30),
  ('FOOD-016', '닭고기추출물', 'phrase', 'confirmed', 30),
  ('FOOD-016', 'chicken', 'exact_token', 'confirmed', 20),
  ('FOOD-017', '돼지고기', 'phrase', 'confirmed', 30),
  ('FOOD-017', '돼지육', 'phrase', 'confirmed', 30),
  ('FOOD-017', '돈육', 'phrase', 'confirmed', 30),
  ('FOOD-017', '돼지고기분말', 'phrase', 'confirmed', 30),
  ('FOOD-017', 'pork', 'exact_token', 'confirmed', 20),
  ('FOOD-018', '쇠고기', 'phrase', 'confirmed', 30),
  ('FOOD-018', '소고기', 'phrase', 'confirmed', 30),
  ('FOOD-018', '우육', 'phrase', 'confirmed', 30),
  ('FOOD-018', '쇠고기분말', 'phrase', 'confirmed', 30),
  ('FOOD-018', 'beef', 'exact_token', 'confirmed', 20),
  ('FOOD-019', '아황산류', 'label_context', 'confirmed', 10),
  ('FOOD-019', '아황산염', 'phrase', 'confirmed', 30),
  ('FOOD-019', '이산화황', 'phrase', 'confirmed', 30),
  ('FOOD-019', '아황산나트륨', 'phrase', 'confirmed', 30),
  ('FOOD-019', '메타중아황산나트륨', 'phrase', 'confirmed', 30),
  ('FOOD-019', '메타중아황산칼륨', 'phrase', 'confirmed', 30),
  ('FOOD-019', 'sulfite', 'exact_token', 'confirmed', 20),
  ('FOOD-019', 'sulfur dioxide', 'phrase', 'confirmed', 30);

-- 질환 기준 (설계 9.2). classification_version은 모든 행에서 동일하게
-- "원문 대조 필요"로 표기해, 구현 시 실제 KCD-9 시행본과의 대조가 아직
-- 끝나지 않았음을 값 자체로 드러낸다.
insert into public.disease_standards (id, category, name, source_codes, classification_version, analysis_support, related_nutrients) values
  ('DIS-001', '선택 상태', '질환 없음', null, 'KCD-9 (2026 시행, 원문 대조 필요)', 'exclusive', '{}'),
  ('DIS-002', '심혈관계', '고혈압', 'I10-I15', 'KCD-9 (2026 시행, 원문 대조 필요)', 'nutrition_candidate', '{sodium}'),
  ('DIS-003', '내분비·대사', '당뇨병', 'E10-E14', 'KCD-9 (2026 시행, 원문 대조 필요)', 'nutrition_candidate', '{carbohydrate,sugars}'),
  ('DIS-004', '내분비·대사', '고지혈증', 'E78', 'KCD-9 (2026 시행, 원문 대조 필요)', 'nutrition_candidate', '{saturated_fat,cholesterol}'),
  ('DIS-005', '내분비·대사', '갑상선 질환', 'E03-E07', 'KCD-9 (2026 시행, 원문 대조 필요)', 'limited', '{}'),
  ('DIS-006', '알레르기·호흡기', '알레르기 비염', 'J30', 'KCD-9 (2026 시행, 원문 대조 필요)', 'unsupported', '{}'),
  ('DIS-007', '알레르기·호흡기', '천식', 'J45-J46', 'KCD-9 (2026 시행, 원문 대조 필요)', 'unsupported', '{}'),
  ('DIS-008', '정신건강', '우울증', 'F32-F33', 'KCD-9 (2026 시행, 원문 대조 필요)', 'unsupported', '{}'),
  ('DIS-009', '정신건강', '불안장애', 'F40-F41', 'KCD-9 (2026 시행, 원문 대조 필요)', 'unsupported', '{}'),
  ('DIS-010', '류마티스·근골격계', '골다공증', 'M81-M82', 'KCD-9 (2026 시행, 원문 대조 필요)', 'nutrition_candidate', '{calcium}'),
  ('DIS-011', '심혈관계', '협심증·심근경색', 'I20-I25', 'KCD-9 (2026 시행, 원문 대조 필요)', 'nutrition_candidate', '{sodium}'),
  ('DIS-012', '심혈관계', '심장 부정맥', 'I47-I49', 'KCD-9 (2026 시행, 원문 대조 필요)', 'limited', '{sodium}'),
  ('DIS-013', '심혈관계', '심부전', 'I50', 'KCD-9 (2026 시행, 원문 대조 필요)', 'limited', '{sodium}'),
  ('DIS-014', '심혈관계', '뇌졸중·뇌경색', 'I63-I64', 'KCD-9 (2026 시행, 원문 대조 필요)', 'limited', '{sodium}'),
  ('DIS-015', '심혈관계', '혈전·색전 질환', 'I74, I80-I82', 'KCD-9 (2026 시행, 원문 대조 필요)', 'unsupported', '{}'),
  ('DIS-016', '신장', '신장질환·신부전', 'N17-N19', 'KCD-9 (2026 시행, 원문 대조 필요)', 'limited', '{sodium,protein,potassium,phosphorus}'),
  ('DIS-017', '소화기·간', '만성 간질환', 'K73-K75', 'KCD-9 (2026 시행, 원문 대조 필요)', 'limited', '{}'),
  ('DIS-018', '알레르기·피부', '아토피 피부염', 'L20', 'KCD-9 (2026 시행, 원문 대조 필요)', 'unsupported', '{}'),
  ('DIS-019', '류마티스·근골격계', '류마티스 관절염', 'M05-M06', 'KCD-9 (2026 시행, 원문 대조 필요)', 'unsupported', '{}'),
  ('DIS-020', '신경계', '파킨슨병', 'G20', 'KCD-9 (2026 시행, 원문 대조 필요)', 'unsupported', '{}'),
  ('DIS-021', '신경계', '뇌전증', 'G40-G41', 'KCD-9 (2026 시행, 원문 대조 필요)', 'unsupported', '{}'),
  ('DIS-022', '신경계', '치매', 'F00-F03', 'KCD-9 (2026 시행, 원문 대조 필요)', 'unsupported', '{}'),
  ('DIS-023', '정신건강', '조현병', 'F20', 'KCD-9 (2026 시행, 원문 대조 필요)', 'unsupported', '{}'),
  ('DIS-024', '암·면역', '암 치료 중', 'C00-C97', 'KCD-9 (2026 시행, 원문 대조 필요)', 'unsupported', '{}'),
  ('DIS-025', '암·면역', '면역저하·면역결핍', 'D80-D84', 'KCD-9 (2026 시행, 원문 대조 필요)', 'unsupported', '{}'),
  ('DIS-026', '내분비·대사', '임신성 당뇨병', 'O24', 'KCD-9 (2026 시행, 원문 대조 필요)', 'nutrition_candidate', '{carbohydrate,sugars}'),
  ('DIS-027', '심혈관계', '임신 중 고혈압 질환', 'O10-O16', 'KCD-9 (2026 시행, 원문 대조 필요)', 'nutrition_candidate', '{sodium}'),
  ('DIS-028', '선택 상태', '기타', null, 'KCD-9 (2026 시행, 원문 대조 필요)', 'memo_only', '{}');

-- disease_rules는 이번 시드에 포함하지 않는다. 11.1: "임계값을 임의로
-- 만들지 않는다"와 "근거 없는 규칙은 active = false"를 지키려면 실제
-- 공식 근거(evidence_url)와 검수(reviewed_at)를 확보한 뒤 별도 마이그레이션
-- 또는 운영 절차로 추가해야 한다. 지금 채울 수 있는 근거 있는 수치가
-- 없으므로 빈 상태로 둔다(제약 조건 자체는 03_reference_data.test.sql에서 검증).
