# 하이브리드 식품 개인화 분석 MVP 설계

작성일: 2026-09-30  
상태: 사용자 설계 승인, 구현 계획 작성 전  
대상: iOS·Android Expo SDK 57 앱, WebView 웹 앱, Supabase 백엔드

## 1. 배경

현재 저장소는 Expo SDK 57, React Native 0.86 기반 초기 템플릿이다. 제품의
핵심 가치는 사용자가 가공식품 라벨을 촬영하면 기기에서 텍스트를 추출하고,
식약처·식품안전나라 공공 데이터와 사용자의 알레르기·질환 설정을 조합해
주의할 정보를 보여주는 것이다.

앱은 하이브리드 방식으로 구성한다. 이미지 촬영과 OCR만 네이티브에서
처리하고, 인증·개인화 설정·제품 분석·결과·이력은 WebView에 표시되는 웹
앱이 담당한다. 원본 이미지는 WebView나 서버로 보내지 않는다.

이 서비스는 의료 진단, 치료, 처방 또는 섭취 허가를 제공하지 않는다.
공공 데이터나 OCR에서 주의 항목이 발견되지 않았다는 사실도 식품의 안전을
보장하지 않는다.

## 2. 목표와 성공 기준

### 목표

- 이메일 OTP로 로그인하고 알레르기와 질환 정보를 등록한다.
- 가공식품 라벨을 최대 두 번 촬영해 제품명, 제조사, 품목보고번호,
  원재료명, 알레르기 표시 및 교차혼입 문구를 추출한다.
- 원본 이미지를 기기 밖으로 보내지 않고 텍스트만 서버에 전달한다.
- 서버가 공공 API에서 제품·영양·원재료 데이터를 조회하고 정규화한다.
- 사용자 프로필과 버전이 있는 규칙을 적용해 `주의`, `확인 필요`,
  `특이사항 없음` 중 하나를 표시한다.
- 결과에 판정 근거, 데이터 출처, 데이터 부족 사유를 함께 제공한다.

### 성공 기준

- 검증용 알레르기 데이터셋에서 등록 알레르기 미탐이 0건이다.
- 데이터가 불완전하면 `특이사항 없음`을 표시하지 않는다.
- 사용자에게 `안심`, `안전`, `섭취 적합`이라는 단정적 문구를 표시하지
  않는다.
- 네트워크 요청, 서버 로그, WebView 메시지에 이미지나 이미지 Base64가
  포함되지 않는다.
- 사용자는 다른 사용자의 프로필과 분석 이력에 접근할 수 없다.
- iOS·Android 개발 빌드에서 로그인부터 분석 결과까지의 전체 흐름이
  동작한다.

## 3. 범위

### MVP 포함

- 대한민국에서 판매되는 일반 가공식품
- 이메일 6자리 OTP 인증
- 식약처 표시대상 알레르기 19종
- 질환 선택 및 지원 가능한 질환의 관련 영양정보
- 온디바이스 한글 OCR
- 식품영양성분 DB 및 품목제조보고 원재료 API
- 분석 결과와 이력
- 사용자 데이터 삭제

### MVP 제외

- 건강기능식품
- 복용약과 식품의 상호작용
- 질환 진단·치료 또는 개인별 섭취 허가
- 실시간 카메라 프레임 OCR
- 바코드를 주 식별 수단으로 사용하는 흐름
- 서버 이미지 업로드·보관
- 완전 오프라인 분석
- 푸시 알림과 운영자용 관리 화면
- 앱스토어 제출, EAS 배포 실행 및 웹 호스팅 업체 선정

웹 런타임은 배포 가능한 Next.js 환경을 전제로 하되 호스팅 업체별 설정은
별도 배포 설계에서 정한다. 백엔드는 호스팅형 Supabase를 사용한다.

## 4. 시스템 아키텍처

### 4.1 책임 경계

#### Expo 네이티브 앱

- WebView 셸과 네이티브 라우팅
- 카메라 권한과 촬영
- 이미지 크롭·리사이즈 등 기기 내 전처리
- Google ML Kit 기반 온디바이스 한글 OCR
- OCR 결과 확인·수정 UI
- 버전이 있는 WebView 브리지
- OCR 종료 후 임시 이미지 삭제

네이티브 앱은 로그인 토큰, 사용자 프로필, 공공 API 키를 직접 관리하지
않는다.

#### Next.js 웹 앱

- 이메일 OTP 로그인과 세션 유지
- 알레르기·질환 설정
- 스캔 시작 이벤트 전송
- OCR 텍스트 수신
- 인증된 분석 요청
- 제품 후보 선택
- 결과와 이력 표시
- 로그아웃과 회원 탈퇴

