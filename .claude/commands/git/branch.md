---
description: Linear 이슈에서 작업 브랜치를 만든다. 이슈 ID가 들어가야 Linear가 PR을 자동으로 연결한다.
argument-hint: '<SJO-번호> [type]  (예: SJO-31 chore)'
allowed-tools: Bash(git status:*), Bash(git fetch:*), Bash(git checkout:*), Bash(git branch:*), Bash(git switch:*)
---

# /git:branch

## 컨벤션

```
<type>/sjo-<번호>-<영문-kebab-요약>

feature/sjo-20-study-sequential
fix/sjo-27-accuracy-empty-state
chore/sjo-31-tooling-setup
docs/sjo-30-spec-gaps
```

- **`sjo-<번호>`는 필수다.** Linear가 PR을 이슈에 자동 연결하는 근거가 이것뿐이다
- 요약은 **영문 kebab**. 한글은 URL·CLI에서 깨진다
- **type**: `feature` 새 기능 / `fix` 버그 / `refactor` 동작 동일 구조 개선 / `perf` 성능 / `chore` 빌드·설정·의존성 / `docs` 문서·명세 / `test` 테스트
- base는 항상 **`main`**. `develop`은 없다
- **`main` 직접 커밋 금지**

## 절차

1. 인수의 이슈 ID로 Linear 이슈를 읽어 제목과 마일스톤을 확인한다. type이 없으면 이슈 내용에서 추론해 **사용자에게 컨펌**받는다.
2. `git status`로 미커밋 변경을 확인한다. 있으면 먼저 처리한다.
3. `git fetch origin && git switch -c <type>/sjo-N-<요약> origin/main`
4. 결과 출력 — 브랜치명, base, 연결될 이슈.

## 이슈 없는 변경

**브랜치를 만들지 않는다. 이슈를 먼저 만든다.** ID가 없으면 Linear에 연결되지 않고, 연결되지 않은 변경은 나중에 왜 했는지 추적할 수 없다.
