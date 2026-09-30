# Project Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사람과 AI 에이전트가 함께 사용하는 프로젝트 규칙 문서 체계를 만들고 FSD, Git·PR, 문서 이력, Expo 개발 원칙을 하나의 일관된 기준으로 정리한다.

**Architecture:** 루트 문서는 프로젝트 진입점과 작업 흐름만 제공하고, 상세 규칙은 `docs/rules/`에서 주제별 단일 기준으로 관리한다. Superpowers 설계·계획 경로는 유지하며 `docs/history/`에는 Draft PR 번호를 사용한 PR별 완료 기록을 남긴다.

**Tech Stack:** Markdown, Expo SDK 57, React Native 0.86, Expo Router, Git, GitHub Pull Requests

**Spec:** `docs/superpowers/specs/2026-09-30-project-rules-design.md`

## Global Constraints

- iOS와 Android만 지원하며 웹은 대상이 아니다.
- 프로젝트 구조는 `app → pages → widgets → features → shared` 방향의 축소 FSD를 사용한다.
- `src/app/`에는 Expo Router 라우트와 `_layout.tsx`만 둔다.
- 설계는 `docs/superpowers/specs/`, 계획은 `docs/superpowers/plans/`에 둔다.
- 구현 완료 기록은 `docs/history/YYYY-MM-DD-pr-<number>-<topic>.md`에 PR 단위로 둔다.
- 커밋과 PR 제목은 명령형이 아닌 명사형으로 작성하고 콜론 뒤에 공백을 둔다.
- commit, push, PR 생성, 병합, 배포는 각각 별도 권한으로 취급한다.
- 코드 변경 완료 기준은 `npx expo lint`와 `npx tsc --noEmit` 통과다.
- 문서 전용 변경은 `git diff --check`와 링크·경로·명령어 확인으로 검증한다.
- 새 의존성을 추가하지 않는다.
- 현재 작업 트리의 사용자 소유 `AGENTS.md` 수정은 보존하고 그 내용을 입력으로 통합한다.
- 실제 FSD 코드 이동, ESLint 구성, CI, PR 템플릿과 EAS 설정은 이번 계획 범위가 아니다.

## Review Focus

- 기존 `AGENTS.md`와 FSD 설계가 구조를 다르게 설명하지 않아야 한다. Task 2와 Task 5의 구조 문자열 검증으로 확인한다.
- 루트와 상세 문서 사이의 상대 링크가 모두 실제 파일을 가리켜야 한다. Task 1과 Task 5의 링크 대상 검증으로 확인한다.
- 문서 전용 작업에서 `npx expo lint`가 자동으로 의존성을 설치하지 않아야 한다. Task 3에서 변경 유형별 검증표와 자동 설치 금지 규칙을 확인한다.
- PR 번호가 생기기 전에 완료 이력 파일을 만들도록 요구하면 안 된다. Task 1과 Task 4에서 Draft PR 선행 흐름과 파일명 규칙을 확인한다.
- 기존 사용자 변경을 재작성하면서 Expo SDK 57, 모바일 전용, 의존성 승인 규칙이 빠지지 않아야 한다. Task 5에서 핵심 문구를 확인한다.

---

### Task 1: 문서 지도와 PR 이력 체계

**Files:**
- Create: `docs/README.md`
- Create: `docs/rules/documentation.md`
- Create: `docs/history/_template.md`

**Interfaces:**
- Consumes: 설계 문서의 문서 분류, Superpowers 기본 경로, PR별 이력 필수 항목
- Produces: 다른 모든 문서가 연결할 문서 지도, 문서 저장 규칙, PR 이력 템플릿

- [ ] **Step 1: 현재 문서 경로를 기준선으로 기록**

Run: `find docs -maxdepth 3 -type f -print | sort`

Expected: 기존 `docs/superpowers/specs/`와 OCR 조사 문서가 보이고 `docs/rules/`, `docs/history/`는 아직 없다.

- [ ] **Step 2: `docs/README.md`에 문서 지도를 작성**

설계, 계획, 규칙, 조사 자료, PR 이력의 목적과 저장 위치를 표로 정의한다. `docs/superpowers/specs/`, `docs/superpowers/plans/`, `docs/rules/`, `docs/history/`를 기준 경로로 연결한다.

