# AWS SAA-C03 학습 앱

## 문서

**루트** — 작업을 시작하기 전에 읽는다. 제약이 걸린다.

| | |
|---|---|
| `CLAUDE.md` | 이 파일. 어기기 쉬운 규칙 |
| `MEMORY.md` | 외부 상태의 현재값 (CDN 버전, 마이그레이션, 인프라) |
| `TASKS.md` | Linear 포인터 + v1 보류 목록. 작업 관리는 Linear(`SJO-*`)에서 |
| `DESIGN.md` | 디자인 시스템. UI를 건드리면 먼저 본다 |

**`docs/`** — 결정을 내릴 때 펼친다.

| | |
|---|---|
| `01-requirements` | 배경·범위·성공 기준 |
| `02-features` | 화면과 기능 |
| `03-architecture` | 구조·배포·CDN·리스크 |
| `04-data-model` | 정적 데이터 스키마·추출 파이프라인 |
| `05-database` | 테이블·API 계약 |
| `06-environment` | 환경변수·시크릿 |
| `07-infrastructure` | 인프라 셋업 런북 |
| `08-testing` | 테스트 전략 |
| `data-changelog` | 데이터 버전 변경 이력 |

## 어기기 쉬운 규칙

- **`data/`를 커밋하지 않는다.** 저작권 자료이고 이 레포는 **public**이다. `.gitignore`에 있지만 `git add -f`로 뚫지 않는다.
- **Drizzle 초기화에 `prepare: false`가 없으면 런타임에 터진다.** Supavisor 트랜잭션 풀러(:6543)는 prepared statement를 지원하지 않는다.
- **추출 데이터의 원본은 CDN이다. git에 없다.** 로컬 `data/`가 비었으면 `pnpm data:pull`.
- **데이터를 고치면 `v2` 경로에 새로 올린다.** 기존 버전을 덮어쓰지 않는다. 되돌릴 방법이 manifest 한 줄뿐이다.
- **채점은 서버가 한다.** `catalog` 모듈이 CDN 인덱스의 정답으로 판정한다. 클라이언트가 보낸 `isCorrect`를 믿지 않는다.
- **service role key를 `NEXT_PUBLIC_`에 넣지 않는다.** RLS를 켜지 않았으므로 유출 시 DB가 통째로 열린다.
- **정오를 색으로만 표시하지 않는다.** 아이콘·텍스트를 병기한다.

## 작업 흐름 (Linear)

작업은 Linear 이슈(`SJO-*`) 단위로 진행한다. 상태 갱신은 세션 중 Linear MCP로 직접 한다.

- **시작**: 이슈를 `In Progress` + `me` 할당. 동시 In Progress는 최대 2개
- **작업 중**: 태스크 하나 끝날 때마다 이슈 본문 체크박스를 `patch`로 `[x]` 갱신. 커밋 메시지에 `(SJO-N)`
- **완료**: 체크박스가 다 찼다고 닫지 않는다 — **이슈의 완료 정의를 실제로 검증한 뒤** `Done`. 검증 결과를 코멘트로 한 줄 남긴다
- 외부 상태(CDN·인프라·마이그레이션)가 바뀌었으면 `MEMORY.md`를 같이 갱신한다

## 외부 상태를 바꿨으면 MEMORY.md를 갱신한다

CDN 배포, 마이그레이션 적용, Vercel/Supabase/AWS 설정 변경은 코드에 흔적이 남지 않는다. 바꿨으면 그 자리에서 적는다.