#### Supabase

- Auth: 이메일 OTP 계정과 세션
- Postgres: 기준정보, 사용자 설정, 공공 데이터 캐시, 분석 이력
- RLS: 사용자별 데이터 격리
- Edge Functions: 공공 API 프록시, 제품 매칭, 규칙 실행
- Secrets: 식약처 API 키와 서버 비밀값

### 4.2 요청 흐름

```text
앱 실행
  -> WebView에서 웹 앱 로드
  -> 이메일 OTP 로그인 또는 기존 세션 복원
  -> 웹 앱이 SCAN_REQUEST 전송
  -> 네이티브 촬영·전처리·OCR
  -> 사용자가 OCR 필드 확인·수정
  -> 네이티브가 SCAN_RESULT 텍스트 JSON 전송
  -> 웹 앱이 현재 로그인 세션으로 analyze-food 호출
  -> 제품 후보 검색 및 필요 시 사용자 선택
  -> 공공 데이터 결합
  -> 알레르기·질환 규칙 실행
  -> 결과·근거·데이터 품질 저장
  -> WebView에 결과 표시
```

### 4.3 저장소 구조

현재 Expo 앱은 저장소 루트에 유지한다. MVP에서 npm workspace 전환이나
`apps/mobile` 이동은 하지 않는다. 웹 앱은 자체 `package.json`과
`package-lock.json`을 갖는 독립 하위 프로젝트로 둔다.

```text
RN/
├── src/
│   ├── app/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   └── scanner.tsx
│   ├── components/
│   │   ├── app-web-view.tsx
│   │   ├── scanner-camera.tsx
│   │   └── scanner-review.tsx
│   ├── hooks/
│   │   ├── use-native-bridge.ts
│   │   └── use-food-ocr.ts
│   └── constants/
│       ├── bridge-events.ts
│       └── config.ts
├── web/
│   ├── src/app/
│   │   ├── (auth)/login/
│   │   └── (service)/
│   │       ├── page.tsx
│   │       ├── profile/
│   │       ├── analyses/
│   │       └── settings/
│   ├── src/components/
│   ├── src/lib/native-bridge/
│   ├── src/lib/supabase/
│   ├── package.json
│   └── package-lock.json
├── supabase/
│   ├── migrations/
│   ├── functions/analyze-food/
│   ├── functions/food-data/
│   └── config.toml
├── docs/
└── assets/
```

`src/app/`에는 Expo Router 라우트만 둔다. 최신 `AGENTS.md`가 추가 계층을
금지하므로 기존 FSD 설계의 `pages`, `features`, `widgets`, `shared` 구조는
이 작업에 적용하지 않는다. 기존 웹 전용 Expo 템플릿 잔재는 네이티브 셸
구현 시 함께 제거한다.

## 5. 인증과 세션

- 로그인 UI와 세션 사용 주체는 WebView 안의 웹 앱이다.
- Supabase Auth의 이메일 6자리 OTP를 사용한다.
- 매직링크는 외부 이메일 앱, 브라우저, 딥링크 전환이 필요하므로 MVP에서
  사용하지 않는다.
- 웹 앱은 쿠키 기반 Supabase 세션을 사용한다.
- 인증 토큰을 WebView 브리지 메시지에 넣지 않는다.
- 네이티브는 인증 여부에 따라 스캔 권한을 독자적으로 판단하지 않는다.
  웹의 유효한 `SCAN_REQUEST`에만 응답한다.
- 로그아웃은 웹에서 Supabase 세션을 종료하고 로그인 화면으로 이동한다.
- 일반 모바일 브라우저에서 웹 앱에 접근하면 네이티브 스캔 대신 앱 전용
  기능 안내를 표시한다.

MVP 테스터가 Supabase 기본 이메일 발송 제한을 넘거나 허용되지 않은
주소를 사용할 경우 구현 단계에서 전용 SMTP를 구성한다. SMTP 구성은 인증
기능 작업의 일부이며 비밀값은 저장소에 커밋하지 않는다.

## 6. WebView 브리지

브리지는 허용된 이벤트만 처리하는 버전 계약으로 운영한다.