- [ ] **Step 3: `docs/rules/documentation.md`에 문서 생명주기를 작성**

문서 상태, 파일명, 갱신 책임, 중복 금지, Superpowers 경로 유지, PR 이력 생성 시점과 예외를 정의한다. PR 이력은 Draft PR 번호가 확보된 뒤 Ready for review 전에 작성하도록 명시한다.

- [ ] **Step 4: `docs/history/_template.md`에 PR 이력 템플릿을 작성**

날짜, PR 번호·링크, 상태, 관련 설계·계획, 배경, 범위, 주요 변경, 기술 결정, 사용자 영향, 실제 검증 결과, 제외 범위, 후속 작업 섹션을 포함한다. 템플릿 안내 문구 외에 `TBD`나 사실처럼 보이는 예시 결과를 넣지 않는다.

- [ ] **Step 5: 문서 경로와 필수 항목을 검증**

Run: `test -f docs/README.md && test -f docs/rules/documentation.md && test -f docs/history/_template.md`

Expected: exit 0.

Run: `rg -n 'docs/superpowers/specs|docs/superpowers/plans|docs/history/YYYY-MM-DD-pr-' docs/README.md docs/rules/documentation.md`

Expected: 세 경로와 PR별 파일명 규칙이 각각 확인된다.

Run: `rg -n 'PR 번호|관련 설계|검증 결과|후속 작업' docs/history/_template.md`

Expected: 네 필수 항목이 모두 확인된다.

- [ ] **Step 6: 커밋**

```bash
git add docs/README.md docs/rules/documentation.md docs/history/_template.md
git commit -m "docs(documentation): 문서 관리 및 PR 이력 체계 추가" \
  -m "설계와 구현 계획은 Superpowers 기본 경로에 유지한다.

PR별 완료 기록을 별도 이력 문서로 남길 수 있도록 문서 지도와
템플릿을 정의한다."
```

### Task 2: FSD 아키텍처 규칙

**Files:**
- Create: `docs/rules/architecture.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-09-22-fsd-structure-design.md`, 프로젝트 규칙 설계의 구조 결정
- Produces: `AGENTS.md`와 향후 ESLint 규칙이 참조할 유일한 구조 기준

- [ ] **Step 1: 기존 FSD 설계와 현재 소스 구조를 비교**

Run: `find src -maxdepth 3 -type f -print | sort`

Expected: 현재 `app`, `components`, `hooks`, `constants` 구조가 확인된다.

- [ ] **Step 2: `docs/rules/architecture.md`에 목표 FSD 구조를 작성**

`app`, `pages`, `widgets`, `features`, `shared`, `assets`의 책임을 정의한다. 현재 구조 설명이 아니라 적용할 목표 구조임을 명시하고 실제 이동은 별도 작업으로 분리한다.

- [ ] **Step 3: 의존 방향과 public API 규칙을 작성**

`app → pages → widgets → features → shared`, 동일 레이어 슬라이스 간 직접 의존 금지, `index.ts` public API, `shared`의 상위 레이어 의존 금지, `@/` alias를 명시한다.

- [ ] **Step 4: Expo Router와 지연 도입 규칙을 작성**

`src/app/`의 라우트 전용 책임, 화면 re-export, `_layout.tsx`의 앱 초기화 책임을 정의한다. `entities`와 빈 `features`·`widgets` 디렉터리는 실제 필요가 생길 때만 만든다.

- [ ] **Step 5: 구조 규칙을 검증**

Run: `rg -n 'app → pages → widgets → features → shared|src/app/|public API|@/' docs/rules/architecture.md`

Expected: 의존 방향, 라우트 책임, public API와 alias 규칙이 확인된다.

Run: `rg -n 'components/.*재사용|hooks/.*커스텀|constants/.*테마' docs/rules/architecture.md`

Expected: exit 1. 기존 평면 구조가 기준 구조로 남아 있지 않다.

- [ ] **Step 6: 커밋**

```bash
git add docs/rules/architecture.md
git commit -m "docs(architecture): FSD 프로젝트 구조 규칙 추가" \
  -m "Expo Router와 기능 구현의 책임을 분리한다.

레이어 의존 방향과 public API 경계를 일관되게 적용할 수 있도록
목표 구조를 정의한다."
```

