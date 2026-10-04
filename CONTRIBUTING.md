# 기여 안내

이 프로젝트의 파일 변경은 최신 `main`에서 분리한 새 worktree와 목적별
브랜치에서 진행하고 PR로 `main`에 병합한다. 상세 기준은
[Git 및 PR 작업 규칙](docs/rules/workflow.md)을 따른다.

## 작업 순서

- [ ] `git status --short --branch`로 기존 변경을 확인한다.
- [ ] 원격 `main`을 최신 상태로 확인한다.
- [ ] 최신 `main`에서 새 worktree와 `<type>/<short-topic>` 브랜치를 만든다.
- [ ] `main` 작업공간에서 직접 파일을 수정하거나 커밋하지 않는다.
- [ ] 요청 범위와 관련된 파일만 수정한다.
- [ ] 변경 유형에 맞는 검증을 실행한다.
- [ ] 명사형 제목과 상세 본문으로 목적별 커밋을 만든다.
- [ ] push 요청을 받은 경우에만 원격 브랜치로 전송한다.
- [ ] Draft PR을 생성해 PR 번호를 확보한다.
- [ ] 구현과 검증이 끝나면 `docs/history/`에 PR별 작업 이력을 남긴다.
- [ ] 검토 준비가 끝나면 Ready for review 전환 여부를 확인한다.
- [ ] 리뷰 반영과 필수 검증을 마친 뒤 병합 승인을 받는다.

## 커밋 제목

```text
<type>(<scope>): <명사형 제목>
```

예:

```text
docs(rules): 프로젝트 규칙 문서 추가
feat(scan): 영양성분 촬영 화면 구현
fix(router): 상세 화면 이동 오류 수정
```

`추가하라`, `구현하라` 같은 명령형을 사용하지 않는다. 제목 다음에
빈 줄을 두고 변경 이유, 사용자 영향과 검증 결과를 본문에 기록한다.

## 검증

변경 유형별 명령은 [개발 규칙](docs/rules/development.md)을 따른다.

- 코드: `npx expo lint`, `npx tsc --noEmit`, 관련 테스트
- 의존성·Expo 설정: 코드 검증과 `npx expo-doctor`
- UI·라우팅: 코드 검증과 iOS·Android 확인
- 문서 전용: `git diff --check`, 링크·경로·명령어 확인

실행하지 못했거나 실패한 검증은 이유와 실제 결과를 PR에 기록한다.

## 문서와 PR 이력

- 설계와 구현 계획은 Superpowers 기본 경로를 사용한다.
- PR 이력은 [`docs/history/_template.md`](docs/history/_template.md)를
  기준으로 작성한다.
- 파일명은 `docs/history/YYYY-MM-DD-pr-<number>-<topic>.md` 형식을
  사용한다.
- 문서 분류와 갱신 기준은
  [문서 관리 규칙](docs/rules/documentation.md)을 따른다.

## 권한 경계

commit, push, PR 생성, Ready 전환, 병합과 배포는 서로 다른 작업이다.
사용자가 명시적으로 요청한 단계까지만 수행한다.