```ts
type ScanRequestV1 = {
  version: 1;
  type: 'SCAN_REQUEST';
  requestId: string;
};

type ScanResultV1 = {
  version: 1;
  type: 'SCAN_RESULT';
  requestId: string;
  payload: {
    productName: string | null;
    manufacturer: string | null;
    reportNumber: string | null;
    ingredientsText: string;
    allergenStatement: string | null;
    crossContaminationStatement: string | null;
    rawText: string;
    userReviewed: true;
  };
};

type ScanCancelledV1 = {
  version: 1;
  type: 'SCAN_CANCELLED';
  requestId: string;
};

type ScanFailedV1 = {
  version: 1;
  type: 'SCAN_FAILED';
  requestId: string;
  code: 'permission_denied' | 'ocr_failed' | 'invalid_image' | 'unknown';
};
```

### 브리지 보안 규칙

- 프로덕션 웹 앱의 HTTPS 도메인만 허용한다.
- 메시지 크기 상한을 적용한다.
- 알 수 없는 이벤트, 지원하지 않는 버전, 중복 `requestId`, 잘못된 JSON을
  거부한다.
- 메시지를 HTML로 렌더링하거나 코드로 실행하지 않는다.
- Base64 이미지, 파일 URI, 인증 토큰, 공공 API 키를 메시지에 허용하지
  않는다.
- 외부 링크는 WebView 안에서 탐색하지 않고 시스템 브라우저로 연다.

## 7. 촬영과 OCR

### 7.1 촬영 단계

최대 두 장을 촬영한다.

1. 제품 정보면: 제품명, 제조사, 품목보고번호
2. 원재료면: 원재료명, 알레르기 표시, 교차혼입 문구

원재료면은 필수다. 원재료면에서 제품 정보도 충분히 추출되면 첫 촬영은
생략할 수 있다. 사용자는 촬영을 다시 하거나 각 필드를 직접 수정할 수
있다.

### 7.2 OCR 엔진

Google ML Kit Text Recognition v2의 한글 모델을 우선 사용한다. Expo
SDK 57에 OCR API가 포함되어 있지 않으므로 React Native 래퍼 또는 로컬
Expo Module이 필요하다. 특정 서드파티 래퍼는 iOS·Android 개발 빌드가
모두 통과하기 전에는 확정 의존성으로 간주하지 않는다.

OCR 네이티브 모듈을 추가하면 Expo Go를 사용할 수 없으므로
`expo-dev-client`를 포함한 개발 빌드를 사용한다. CNG를 유지하고 `ios/`,
`android/`를 커밋하거나 직접 수정하지 않는다. 네이티브 설정은 config
plugin으로 적용한다.

### 7.3 이미지 수명

- 앱 캐시 디렉터리에서만 이미지를 다룬다.
- OCR 완료, 취소, 오류, 재촬영 시 이전 임시 파일을 삭제한다.
- EXIF 위치정보를 서버로 보내지 않는다.
- 분석 요청에는 텍스트와 구조화 필드만 포함한다.
- 앱 비정상 종료 뒤 남은 OCR 임시 파일은 다음 실행 시 정리한다.

## 8. 공공 데이터와 제품 매칭

### 8.1 데이터 제공처

1. 식품의약품안전처 식품영양성분 DB 정보
   - 제품명, 분류, 식품코드, 기준량, 열량, 탄수화물, 단백질, 지방,
     당류, 나트륨, 콜레스테롤, 포화지방 등
2. 식품안전나라 식품(첨가물) 품목제조보고 원재료
   - 품목보고번호, 제품명, 제조사, 식품 유형, 원재료 문자열

바코드 연계제품 정보는 2018년 이후 최신화가 중단되어 주 식별 수단으로
사용하지 않는다.

### 8.2 매칭 순서

1. 품목보고번호가 있으면 정확 일치를 우선한다.
2. 정규화한 제품명과 제조사로 로컬 캐시를 검색한다.
3. 캐시에 없으면 공공 API 후보를 조회한다.
4. 제품명 유사도, 제조사 일치, 원재료 겹침으로 후보 순위를 계산한다.
5. 품목보고번호가 정확히 일치하거나, 정규화 제품명과 제조사가 모두
   정확히 일치하는 유일한 후보만 자동 선택한다.
6. 근사 일치 또는 복수 후보는 웹에서 사용자가 선택한다.
7. 후보가 없으면 OCR 원재료만으로 알레르기를 분석하고 질환 분석은
   `확인 필요`로 제한한다.

MVP에서는 유사도 점수만으로 제품을 자동 선택하지 않는다. 점수는 사용자에게
보여줄 후보 순서에만 사용한다.

### 8.3 캐시와 충돌

- 정규화 결과와 공공 API 원본 응답, 조회 시각, 데이터 기준일을 저장한다.
- 캐시 만료 또는 변경일 이후 데이터는 백그라운드가 아니라 현재 요청에서
  갱신한다.