### Task 3: Expo 개발·검증·배포 규칙

**Files:**
- Create: `docs/rules/development.md`
- Create: `docs/rules/release.md`

**Interfaces:**
- Consumes: 현재 `AGENTS.md`의 Expo·플랫폼·스타일·상태·의존성 규칙, 프로젝트 규칙 설계의 검증·보안 결정
- Produces: 개발 작업과 EAS 작업이 참조할 상세 기준

- [ ] **Step 1: 실제 버전과 설정을 확인**

Run: `node -p "require('./package.json').dependencies.expo" && node -p "require('./package.json').dependencies['react-native']"`

Expected: Expo `~57.0.24`, React Native `0.86.3`.

- [ ] **Step 2: `docs/rules/development.md`에 개발 규칙을 작성**

Expo 버전별 공식 문서 확인, iOS·Android 전용 범위, CNG, Expo Router, 플랫폼 폴백, 의존성 사전 승인과 `npx expo install`, 상태 승급, API 선행 구현 금지, NativeWind 도입 전후 스타일 원칙, 접근성·성능·다크 모드·보안 원칙을 포함한다.

- [ ] **Step 3: 변경 유형별 검증표를 작성**

코드, 의존성·설정, UI·라우팅, 네이티브 모듈, 문서 전용 변경을 구분한다. 문서 전용 변경은 `git diff --check`와 링크·경로·명령어 확인을 요구하고, 검증 명령이 자동 설치를 요구하면 사용자 승인 없이 진행하지 않도록 한다.

- [ ] **Step 4: `docs/rules/release.md`에 EAS 규칙을 작성**

Build, Submit, Update의 별도 승인, `npx eas-cli@latest`, 개발·미리보기·프로덕션 개념, 네이티브 변경의 OTA 금지, 환경변수와 비밀정보, 제출·롤백 기준을 정의한다. 아직 없는 `eas.json`의 구체적 프로필 값은 규칙으로 만들어내지 않는다.

- [ ] **Step 5: 개발·배포 규칙을 검증**

Run: `rg -n 'SDK 57|React Native 0.86|iOS.*Android|npx expo install|git diff --check|자동 설치' docs/rules/development.md`

Expected: 버전, 플랫폼, 설치와 문서 검증 규칙이 확인된다.

Run: `rg -n 'Build|Submit|Update|npx eas-cli@latest|OTA|비밀' docs/rules/release.md`

Expected: EAS 단계별 승인과 보안 규칙이 확인된다.

- [ ] **Step 6: 커밋**

```bash
git add docs/rules/development.md docs/rules/release.md
git commit -m "docs(development): Expo 개발 및 배포 규칙 추가" \
  -m "SDK 버전 확인부터 플랫폼 호환성까지 개발 기준을 정의한다.

변경 유형별 검증과 EAS 배포 승인 기준을 별도로 정리한다."
```

### Task 4: Git·커밋·PR 작업 흐름

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `docs/rules/workflow.md`

**Interfaces:**
- Consumes: Task 1의 PR 이력 경로와 템플릿, 프로젝트 규칙 설계의 권한 경계와 커밋 형식
- Produces: 참여자가 따라갈 요약 작업 흐름과 상세 Git·PR 기준

- [ ] **Step 1: `docs/rules/workflow.md`에 상세 작업 흐름을 작성**

목적별 브랜치, `<type>/<short-topic>`, dirty worktree 보존, commit·push·PR·merge·deploy의 별도 권한, Draft PR, Ready for review, 리뷰 반영, 검증 실패 보고, 병합과 force push 승인 규칙을 포함한다.

- [ ] **Step 2: 명사형 커밋·PR 제목과 본문 규칙을 작성**

`<type>(<scope>): <명사형 제목>`, 콜론 뒤 공백, 50자 이내, 본문 빈 줄, 이유·사용자 영향·검증 결과, 72자 줄바꿈과 푸터를 정의한다. `추가하라`와 `구현하라`는 잘못된 예로, `문서 추가`와 `화면 구현`은 올바른 예로 넣는다.

- [ ] **Step 3: PR 이력 생성 순서를 작성**

