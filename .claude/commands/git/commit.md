---
description: 변경을 논리 단위로 묶어 이 레포 컨벤션대로 커밋한다. push는 컨펌 후.
argument-hint: '[추가 지시(선택)]'
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), Bash(git push:*), Bash(git branch:*), Bash(pnpm lint:*), Bash(pnpm format:*), Bash(pnpm typecheck:*)
---

# /git:commit

## 컨벤션

- **`main`에 직접 커밋하지 않는다.** 현재 브랜치가 `main`이면 중단하고 `/git:branch`를 안내한다
- 형식: `<type>: <요약>` — scope가 의미 있으면 `<type>(<scope>): <요약>`
- **한국어 개조식.** 구어체(`~합니다`)를 쓰지 않는다 — 기존 커밋 전부가 개조식이다
- 이슈 참조는 **`(SJO-N)`** 을 요약 끝에 붙인다. GitHub Issues를 쓰지 않으므로 `Closes #N`은 쓰지 않는다
- **type**: `feat` `fix` `refactor` `perf` `chore` `docs` `test` `style`
- 커밋은 **태스크(체크박스 1개) 단위**로 잘게. verify를 통과한 시점이 커밋 시점이다

```
feat(api): POST /attempts 구현 (SJO-15)

서버가 인덱스의 정답으로 채점하고 sequential일 때만 포인터를 갱신한다.
클라이언트가 보낸 isCorrect는 무시한다.
```

- **body는 "무엇을 왜"**. 코드가 말하는 것을 되풀이하지 않는다

## 절차

1. **브랜치 확인** — `main`이면 중단.
2. **검증** — `pnpm typecheck`. `lint` 스크립트가 있으면 `pnpm lint`도. 실패하면 `pnpm format` 후 재시도, 그래도 실패하면 사용자에게 알리고 중단한다.
3. `git status` · `git diff`로 변경을 분석한다.
4. **논리 단위로 그룹핑** — 같은 태스크는 한 커밋, 설정·문서는 별도 커밋.
5. `git log --oneline -10`으로 최근 스타일을 확인한다.
6. 그룹별로 **해당 파일만** `git add <파일들>`. **`git add -A` · `git add .` 금지.** HEREDOC으로 커밋한다.
7. **push는 컨펌 후.** 커밋 결과를 보여주고 승인받는다.

## 하지 않을 것

- 저작권 자료(`data/`, `tests/fixtures/`, `*.pdf`)를 `git add -f`로 뚫지 않는다
- 문제 지문·해설 원문을 커밋 메시지에 인용하지 않는다. 문항은 번호로만
- 실제 CDN 경로(랜덤 프리픽스)를 커밋하지 않는다