- 라벨과 API 중 어느 한쪽에서 알레르기 성분이 확인되면 제거하지 않는다.
- 충돌한 필드는 각각 `제품 라벨`, `식약처 API` 출처로 결과에 표시한다.
- API 장애 시 유효 캐시를 사용하고, 캐시도 없으면 부분 결과를 반환한다.

## 9. 개인화 기준정보

### 9.1 알레르기 기준

식약처 표시대상 19종을 기준으로 한다. 아황산류의 공식 표시 조건은
최종제품의 이산화황 10mg/kg 이상이지만 앱은 OCR/API 텍스트만으로 실제
농도를 계산하지 않는다. 라벨이나 원재료에 아황산류 관련 문구가 있으면
주의로 처리하고, 없다는 이유로 부재를 확정하지 않는다.

| 기준 ID | 기준 물질명 | 추가 매칭 단어 |
| --- | --- | --- |
| FOOD-001 | 알류 | 알류, 계란, 달걀, 난백, 난황, 전란, 난분, 메추리알 |
| FOOD-002 | 우유 | 유청, 탈지분유, 전지분유, 카제인, 유당, 버터, 크림, 치즈 |
| FOOD-003 | 메밀 | 메밀가루, 메밀분, 메밀전분 |
| FOOD-004 | 땅콩 | 낙화생, 땅콩버터, 땅콩분말 |
| FOOD-005 | 대두 | 콩, 두유, 두부, 된장, 간장, 대두단백, 대두레시틴 |
| FOOD-006 | 밀 | 밀가루, 소맥, 소맥분, 밀단백, 글루텐 |
| FOOD-007 | 잣 | 잣가루, 잣분말 |
| FOOD-008 | 호두 | 호두분말 |
| FOOD-009 | 게 | 게살, 게추출물, 꽃게, 대게, crab |
| FOOD-010 | 새우 | 새우살, 새우분말, 새우추출물, shrimp, prawn |
| FOOD-011 | 오징어 | 오징어분말, 오징어추출물, squid |
| FOOD-012 | 고등어 | 고등어살, 고등어추출물, mackerel |
| FOOD-013 | 조개류 | 굴, 전복, 홍합, 바지락, 가리비, oyster, abalone, mussel, clam, scallop |
| FOOD-014 | 복숭아 | 복숭아농축액, 복숭아퓨레, peach |
| FOOD-015 | 토마토 | 토마토페이스트, 토마토퓨레, 토마토농축액, tomato |
| FOOD-016 | 닭고기 | 닭육, 닭고기분말, 닭고기추출물, chicken |
| FOOD-017 | 돼지고기 | 돼지육, 돈육, 돼지고기분말, pork |
| FOOD-018 | 쇠고기 | 소고기, 우육, 쇠고기분말, beef |
| FOOD-019 | 아황산류 | 아황산염, 이산화황, 아황산나트륨, 메타중아황산나트륨, 메타중아황산칼륨, sulfite, sulfur dioxide |

기준 물질명 자체도 매칭 용어에 포함한다. 표의 모든 용어를 동일한 부분
문자열 규칙으로 처리하지 않는다. 각 용어는 `exact_token`, `phrase`,
`label_context` 중 하나와 `confirmed`, `possible` 신뢰 수준을 가진다.

### 9.2 질환 기준

질환 코드와 명칭은 구현 시 2026년 시행 KCD-9 원문과 대조한다. 상병
분류는 식품 판정 근거가 아니며 사용자 선택값을 표준화하는 용도로만 쓴다.