첫 의미 있는 커밋 push → Draft PR 생성 → PR 번호 확보 → 구현·검증 → `docs/history/` 기록 → Ready for review 순서를 명시한다. push나 PR 생성이 요청되지 않은 로컬 작업은 이력 템플릿까지만 준비하고 외부 작업을 실행하지 않도록 한다.

- [ ] **Step 4: `CONTRIBUTING.md`에 짧은 실행 흐름을 작성**

브랜치 생성부터 검증, PR 이력, 리뷰까지의 체크리스트를 제공하고 상세 규칙은 `docs/rules/workflow.md`, 개발 검증은 `docs/rules/development.md`, 문서 정책은 `docs/rules/documentation.md`로 연결한다.

- [ ] **Step 5: Git·PR 규칙을 검증**

Run: `rg -n '<type>\(<scope>\):|추가하라|문서 추가|Draft PR|Ready for review|docs/history/' CONTRIBUTING.md docs/rules/workflow.md`

Expected: 제목 형식, 옳고 그른 예, Draft 흐름과 이력 경로가 확인된다.

Run: `rg -n 'commit.*push.*PR|강제 push|명시적' docs/rules/workflow.md`

Expected: 외부 상태 변경의 별도 권한이 확인된다.

- [ ] **Step 6: 커밋**

```bash
git add CONTRIBUTING.md docs/rules/workflow.md
git commit -m "docs(workflow): Git 및 PR 작업 규칙 추가" \
  -m "커밋부터 push, Draft PR, 리뷰와 병합까지 각 단계의 권한을
구분한다.

PR별 완료 기록을 남겨 변경 이력을 일관되게 관리한다."
```

### Task 5: 프로젝트 진입 문서 통합

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: Task 1~4의 문서 지도와 기준 문서 링크, 현재 작업 트리의 사용자 소유 `AGENTS.md` 내용
- Produces: 새 참여자용 프로젝트 안내와 AI 에이전트용 핵심 실행 지침

- [ ] **Step 1: 수정 전 사용자 변경을 별도로 확인**

Run: `git diff -- AGENTS.md`

Expected: 사용자가 추가한 한국어 Expo·모바일·커밋 규칙이 확인된다. 이 diff를 초기화하거나 덮어쓰지 않는다.

- [ ] **Step 2: `README.md`를 실제 프로젝트 안내로 교체**

Expo SDK 57, React Native 0.86, iOS·Android 지원, 설치·실행 명령, 디렉터리 개요, 검증 명령과 `CONTRIBUTING.md`·`docs/README.md` 링크를 포함한다. Expo 템플릿의 웹 안내와 `reset-project` 권장은 제거한다.

- [ ] **Step 3: `AGENTS.md`를 핵심 규칙과 상세 링크 중심으로 정리**

공식 Expo 문서 확인, 모바일 전용, FSD 방향, 의존성 승인, 완료 기준, 외부 상태 변경 권한, 명사형 커밋 제목을 직접 남긴다. 상세 설명은 `docs/rules/architecture.md`, `development.md`, `workflow.md`, `documentation.md`, `release.md`로 연결한다.

- [ ] **Step 4: 기존 규칙 충돌을 제거**

`components/hooks/constants`를 기준 구조로 설명하는 부분과 `features` 도입 보류 문구를 제거하고 FSD 규칙으로 교체한다. 삭제 대상 웹 잔재 목록, CNG, NativeWind 도입 전 규칙, 상태 승급과 신규 의존성 승인 규칙은 보존한다.

- [ ] **Step 5: 진입 문서를 검증**

Run: `rg -n 'Expo SDK 57|React Native 0.86|iOS.*Android|CONTRIBUTING.md|docs/README.md' README.md`

Expected: 실제 기술 버전, 플랫폼과 규칙 링크가 확인된다.

Run: `rg -n 'FSD|docs/rules/architecture.md|docs/rules/development.md|docs/rules/workflow.md|명사형|push|PR' AGENTS.md`

Expected: 구조, 상세 규칙 링크, 커밋과 외부 상태 변경 규칙이 확인된다.

Run: `rg -n 'src/components/.*재사용|features/.*지금 만들지|expo start --web|universal app' AGENTS.md README.md`

Expected: exit 1. 충돌하거나 웹을 대상으로 하는 기존 안내가 남지 않는다.

