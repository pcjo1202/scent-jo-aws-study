---
description: 현재 브랜치를 main으로 향하는 PR로 만든다. Linear 이슈에 자동 연결되고 PR URL을 이슈에 첨부한다.
argument-hint: '[SJO-번호(선택 — 브랜치명에서 추론)]'
allowed-tools: Bash(git status:*), Bash(git log:*), Bash(git push:*), Bash(git branch:*), Bash(gh pr:*), Bash(gh auth:*)
---

# /git:pr

## 컨벤션

- base는 **`main`**. `develop`은 없다
- **리뷰어를 지정하지 않는다** — 솔로다. 리뷰는 `/done`의 `code-reviewer`·`design-reviewer` 서브에이전트가 한다
- 머지는 **merge commit**(`gh pr merge --merge`). **squash를 쓰지 않는다** — 커밋 하나하나가 verify를 통과한 태스크 단위인데 squash하면 그 단위가 사라진다
- PR 제목: `[SJO-N] <한국어 요약>` — ID를 제목에 넣는 것이 Linear 연결의 이중 안전장치다

## Linear 연결

본문 첫 줄에 **연결 전용 매직워드**를 쓴다.

```
Ref SJO-31
```

**`Fixes` · `Closes` 같은 닫는 매직워드를 쓰지 않는다.** 머지 시 이슈가 자동으로 Done이 되어 `/done`의 DoD 실검증·증거 코멘트 게이트를 우회한다. 이 레포에서 Done으로 바꾸는 경로는 `/done` 하나다.

## 절차

1. `git status`로 미커밋 변경을 확인한다. 있으면 `/git:commit`을 먼저 실행한다.
2. 브랜치명에서 `sjo-<번호>`를 추출한다. 없으면 중단하고 사유를 보고한다 — 연결할 이슈가 없는 PR은 만들지 않는다.
3. `git log origin/main..HEAD`로 이번 PR의 커밋 범위를 확인한다.
4. **본문 작성** — 아래 형식. 이슈의 완료 정의를 그대로 옮기지 말고 **실제로 실행한 검증 결과**를 적는다.
5. 초안을 사용자에게 보이고 **컨펌**받는다.
6. `git push -u origin <branch>` 후 `gh pr create --base main --assignee "@me"`.
7. **PR URL을 Linear 이슈에 첨부한다** — `save_issue`의 `links`에 `{url, title: "PR #N"}`. GitHub 연동이 꺼져 있어도 이 경로는 동작한다.
8. 결과 출력 — PR 번호·URL·연결된 이슈.

## 본문 형식

```markdown
Ref SJO-31

## 무엇을
<한 문단>

## 검증
- `pnpm typecheck` 통과
- `pnpm test` 통과 (N개)

## 참고
<기각한 대안, 남긴 한계 — 없으면 생략>
```

## 전제

Linear ↔ GitHub 연동이 켜져 있어야 자동 링크(브랜치명·제목·매직워드)가 동작한다. **연동이 꺼져 있어도 7번의 `links` 첨부는 동작하므로 이슈와 PR은 항상 이어진다.**