| 기준 ID | 카테고리 | 질환명 | 원천 상병코드 | 분석 수준 |
| --- | --- | --- | --- | --- |
| DIS-001 | 선택 상태 | 질환 없음 | 해당 없음 | 배타적 선택 상태 |
| DIS-002 | 심혈관계 | 고혈압 | I10-I15 | 관련 영양정보 후보 |
| DIS-003 | 내분비·대사 | 당뇨병 | E10-E14 | 관련 영양정보 후보 |
| DIS-004 | 내분비·대사 | 고지혈증 | E78 | 관련 영양정보 후보 |
| DIS-005 | 내분비·대사 | 갑상선 질환 | E03-E07 | 제한적 |
| DIS-006 | 알레르기·호흡기 | 알레르기 비염 | J30 | 자동 판정 안 함 |
| DIS-007 | 알레르기·호흡기 | 천식 | J45-J46 | 자동 판정 안 함 |
| DIS-008 | 정신건강 | 우울증 | F32-F33 | 자동 판정 안 함 |
| DIS-009 | 정신건강 | 불안장애 | F40-F41 | 자동 판정 안 함 |
| DIS-010 | 류마티스·근골격계 | 골다공증 | M81-M82 | 관련 영양정보 후보 |
| DIS-011 | 심혈관계 | 협심증·심근경색 | I20-I25 | 관련 영양정보 후보 |
| DIS-012 | 심혈관계 | 심장 부정맥 | I47-I49 | 제한적 |
| DIS-013 | 심혈관계 | 심부전 | I50 | 제한적 |
| DIS-014 | 심혈관계 | 뇌졸중·뇌경색 | I63-I64 | 제한적 |
| DIS-015 | 심혈관계 | 혈전·색전 질환 | I74, I80-I82 | 자동 판정 안 함 |
| DIS-016 | 신장 | 신장질환·신부전 | N17-N19 | 제한적 |
| DIS-017 | 소화기·간 | 만성 간질환 | K73-K75 | 제한적 |
| DIS-018 | 알레르기·피부 | 아토피 피부염 | L20 | 자동 판정 안 함 |
| DIS-019 | 류마티스·근골격계 | 류마티스 관절염 | M05-M06 | 자동 판정 안 함 |
| DIS-020 | 신경계 | 파킨슨병 | G20 | 자동 판정 안 함 |
| DIS-021 | 신경계 | 뇌전증 | G40-G41 | 자동 판정 안 함 |
| DIS-022 | 신경계 | 치매 | F00-F03 | 자동 판정 안 함 |
| DIS-023 | 정신건강 | 조현병 | F20 | 자동 판정 안 함 |
| DIS-024 | 암·면역 | 암 치료 중 | C00-C97 | 자동 판정 안 함 |
| DIS-025 | 암·면역 | 면역저하·면역결핍 | D80-D84 | 자동 판정 안 함 |
| DIS-026 | 내분비·대사 | 임신성 당뇨병 | O24 | 관련 영양정보 후보 |
| DIS-027 | 심혈관계 | 임신 중 고혈압 질환 | O10-O16 | 관련 영양정보 후보 |
| DIS-028 | 선택 상태 | 기타 | 해당 없음 | 자유 메모, 자동 판정 안 함 |

`질환 없음`은 다른 질환과 함께 선택할 수 없다. `기타`의 자유 메모는
사용자에게 다시 보여주기 위한 값이며 자동 규칙 입력으로 사용하지 않는다.

### 9.3 데이터 모델

```text
profiles
  user_id, consent_version, has_no_known_disease, created_at, updated_at

allergen_standards
  id, name, source_url, source_version, active

allergen_match_terms
  id, allergen_id, term, match_type, confidence, priority, active

disease_standards
  id, category, name, source_codes, classification_version,
  analysis_support, active

disease_rules
  id, disease_id, target_type, target_key, operator, threshold,
  unit, severity, message, evidence_url, rule_version, reviewed_at, active

user_allergens
  user_id, allergen_id, created_at

user_diseases
  user_id, disease_id, note, created_at

public_food_products
  id, report_number, normalized_name, manufacturer, normalized_payload,
  source_updated_at, fetched_at

public_api_snapshots
  id, product_id, service_id, request_fingerprint, raw_payload,
  source_updated_at, fetched_at

analyses
  id, user_id, status, product_id, corrected_ocr_payload,
  profile_snapshot, rule_set_version, data_quality, created_at

analysis_findings
  id, analysis_id, category, severity, standard_id, title,
  description, matched_text, source, evidence_url
```

건강정보는 `auth.users.user_metadata`에 넣지 않는다. 모든 사용자 소유
테이블은 RLS로 본인만 읽고 쓸 수 있다. Edge Function은 인증된 JWT를
검증하고 요청 사용자를 임의의 본문 `user_id`가 아니라 토큰에서 구한다.

## 10. 원재료와 알레르기 매칭

### 10.1 정규화

- 유니코드와 공백을 정규화한다.
- 영문은 소문자로 변환한다.
- 쉼표, 가운데점, 슬래시, 줄바꿈을 구분자로 인식한다.
- 대괄호와 소괄호의 중첩을 보존해 복합원재료를 파싱한다.
- OCR 원문과 정규화 결과를 모두 유지한다.

### 10.2 매칭 순서

1. 알레르기 공식 표시 문구
2. `함유` 등 직접 문맥의 기준 물질
3. 정확 원재료 토큰 및 확정 별칭
4. 복합원재료 내부 확정 별칭
5. 교차혼입 문구
6. 오탐 가능성이 있는 간접 별칭

