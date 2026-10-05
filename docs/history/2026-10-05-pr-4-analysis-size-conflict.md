# 분석 요청 크기·충돌 판정 보정

- 날짜: 2026-10-05
- PR 번호: #4
- PR 링크: https://github.com/ckx9798/RN/pull/4
- 상태: Ready for review
- 관련 설계: [하이브리드 MVP 설계](../superpowers/specs/2026-09-30-hybrid-food-analysis-mvp-design.md)
- 관련 구현 계획: [하이브리드 MVP 계획](../superpowers/plans/2026-09-30-hybrid-food-analysis-mvp.md)

## 작업 배경

PR #3 병합 후 `analyze-food` Edge Function 리뷰에서 긴 라벨이 분석되지 않고
`특이사항 없음`이 거의 나오지 않는 문제가 확인됐다.

## 작업 목표

브리지가 전달한 라벨은 크기 때문에 거부되지 않고, 원재료 충돌은 실제로
비교 가능한 정보끼리만 판정한다.

## 작업 범위

- 웹·서버 분석 요청 상한 조정
- 원재료 충돌 비교 범위와 누락 사유 표시
- Auth 장애 응답, 프로필 조회 사용자 필터
- 분석 저장 시각 RPC 재정의 마이그레이션

## 주요 변경 사항

- 요청 상한을 48KB에서 80KB로 올렸다. 브리지 상한 64KB에 후보 선택 UUID 등
  요청 래퍼 여유분을 더한 값이다.
- 충돌 비교는 라벨 원재료 목록의 직접 함유와 공공 API 원재료만 대상으로 하고
  사용자가 등록한 알레르기만 보고한다. 판정 근거 finding은 제거하지 않는다.
- 같은 누락 사유는 한 번만 표시한다.
- Auth 토큰 거부(400/401/403)만 미인증으로 보고 Auth 장애는 500으로 응답한다.
- 프로필·알레르기·질환 조회에 검증된 `user_id` 필터를 더했다.
- `20261005000200_analysis_save_server_time.sql`로 `save_my_analysis`를 재정의해
  `created_at`이 DB 시각을 쓰게 했다. 적용된 마이그레이션은 수정하지 않았다.

## 핵심 기술 결정

- 교차혼입·알레르기 표시 문구는 공공 API에 대응 정보가 없으므로 충돌 비교에서
  뺐다. 해당 문구의 알레르기 판정은 기존대로 유지한다.
- rawText까지 알레르기 매칭에 쓰는 보수적 동작은 과잉 경고를 택한 의도로 보고
  유지하고 주석으로 남겼다.

## 사용자 영향

- 긴 한글 라벨도 분석된다.
- 같은 시설 안내만 있는 제품도 다른 데이터가 충분하면 `특이사항 없음`이 될 수 있다.
- 미등록 알레르기는 원재료 충돌로 표시되지 않는다.
- Auth 일시 장애 시 로그인 화면 대신 오류와 재시도 안내가 나온다.

## 검증 결과

- `npx expo lint`, `npx tsc --noEmit`, `npx jest`(70개) 통과
- `web`: `npm run lint`, `npm run typecheck`, `npm test`(74개) 통과
- `supabase`: `deno task test`(401개), `deno check`, `deno lint` 통과
- pgTAP `07_analysis_save_server_time`는 Docker가 없어 실행하지 않았다.

## 제외 범위

- 탈퇴 RPC의 `SECURITY DEFINER` 구조 변경(advisor 경고, 의도된 설계)
- 공공 API 응답 필드 매핑 실측 대조

## 후속 작업

- 테스트 Supabase 프로젝트에 `20261005000100`, `20261005000200` 적용과 Edge Function 배포
- 공공 API 키로 실제 응답 필드 확인
