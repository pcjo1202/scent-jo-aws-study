---
name: done
description: Linear 이슈 종료. 이슈를 Done으로 바꾸는 유일한 경로 — DoD 실검증 → 리뷰 → 재검증 → 증거 코멘트 → Done. "SJO-N 완료", "이슈 닫아줘", "작업 끝" 요청에 사용.
---

# /done — 이슈 종료

인자: 이슈 ID (예: `SJO-2`). 없으면 In Progress인 이슈 중에서 확인한다.

0. **정리** — working tree가 clean한지 확인한다. 미커밋 변경이 있으면 커밋하거나 이유를 밝히고 처리한 뒤 진행한다.
1. **DoD 실검증** — 먼저 **공통 게이트**를 이슈와 무관하게 전부 돌린다: `pnpm format:check` · `pnpm typecheck --force` · `pnpm lint` · `pnpm test`. pre-commit 훅이 format을 커밋 시점에 막지만 `--no-verify`와 훅 미설치 clone으로 뚫리므로 **여기가 마지막 그물**이다 (`docs/10-conventions.md` 「Prettier」). 그 다음 이슈의 완료 정의를 실제로 실행한다. 명령이면 돌리고, **실행한 명령과 출력 요약을 증거로 수집**한다. 통과 못 하면 여기서 중단.
2. **diff 산출** — 이슈 전체 범위: 첫 `(SJO-N)` 커밋의 부모 ~ HEAD. `git log --grep="(SJO-N)" --reverse --format=%H | head -1`의 부모 커밋 기준.
3. **PR 생성** — `/git:pr`. 본문 첫 줄은 **`Ref SJO-N`** (`Fixes`·`Closes` 금지 — 머지 시 자동 종료가 이 스킬의 게이트를 우회한다), 검증 절에는 1번에서 실제로 실행한 명령과 결과를 적는다. 생성 후 **PR URL을 `save_issue`의 `links`로 이슈에 첨부**한다.
4. **리뷰** — 그 diff로 `pr-review-toolkit:code-reviewer` 서브에이전트 실행. `apps/web`의 컴포넌트·스타일 변경이 포함되면 `design-reviewer`도 실행. P1은 수정 필수, P2는 수정하거나 보류 사유를 코멘트로 남긴다.
5. **재검증** — 리뷰로 코드를 고쳤으면 **DoD를 다시 실행한다.** 리뷰 반영이 DoD를 깨는 일은 흔하다. 수정분은 커밋하고 PR에 push한다.
6. **머지** — `gh pr merge <N> --merge`. **squash 금지** — 커밋 하나하나가 verify를 통과한 태스크 단위인데 squash하면 그 단위가 사라진다.
   **워크트리에서는 `--delete-branch`를 붙이지 않고 `git switch main`도 하지 않는다.** `main`이 메인 워크트리에 이미 체크아웃돼 있어 git이 거부하는데, 그 실패는 **머지가 아니라 그 뒤의 정리 단계**에서 나므로 exit code만 보면 머지가 안 된 것처럼 보인다. 순서는 이렇다:
   1. `gh pr merge <N> --merge`
   2. `gh pr view <N> --json state,mergeCommit` — `MERGED`와 merge commit을 **눈으로 확인한다**
   3. `git push origin --delete <branch>` + `git fetch origin --prune`
   4. 로컬 `main` pull은 **하지 않는다** — 메인 워크트리 소관이다
7. **Linear 갱신** — 체크박스를 patch로 `[x]` → 검증 증거(명령+결과 요약, 리뷰 결과 한 줄)를 코멘트로 → state `Done`.
   코멘트에 **세션 유언장**을 포함한다: 이 세션에만 있는 맥락 — 기각한 대안과 이유, 다음 이슈에 영향 주는 발견 — 을 한 줄씩. 없으면 "유언장: 없음"이라고 쓴다 (생략과 구분).
8. **MEMORY.md** — 외부 상태(CDN·인프라·마이그레이션) 변경이 있었으면 갱신하고 함께 커밋한다.

리뷰는 이슈당 1회가 원칙. 커밋마다 돌리지 않는다.

## gotchas

- 체크박스가 다 찼다는 이유로 닫기 금지 — DoD 실행이 유일한 근거다
- 공통 게이트는 **출력 전문**을 본다 — `typecheck`는 `--force` 없이 다른 워크트리 캐시를 재사용하고(`cached` 수가 0인지 확인), `exit 0`은 "통과"가 아니라 "오류 없음"이다. `pnpm test --force`는 vitest 직행이라 터지므로 `--force`를 붙이지 않는다
- 리뷰 수정 후 재검증(5번) 생략 금지 — 가장 흔하게 새는 단계
- PR 본문에 `Fixes`·`Closes` 금지 — 머지가 이슈를 자동으로 Done으로 만들어 증거 코멘트 없이 닫힌다
- `gh pr merge`가 죽어도 머지는 됐을 수 있다 — 실패 메시지가 **어느 단계 것인지** 먼저 본다. 재시도하면 "이미 머지됨"이 나와 원인을 다시 헷갈린다
- 다음 이슈는 `origin/main`에서 브랜치를 딴다 — 워크트리에서는 로컬 `main`을 갱신하지 않으므로 `git fetch` 후 `origin/main` 기준으로 판다
- 증거 없는 "확인했다" 코멘트 금지 — 실행한 명령과 결과를 남긴다
- MEMORY.md는 잊기 쉽다 — CDN·인프라를 만졌으면 지금 갱신
- 유언장 생략 금지 — 기각한 대안을 안 남기면 다음 세션이 같은 검토를 반복한다