`게`, `밀`, `콩`, `크림`처럼 짧거나 의미가 넓은 용어는 원문 전체에 대한
부분 문자열로 검색하지 않는다. 독립 토큰, 복합어 사전, 주변 문맥을 함께
검사한다. 간접 별칭만 일치하면 `확인 필요`로 처리할 수 있으며, 실제
회귀 데이터가 쌓이면 용어별 신뢰 수준을 조정한다.

각 매칭은 다음 근거를 남긴다.

- 기준 ID
- 일치한 원문 구간
- 일치한 별칭
- 직접 함유 또는 교차혼입 여부
- 라벨 또는 API 출처
- 매칭 방식과 신뢰 수준

## 11. 질환 관련 영양정보와 규칙

### 11.1 지원 원칙

- 질환 선택만으로 식품의 섭취 가능 여부를 판정하지 않는다.
- 공공 API에 실제 영양값이 있고, 공식 근거와 검수된 규칙이 있을 때만
  자동 주의 규칙을 활성화한다.
- 임계값을 임의로 만들지 않는다.
- 치료 단계, 약물, 연령, 임신 상태 등 추가 문맥이 필요한 질환은 자동
  판정하지 않는다.
- 근거 없는 규칙은 `active = false`이며 결과 엔진에서 실행하지 않는다.

### 11.2 관련 정보 후보

- 고혈압·심혈관계: 나트륨
- 당뇨병·임신성 당뇨병: 탄수화물·당류
- 고지혈증: 포화지방·콜레스테롤
- 신장질환: 나트륨·단백질, 값이 있을 때만 칼륨·인
- 골다공증: 칼슘

이 매핑은 어떤 식품을 금지한다는 뜻이 아니다. 검수된 수치 규칙이 없으면
해당 영양값과 데이터 출처만 보여준다. 사용자가 선택한 질환별 화면에는
`분석 지원`, `일부 지원`, `정보 저장만`을 표시한다.

## 12. 판정과 결과

### 12.1 상태

우선순위는 `주의 > 확인 필요 > 특이사항 없음`이다.

#### 주의

- 등록 알레르기가 공식 표시 문구에 존재한다.
- 등록 알레르기가 정확 원재료 또는 확정 별칭과 일치한다.
- 같은 시설 사용 등 등록 알레르기의 교차혼입 문구가 존재한다.
- 공식 근거와 검수를 마친 활성 질환 규칙이 발동한다.

#### 확인 필요

- 필수 OCR 필드가 비었거나 사용자가 확인하지 않았다.
- 제품 매칭이 실패했거나 복수 후보가 해소되지 않았다.
- OCR과 API 데이터가 충돌한다.
- 간접 별칭만 일치한다.
- 질환 분석에 필요한 영양값이 없다.
- 선택 질환이 자동 분석 대상이 아니다.

#### 특이사항 없음

- 필수 OCR 텍스트를 사용자가 확인했다.
- 제품 데이터 또는 원재료 데이터가 분석에 충분하다.
- 등록 알레르기와 일치하는 직접·교차혼입 문구가 없다.
- 실행 가능한 개인화 규칙에서 주의 항목을 찾지 못했다.

이 상태는 안전 보장이 아니며 결과 화면에 `현재 확인 가능한 정보에서 주의
항목을 찾지 못했어요. 실제 제품 표시를 다시 확인해 주세요.`라는 취지의
설명을 함께 표시한다.

### 12.2 결과 구조

```ts
type AnalysisResult = {
  status: 'caution' | 'needs_review' | 'no_flags';
  product: ProductMatch | null;
  findings: Finding[];
  dataQuality: DataQuality;
  analyzedAt: string;
  ruleSetVersion: string;
};

type Finding = {
  category:
    | 'allergen'
    | 'cross_contamination'
    | 'disease_nutrition'
    | 'data_quality';
  severity: 'caution' | 'needs_review' | 'info';
  standardId: string | null;
  title: string;
  description: string;
  matchedText: string | null;
  source: 'label' | 'mfds_api' | 'user_profile' | 'rule';
  evidenceUrl: string | null;
};
```

과거 결과에는 당시 프로필, 교정 OCR 텍스트, 공공 데이터 기준일, 규칙
버전과 발동 근거를 스냅샷으로 저장한다. 규칙 변경 시 과거 결과를 덮어쓰지
않고 재분석은 새 결과로 기록한다.

## 13. 오류 처리

