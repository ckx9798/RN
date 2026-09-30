# 프로젝트 문서

이 디렉터리는 프로젝트 규칙, 설계, 구현 계획, 조사 자료와 PR별 작업
이력을 관리한다. 문서를 새로 만들기 전에 아래 분류에서 목적에 맞는
위치를 선택한다.

## 문서 지도

| 종류 | 저장 위치 | 용도 |
| --- | --- | --- |
| 프로젝트 규칙 | [`docs/rules/`](rules/) | 구조, 개발, Git·PR, 문서와 배포 기준 |
| 설계 | [`docs/superpowers/specs/`](superpowers/specs/) | 구현 전 승인된 요구사항과 기술 결정 |
| 구현 계획 | [`docs/superpowers/plans/`](superpowers/plans/) | 승인된 설계를 실행 가능한 작업으로 분해 |
| PR 작업 이력 | [`docs/history/`](history/) | 구현 완료 후 PR별 배경, 변경과 검증 결과 기록 |
| 조사 자료 | `docs/` | 특정 기술이나 선택지를 비교한 참고 자료 |

## 기준 문서

- [아키텍처 규칙](rules/architecture.md)
- [개발 규칙](rules/development.md)
- [Git·PR 규칙](rules/workflow.md)
- [문서 관리 규칙](rules/documentation.md)
- [배포 규칙](rules/release.md)

아직 작성 중인 기준 문서는 해당 구현 작업이 끝나기 전까지 링크가
열리지 않을 수 있다. 규칙 체계가 완성된 이후에는 깨진 링크를 허용하지
않는다.

## 문서 작성 원칙

- 같은 규칙을 여러 문서에 복사하지 않고 기준 문서에 정의한다.
- `README.md`, `AGENTS.md`, `CONTRIBUTING.md`에는 필요한 요약과 기준
  문서 링크만 둔다.
- 작업별 설계와 계획은 Superpowers 기본 경로를 유지한다.
- PR 이력은 설계나 계획을 복사하지 않고 실제 구현 결과를 기록한다.
- 자세한 파일명, 상태와 갱신 절차는
  [문서 관리 규칙](rules/documentation.md)을 따른다.
