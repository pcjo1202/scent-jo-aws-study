# AWS SAA-C03 학습 앱

## 명령어

```bash
pnpm dev          # web + api 동시 실행 (turbo)
pnpm build        # 전체 빌드
pnpm typecheck    # 전체 타입체크 — 커밋 전 최소 검증
```

<!-- data:pull / data:verify / data:publish 는 E1에서 생기면 여기 추가 -->

## 문서

**루트** — 작업을 시작하기 전에 읽는다. 제약이 걸린다.

| | |
|---|---|
| `CLAUDE.md` | 이 파일. 어기기 쉬운 규칙 |
| `MEMORY.md` | 외부 상태의 현재값 (CDN 버전, 마이그레이션, 인프라) |
| `TASKS.md` | Linear 포인터 + v1 보류 목록. 작업 관리는 Linear(`SJO-*`)에서 |
| `DESIGN.md` | 디자인 시스템. UI를 건드리면 먼저 본다 |
| `LESSONS.md` | 실수·혼동 기록. `/lesson`으로만 추가, append-only |

**`docs/`** — 결정을 내릴 때 펼친다.

| | |
|---|---|
| `01-requirements` | 배경·범위·운영 환경·가정·성공 기준·미해결 사항 |
| `02-features` | 화면과 기능 |
| `03-architecture` | 구조·배포·CDN·리스크 |
| `04-data-model` | 정적 데이터 스키마·추출 파이프라인 |
| `05-database` | 테이블·API 계약 |
| `06-environment` | 환경변수·시크릿 |
| `07-infrastructure` | 인프라 셋업 런북 |
| `08-testing` | 테스트 전략 |
| `09-agent-workflow` | 에이전트 워크플로 (검증 게이트·`/done`) |
| `data-changelog` | 데이터 버전 변경 이력 |

## 어기기 쉬운 규칙

- **`data/`를 커밋하지 않는다.** 저작권 자료이고 이 레포는 **public**이다. `.gitignore`에 있지만 `git add -f`로 뚫지 않는다.
- **원문 텍스트를 어디에도 옮기지 않는다.** 문제 지문·해설 원문을 docs/·Linear 이슈·커밋 메시지에 인용하지 않는다. 문항은 번호로만 지칭한다.
- **실제 CDN 경로(랜덤 프리픽스 포함)를 커밋하지 않는다.** URL을 아는 사람은 데이터를 받을 수 있다. `.env.example`에도 값은 비운다.
- **Drizzle 초기화에 `prepare: false`가 없으면 런타임에 터진다.** Supavisor 트랜잭션 풀러(:6543)는 prepared statement를 지원하지 않는다.
- **추출 데이터의 원본은 CDN이다. git에 없다.** 로컬 `data/`가 비었으면 `pnpm data:pull`.
- **데이터를 고치면 `v2` 경로에 새로 올린다.** 기존 버전을 덮어쓰지 않는다. 되돌릴 방법이 manifest 한 줄뿐이다.
- **채점은 서버가 한다.** `catalog` 모듈이 CDN 인덱스의 정답으로 판정한다. 클라이언트가 보낸 `isCorrect`를 믿지 않는다.
- **service role key를 `NEXT_PUBLIC_`에 넣지 않는다.** RLS를 켜지 않았으므로 유출 시 DB가 통째로 열린다.
- **정오를 색으로만 표시하지 않는다.** 아이콘·텍스트를 병기한다.
- **CDN publish 전 `pnpm data:verify`를 통과해야 한다.** 검증 안 된 데이터가 올라가면 v2 재배포다.

## 언어·스타일

- 응답·문서·커밋 메시지는 한국어. 코드 식별자는 영어
- 코드 주석은 코드가 말할 수 없는 제약만 적는다
- UI 문구는 DESIGN.md 용어표를 따른다 (예: "오답/정답", "오답 복습")

## 작업 흐름 (Linear)

작업은 Linear 이슈(`SJO-*`) 단위로 진행한다. 상태 갱신은 세션 중 Linear MCP로 직접 한다. 모든 이슈는 같은 루프를 돈다:

1. **시작** — **`/start` 스킬로만 착수한다**: 게이트(동시 2개·차단) → 할당 → 컨텍스트 → 태스크마다 `verify:`가 있는 계획 → 계획을 이슈 코멘트로 기록
2. **구현** — 태스크(체크박스 1개) 단위 사이클: (치명 영역이면 실패하는 테스트 먼저) → 구현 → **계획의 verify 실행** → 통과 시에만 체크박스 `[x]` + 커밋 `(SJO-N)`. verify 실패 상태로 체크하지 않는다. 치명 영역 = 파서·채점·JWT 가드 (`08-testing`)
3. **종료** — **`/done` 스킬로만 닫는다**: DoD 실검증(증거 수집) → 이슈 전체 diff 리뷰(UI 변경 시 design-reviewer 추가) → 리뷰 수정 시 DoD 재검증 → 증거 코멘트 → `Done`. 체크박스가 다 찼다고 닫지 않는다

### 이슈 본문 규칙

1. **모든 이슈에 `**근거** docs/NN 「절」`을 단다.** 화면 이슈도 예외 없다 — 명세가 바뀌었을 때 어느 이슈를 고쳐야 하는지 역추적할 수 있어야 한다
2. **의존은 Linear 관계(blocked by)로 건다.** 본문에는 *왜* 막히는지만 적는다. 산문으로만 적으면 필터도 정렬도 안 되고, 막힌 이슈를 실수로 착수한다
3. **화면 이슈는 빈 상태·오류 경로를 별도 체크박스로 둔다.** 정상 경로만 적으면 구현 중에 임의로 정해져서 명세와 코드가 갈라진다

외부 상태(CDN·인프라·마이그레이션)가 바뀌었으면 그 자리에서 `MEMORY.md`를 갱신한다.

**세션 운영: 이슈 하나 = 세션 하나.** `/done` 후 세션을 끝내고 다음 이슈는 새 세션에서 `/start`. 재개에 필요한 건 전부 밖에 있다(Linear 계획·유언장 코멘트, MEMORY.md, LESSONS.md). 이슈 도중에 끊어야 하면 `/context-save`.

## 스킬 라우팅

작업 유형에 맞는 스킬을 먼저 부른다. 역할이 겹치면 이 표가 우선한다.

| 상황 | 사용 |
|---|---|
| 이슈 착수 / 종료 | `/start` / `/done` (위 작업 흐름) |
| 새 기능·설계 논의, 명세에 없는 결정 | `superpowers:brainstorming` — 설계 승인 전 구현 금지 |
| 버그·원인 불명 동작 | `superpowers:systematic-debugging` — 재현 먼저, 추측 수정 금지 |
| 구현 스타일 | **ponytail full** 기준: 최소 diff, YAGNI, 사다리(필요한가→재사용→stdlib→최소 구현) |
| 웹 조사 | websearch. 브라우저 조작은 `/browse` |
| 화면 실동작 확인·QA | `/qa` (gstack) |
| 코드 리뷰 | `/done` 안의 code-reviewer·design-reviewer로 통일 — gstack `/review`는 문서 점검 등 특수 목적에만 |
| 라이브러리·프레임워크 API 질문 (Next·Nest·Drizzle·Supabase) | **context7 MCP** — websearch보다 우선 |
| React·Next 코드 작성·리팩토링 | **react-best-practices 스킬** (로컬 설치, git 미포함) — 워터폴·번들 규칙 우선 |
| Vercel 배포 문제·설정 | **vercel:deployment-expert** 에이전트 |
| PDF 추출·파싱 (E1·E2) | **document-skills:pdf** |
| 라이브 화면의 시각 품질 검토 | `/design-review` (gstack) — 코드 레벨 DESIGN.md 준수는 design-reviewer |
| 작업 중 실수·혼동 발견 | **`/lesson`** — 즉시 LESSONS.md에 기록, 2회 반복 시 규칙·훅 승격 |
| 같은 실수가 규칙으로도 반복되면 | **hookify**로 훅 승격 |
| 세션 마감·재개 | `/context-save` · `/context-restore` |

**쓰지 않는 것**: `/ship`·`/land-and-deploy`(main 직접 커밋), `/spec`·`/autoplan`·`/plan-*-review`(Linear 이슈 + docs/가 대체), `/investigate`(systematic-debugging으로 통일). 제안이 떠도 따르지 않는다.

## 수정 전 논의가 필요한 파일

- `docs/data-changelog.md` — append-only. 과거 항목을 고치지 않는다
- `.mcp.json` — 논의 후 수정
- 마이그레이션 파일 — 적용된 마이그레이션은 수정 금지, 새 파일 추가만

## 외부 상태를 바꿨으면 MEMORY.md를 갱신한다

CDN 배포, 마이그레이션 적용, Vercel/Supabase/AWS 설정 변경은 코드에 흔적이 남지 않는다. 바꿨으면 그 자리에서 적는다.