- 카메라 권한 거부: 권한 필요 이유와 설정 이동 안내
- OCR 실패: 재촬영 또는 취소
- 원재료 미추출: 서버 전송 전에 재촬영 요청
- 제품 후보 복수: 사용자 선택 전 질환 판정 보류
- 제품 매칭 실패: OCR 원재료 알레르기 분석만 수행
- 영양정보 없음: 질환 판정 `확인 필요`
- 공공 API 장애: 유효 캐시 사용, 없으면 부분 결과
- 서버 연결 실패: 현재 화면에서 교정 텍스트를 유지하고 재시도
- WebView 로드 실패: 네이티브 오류 화면과 재시도
- 지원하지 않는 질환: 자동 판정 없이 지원 한계 표시

외부 상태가 정상화되기 전까지 민감한 OCR 텍스트를 영구 로컬 큐에 저장하지
않는다. 앱이 열린 동안 메모리에 유지해 재시도하고 종료되면 폐기한다.

## 14. 개인정보와 보안

- 알레르기와 질환은 민감정보로 취급한다.
- 최소 정보만 수집하고 목적·보유·삭제 정책에 동의받는다.
- 사용자 소유 테이블에 RLS를 적용한다.
- 로그와 오류 추적 도구에서 이메일, 질환, 알레르기, OCR 원문을 마스킹한다.
- 공공 API 키와 Supabase 서비스 역할 키를 클라이언트에 넣지 않는다.
- `EXPO_PUBLIC_` 환경변수에는 공개 가능한 웹 URL만 둔다.
- Edge Function은 요청 크기, 속도, 스키마, JWT를 검증한다.
- 회원 탈퇴 시 프로필, 선택값, 분석, 판정 상세를 삭제한다.
- 기준정보와 익명 공공 데이터 캐시는 사용자 삭제 대상이 아니다.

## 15. 구현 단계

### M0. OCR 기술 검증

- Expo SDK 57 개발 빌드 구성
- 한글 ML Kit 모델의 iOS·Android 빌드 검증
- 실제 라벨 이미지에서 파일 기반 OCR 검증
- 원본 이미지 무전송 및 임시 파일 삭제 확인
- 래퍼 실패 시 로컬 Expo Module 전환 여부 결정

### M1. Supabase와 인증

- 이메일 OTP
- 데이터베이스 마이그레이션과 기준정보 시드
- RLS와 삭제 정책
- 공공 API Secret
- 인증·RLS 통합 테스트

### M2. WebView용 웹 앱

- 로그인
- 개인화 설정
- 홈과 스캔 요청
- 제품 후보 선택
- 결과와 이력
- 설정·로그아웃·탈퇴

### M3. Expo 하이브리드 셸

- Expo 웹 템플릿 잔재 제거
- WebView 셸과 탐색 제한
- 브리지 계약
- 촬영·OCR·교정
- 임시 이미지 수명 관리
- iOS·Android 오류 처리

### M4. 식품 분석 서버

- OCR 텍스트 파싱
- 공공 API 어댑터와 캐시
- 제품 후보 매칭
- 알레르기 매칭
- 지원 질환 규칙
- 결과와 스냅샷 저장

### M5. 안전성·회귀·출시 준비

- 알레르기 회귀 데이터셋
- 브리지 보안 테스트
- RLS 침범 테스트
- 공공 API 장애 테스트
- 실기기 전체 흐름 검증
- 개인정보 문구와 데이터 삭제 검증

## 16. 테스트 전략

### 자동 테스트

- 알레르기 19종 및 모든 시드 별칭
- 중첩 괄호, 혼합제제, 다양한 구분자
- 영문 별칭 대소문자
- 짧은 토큰의 오탐 방지
- 직접 함유와 교차혼입 구분
- OCR/API 충돌
- 제품 후보 0·1·복수
- API 오류·지연·캐시 만료
- 비활성·미검수 질환 규칙 실행 차단
- 상태 우선순위
- 잘못된 브리지 JSON, 미지원 버전, 과대 메시지, 중복 요청
- 사용자 간 RLS 격리
- 탈퇴 후 사용자 데이터 삭제

### 실기기 테스트

- 실제 일반 가공식품 최소 20종
- 종이상자, 비닐, 페트병, 캔, 곡면, 반사 포장
- 정상 조명과 저조도
- iOS와 Android 각각 전체 흐름
- 카메라 권한 거부·복구
- WebView 세션 유지·로그아웃
- 네트워크 단절·재시도
- 앱 종료 후 임시 이미지 정리