- [ ] **Step 6: 커밋**

```bash
git add README.md AGENTS.md
git commit -m "docs(project): 프로젝트 진입 문서 및 핵심 규칙 정리" \
  -m "기본 Expo 템플릿 안내를 실제 모바일 프로젝트 정보로 교체한다.

AI 에이전트가 상세 규칙 문서를 일관되게 찾도록 진입점을 정리한다."
```

### Task 6: 전체 규칙 일관성 검증

**Files:**
- Modify only if verification finds a documentation defect: `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/README.md`, `docs/rules/*.md`, `docs/history/_template.md`

**Interfaces:**
- Consumes: Task 1~5의 모든 문서
- Produces: 중복·충돌·깨진 경로가 없는 검토 가능한 규칙 문서 세트

- [ ] **Step 1: 계획과 설계의 파일 범위를 대조**

Run: `git diff --name-status 0e47334..HEAD`

Expected: `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/README.md`, `docs/rules/*.md`, `docs/history/_template.md`만 구현 파일로 나타난다. 실제 앱 코드와 패키지 파일은 없어야 한다.

- [ ] **Step 2: 모든 로컬 Markdown 링크의 대상 존재 여부를 확인**

각 Markdown 파일의 상대 링크를 기준 디렉터리에서 해석해 파일 존재를 확인한다. 앵커와 외부 URL은 별도로 눈으로 확인하고, 깨진 로컬 경로가 있으면 해당 소유 문서에서 수정한다.

- [ ] **Step 3: 미완성 표현과 형식 오류를 확인**

Run: `rg -n 'TBD|TODO|추후 작성|미정|placeholder' README.md AGENTS.md CONTRIBUTING.md docs/README.md docs/rules docs/history/_template.md`

Expected: exit 1. 템플릿 입력 안내는 대괄호나 HTML 주석을 사용하고 미완성 규칙처럼 보이는 표현은 없어야 한다.

Run: `git diff --check 0e47334..HEAD`

Expected: exit 0.

- [ ] **Step 4: 핵심 규칙이 한 기준 문서에만 상세 정의됐는지 검토**

`AGENTS.md`, `README.md`, `CONTRIBUTING.md`는 상세 규칙을 불필요하게 복사하지 않고 `docs/rules/`로 연결해야 한다. 요약이 상세 문서와 충돌하면 상세 문서를 기준으로 요약을 고친다.

- [ ] **Step 5: 검증 수정 커밋**

검증에서 실제 수정이 있을 때만 관련 파일을 스테이징한다.

```bash
git add README.md AGENTS.md CONTRIBUTING.md docs/README.md docs/rules docs/history/_template.md
git commit -m "docs(rules): 프로젝트 규칙 문서 일관성 보완" \
  -m "문서 간 링크와 중복 표현을 점검한다.

진입 문서와 상세 기준 사이의 충돌 없이 규칙을 탐색할 수 있도록
정리한다."
```

수정이 없으면 이 커밋은 만들지 않는다.

- [ ] **Step 6: 최종 상태를 확인**

Run: `git status --short --branch`

Expected: 이 계획에서 만든 변경은 모두 커밋됐고, 범위 밖 사용자 변경이나 원래부터 존재한 변경만 별도로 식별된다.

Run: `git log --oneline 0e47334..HEAD`

Expected: 각 커밋 제목이 명사형이며 Task 1~5의 목적별 문서 커밋이 확인된다.

## PR 이력 후속 단계

이 구현을 원격 PR로 올리도록 사용자가 별도로 요청하면 다음 순서로 진행한다.

1. 구현 브랜치를 push한다.
2. Draft PR을 생성해 PR 번호를 확보한다.
3. `docs/history/YYYY-MM-DD-pr-<number>-project-rules.md`를 `_template.md` 기준으로 작성한다.
4. 실제 커밋과 검증 결과만 기록해 `docs(history): 프로젝트 규칙 체계 도입 기록 추가` 커밋을 만든다.
5. 이력 커밋을 push한 뒤 PR을 Ready for review로 전환할지 사용자에게 확인한다.

push, PR 생성, Ready 전환과 병합은 구현 요청만으로 자동 수행하지 않는다.