알레르기 회귀셋은 등록 알레르기 포함 사례를 반드시 포함하고 미탐 0건을
완료 조건으로 삼는다. 오탐은 사용자 경험 문제지만 미탐은 안전 문제이므로
우선순위를 다르게 둔다.

## 17. 검증 명령과 완료 조건

코드 작업 완료를 선언하려면 최소한 다음이 모두 통과해야 한다.

```bash
# Expo 루트
npx expo lint
npx tsc --noEmit
npx expo-doctor

# web/
npm run lint
npm run typecheck
npm test

# Supabase
npx supabase start
npx supabase db reset --local
npx supabase test db --local
deno task test
```

Supabase 데이터베이스와 RLS 테스트는 `supabase/tests/`의 pgTAP 테스트로
실행한다. Edge Function은 `supabase/deno.json`에
`"test": "deno test supabase/functions/tests/ --allow-env"` 작업을 정의하고
`deno task test`로 검증한다. 해당 테스트가 통과하기 전에는 서버 분석
기능을 완료로 간주하지 않는다. 실행하지 않은 검증을 통과했다고 기록하지
않는다.

코드 검증 외에 다음 수동 확인이 필요하다.

- iOS·Android 개발 빌드
- 실제 카메라 권한
- 한글 OCR
- 이미지 무전송
- WebView 세션
- 탈퇴 후 데이터 삭제

## 18. 의존성과 승인 게이트

예상 의존성은 다음과 같다.

- `react-native-webview`
- `expo-camera`
- `expo-image-manipulator`
- `expo-dev-client`
- 기술 검증을 통과한 ML Kit OCR 래퍼 또는 로컬 Expo Module
- Next.js와 Supabase 웹·서버 SDK

실제 설치 전 사용자에게 승인을 받고, Expo 앱 의존성은 SDK 57 문서를
확인한 뒤 `npx expo install`로 설치한다. NativeWind, 상태관리 라이브러리,
별도 데이터 패칭 라이브러리는 MVP 기본 의존성에 포함하지 않는다.

## 19. 리스크와 완화책

| 리스크 | 완화책 |
| --- | --- |
| ML Kit 래퍼가 RN 0.86에서 빌드되지 않음 | M0에서 양 플랫폼을 먼저 빌드하고 실패 시 로컬 Expo Module 판단 |
| 한글 소형 라벨 OCR 미탐 | 최대 2회 촬영, 크롭·리사이즈, 사용자 교정, 회귀셋 |
| 짧은 알레르기 단어의 오탐 | 토큰·문맥·복합어 규칙과 용어별 신뢰 수준 |
| 공공 API 제품 매칭 오류 | 품목번호 우선, 복수 후보 사용자 선택, 출처 표시 |
| 공공 데이터 누락·지연 | 원본 응답 캐시, 부분 결과, `확인 필요` |
| 질환 기반 과잉 판정 | 검수·근거·버전 없는 규칙 비활성화 |
| WebView 메시지 위조 | 도메인 제한, 스키마·버전·요청 ID·크기 검증 |
| 건강정보 노출 | RLS, 로그 마스킹, 최소 수집, 탈퇴 삭제 |
| `특이사항 없음`의 안전 보장 오해 | 단정 표현 금지, 데이터 품질과 재확인 안내 상시 표시 |

## 20. 근거 자료

- Expo SDK 57 WebView:
  https://docs.expo.dev/versions/v57.0.0/sdk/webview/
- Expo 커스텀 네이티브 코드와 개발 빌드:
  https://docs.expo.dev/workflow/customizing/
- Google ML Kit Text Recognition v2 지원 언어:
  https://developers.google.com/ml-kit/vision/text-recognition/v2/languages
- Supabase Auth:
  https://supabase.com/docs/guides/auth
- Supabase 이메일 OTP:
  https://supabase.com/docs/guides/auth/auth-email-templates
- 식품영양성분 DB 정보:
  https://www.data.go.kr/data/15127578/openapi.do
- 식품(첨가물) 품목제조보고 원재료:
  https://foodsafetykorea.go.kr/api/openApiInfo.do?svc_no=C002
- 바코드 연계제품 정보:
  https://foodsafetykorea.go.kr/api/openApiInfo.do?svc_no=C005
- 식약처 알레르기 유발식품 표시 안내:
  https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs001&menu_grp=MENU_NEW01&menu_no=3120&ntctxt_no=1091412
- KCD-9 개정·시행 자료:
  https://sri.kostat.go.kr/boardDownload.es?bid=11103&list_no=443895&seq=1
