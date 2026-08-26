# 05. 데이터베이스 설계 및 API 계약

가변 데이터(사용자별 진도·시도·세션)만 다룬다. 문제·노트·해부서는 CDN에 있고 DB에 없다 (`04-data-model.md`).

## 설계 원칙

**1. 시도는 추가만 한다 (append-only)**

`attempts`는 수정·삭제하지 않는다. 같은 문항을 다시 풀면 행이 하나 더 쌓인다. "현재 상태"는 최신 행으로 도출한다. 유일한 예외는 모의고사 포기(`DELETE /exams/:id`)로, 세션과 함께 그 세션의 시도도 cascade 삭제된다.

- 기기 간 충돌이 구조적으로 발생하지 않는다. 두 기기에서 동시에 풀어도 둘 다 기록될 뿐이다
- 나중에 필요한 지표를 원장에서 다시 계산할 수 있다 (몇 번째 시도에 맞혔는가, 정답률 추이 등)

**2. 파생 요약 테이블을 두지 않는다**

오답 목록·풀이 상태·정답률을 전부 `attempts` 쿼리로 도출한다. 사용자 1명, 문항 1019개 규모에서 집계 비용은 무시할 수 있다. 느려지면 그때 요약 테이블을 추가한다.

**3. 문제 데이터에 대한 외래키가 없다**

`question_id`는 그냥 정수다. 참조 대상이 DB가 아니라 CDN에 있다. 무결성은 애플리케이션이 책임진다 (`catalog` 모듈이 1~1019 범위와 실재 여부를 검증한다).

**4. RLS를 v1에서 켜지 않는다**

Nest가 service role로 접속하고 JWT 검증과 소유권 확인을 직접 한다. RLS를 살리려면 사용자 JWT를 Postgres 세션에 전달해야 하는데(`SET LOCAL request.jwt.claims`), 트랜잭션 풀러 환경에서 관리 비용이 커진다.

대신 **모든 쿼리가 `user_id` 조건을 반드시 포함하도록 리포지토리 레이어에서 강제한다.** 사용자가 1명이므로 유출 대상 자체가 없다.

이 방어는 Nest 경로만 막는다. **Supabase Data API(PostgREST)는 비활성화한다** — RLS가 없는 상태에서는 공개된 anon 키만으로 REST 경로(`/rest/v1/*`)가 열리기 때문이다. 셋업 체크리스트는 `07-infrastructure.md`.

> 다중 사용자로 확장하면 이 결정을 먼저 뒤집어야 한다.

**5. 사용자 테이블을 따로 만들지 않는다**

Supabase `auth.users`를 그대로 쓴다. `user_id`는 JWT의 `sub` 클레임(uuid)이다. 프로필 정보가 필요 없다.

## 스키마

### exam_sessions

`attempts`가 참조하므로 먼저 만든다.

```sql
create table exam_sessions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null,
  question_ids  int[]       not null,
  cursor        int         not null default 0,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  score         int,

  constraint exam_sessions_size      check (cardinality(question_ids) = 65),
  constraint exam_sessions_cursor    check (cursor between 0 and cardinality(question_ids)),
  constraint exam_sessions_score     check (score is null or score between 0 and 65),
  constraint exam_sessions_finished  check ((finished_at is null) = (score is null))
);

create index exam_sessions_user_started_idx
  on exam_sessions (user_id, started_at desc);

-- 사용자당 진행 중 세션은 최대 1개
create unique index exam_sessions_one_active_idx
  on exam_sessions (user_id)
  where finished_at is null;
```

`question_ids`는 세션 생성 시점에 고정된다. 추첨 결과를 배열로 박아 두면 나중에 문제 데이터가 `v2`로 바뀌어도 그 세션이 무엇을 물었는지 그대로 남는다.

**부분 유니크 인덱스**가 "진행 중 세션은 하나"를 DB 레벨에서 보장한다. 애플리케이션 로직에 의존하지 않는다.

`exam_sessions_finished` 제약은 `finished_at`과 `score`가 항상 같이 채워지거나 같이 비도록 강제한다. 채점 도중 중단된 어중간한 상태가 남지 않는다.

### attempts

```sql
create table attempts (
  id           bigserial   primary key,
  user_id      uuid        not null,
  question_id  int         not null,
  session_id   uuid        references exam_sessions(id) on delete cascade,
  source       text        not null,
  selected     text[]      not null,
  is_correct   boolean     not null,
  duration_ms  int,
  created_at   timestamptz not null default now(),

  constraint attempts_question_range check (question_id between 1 and 1019),
  constraint attempts_source         check (source in ('sequential', 'review', 'exam')),
  constraint attempts_selected_size  check (cardinality(selected) between 1 and 3),
  constraint attempts_session_source check ((source = 'exam') = (session_id is not null))
);

-- 최신 시도 조회: 오답 목록, 풀이 상태 맵
create index attempts_user_question_idx
  on attempts (user_id, question_id, created_at desc);

-- 세션 채점
create index attempts_session_question_idx
  on attempts (session_id, question_id, created_at desc)
  where session_id is not null;
```

`attempts_session_source` 제약이 "exam이면 session_id가 있고, exam이 아니면 없다"를 강제한다.

모의고사에서 답을 바꾸면 행이 추가된다. 채점은 세션 안에서 문항별 최신 행을 본다.

`is_correct`는 **서버가 채점해서** 넣는다. 클라이언트가 보낸 값을 믿지 않는다 (→ `catalog` 모듈).

### study_progress

```sql
create table study_progress (
  user_id           uuid        primary key,
  last_question_id  int         not null default 0,
  updated_at        timestamptz not null default now(),

  constraint study_progress_range check (last_question_id between 0 and 1019)
);
```

순차 모드의 이어풀기 포인터. `0`은 아직 시작 안 함을 뜻한다.

`source = 'sequential'`이고 `advancesPointer = true`인 시도가 들어오면 서버가 `last_question_id = greatest(현재, questionId)` 로 갱신한다. 필터 모드 풀이는 `advancesPointer: false`로 보내 포인터를 건드리지 않는다. 별도 엔드포인트를 두지 않는다. 되돌아가서 다시 풀어도 포인터는 뒤로 가지 않는다.

기기 간에는 `greatest`로 단조 증가한다. 사용자가 1명이므로 충분하다.

## 도출 쿼리

진행 중(미완료) 모의고사 세션의 시도는 모든 도출에서 제외한다 — 시험 중 정오가 오답 목록·통계로 새는 것을 막는다. 완료된 세션의 시도는 포함된다 (모의고사 오답도 복습 대상이다).

### 풀이 상태 맵

```sql
select distinct on (question_id) question_id, is_correct
from attempts
where user_id = $1
  and (session_id is null
       or session_id in (select id from exam_sessions where finished))
order by question_id, created_at desc;
```

문항별 최신 시도. 결과에 없는 문항이 "안 푼 것"이다. 최대 1019행.

### 오답 목록

위 쿼리를 감싸 `is_correct = false`만 남긴다.

```sql
select question_id from (
  select distinct on (question_id) question_id, is_correct
  from attempts
  where user_id = $1
  order by question_id, created_at desc
) t
where not is_correct
order by question_id;
```

### 세션 채점

```sql
select distinct on (question_id) question_id, selected, is_correct
from attempts
where session_id = $1
order by question_id, created_at desc;
```

세션의 `question_ids` 65개 중 결과에 없는 문항은 **미응답 → 오답**으로 처리한다.

### 카테고리별 정답률

카테고리는 CDN 인덱스에 있고 DB에 없으므로 **조인할 수 없다.** Nest가 메모리에 캐시한 인덱스와 위의 풀이 상태 맵을 애플리케이션에서 합친다.

이것이 `catalog` 모듈이 존재하는 이유이자, 백엔드가 실질적인 일을 하는 지점이다.

## catalog 모듈

Nest가 CDN 인덱스를 메모리에 캐시한다.

```
부팅 → manifest.json 조회 → index.json 조회 → Map<questionId, IndexEntry> 구축
```

**용도**

| 용도 | 필요한 필드 |
|---|---|
| 답안 채점 | `answer` |
| 카테고리별 통계 | `categories` |
| 문항 id 유효성 검증 | 키 존재 여부 |
| 모의고사 추첨 | 전체 id 목록 |

**캐시 정책**

데이터는 버전 안에서 불변이므로 인스턴스 수명 동안 캐시해도 안전하다. 다만 버전이 올라가면 낡은 인스턴스가 옛 정답으로 채점할 수 있다. 그래서 **manifest만 최대 5분에 한 번 확인**하고, `version`이 바뀌었을 때만 인덱스를 다시 받는다.

Fluid compute가 인스턴스를 따뜻하게 유지하므로 콜드 스타트에서만 약 60KB를 받는다.

## API 계약

모든 엔드포인트는 `Authorization: Bearer <supabase-jwt>` 를 요구한다. `user_id`는 토큰의 `sub`에서 가져오며 **요청 본문에서 받지 않는다.** JWT의 `email`이 `ALLOWED_EMAIL`과 다르면 403 — 로그인은 아무 구글 계정이나 되지만, API는 소유자만 통과시킨다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/health` | 인증 불필요 |
| `GET` | `/me/progress` | 대시보드 요약 |
| `GET` | `/me/question-states` | 문항별 정오 맵 |
| `GET` | `/me/wrong` | 오답 문항 id 목록 |
| `POST` | `/attempts` | 답안 제출 |
| `POST` | `/attempts/batch` | 오프라인 큐 일괄 재전송 |
| `POST` | `/exams` | 세션 생성 (65문항 추첨) |
| `GET` | `/exams` | 세션 목록 |
| `GET` | `/exams/:id` | 세션 상태 + 저장된 답안 |
| `PATCH` | `/exams/:id` | 진행 위치 저장 |
| `DELETE` | `/exams/:id` | 진행 중 세션 포기 (답안까지 삭제) |
| `POST` | `/exams/:id/finish` | 채점 |
| `GET` | `/stats` | 카테고리별 정답률 |

### 주요 요청/응답

```ts
// GET /me/progress
{
  lastQuestionId: number
  solvedCount: number
  wrongCount: number
  activeSessionId: string | null
}

// GET /me/question-states
{ states: Record<number, 'correct' | 'wrong'> }   // 안 푼 문항은 키 없음

// POST /attempts
// 요청
{
  questionId: number
  selected: Array<'A'|'B'|'C'|'D'|'E'>
  source: 'sequential' | 'review' | 'exam'
  sessionId?: string        // source가 'exam'이면 필수
  durationMs?: number
  advancesPointer?: boolean // sequential 전용. 기본 true, 필터 모드는 false
}
// 응답 — sequential | review
{ isCorrect: boolean, answer: Array<'A'|'B'|'C'|'D'|'E'> }
// 응답 — exam (정오를 돌려주지 않는다)
{ accepted: true }

// POST /attempts/batch — 오프라인 큐 재전송
// 요청 — answeredAt(클라이언트 발생 시각)을 created_at으로 기록한다
{ items: Array<{
  questionId: number
  selected: Array<'A'|'B'|'C'|'D'|'E'>
  source: 'sequential' | 'review' | 'exam'
  sessionId?: string
  durationMs?: number
  advancesPointer?: boolean
  answeredAt: string        // ISO 8601
}> }
// 응답 — 항목별 결과. rejected 항목은 클라이언트가 큐에서 버린다 (재시도는 네트워크 오류만)
{ results: Array<{ index: number, status: 'saved' | 'rejected', isCorrect?: boolean }> }

// POST /exams  → 진행 중 세션이 있으면 409
{ id: string, questionIds: number[], cursor: 0 }

// GET /exams/:id
{
  id: string
  questionIds: number[]
  cursor: number
  startedAt: string
  finishedAt: string | null
  score: number | null
  answers: Record<number, Array<'A'|'B'|'C'|'D'|'E'>>   // 문항별 최신 답안
  results: ExamResult[] | null    // 종료된 세션에만. 진행 중이면 null
}

// DELETE /exams/:id  → 진행 중 세션만 삭제 가능. 종료된 세션이면 409
// on delete cascade로 해당 세션의 attempts도 함께 삭제된다
{ deleted: true }

type ExamResult = {
  questionId: number
  selected: Array<'A'|'B'|'C'|'D'|'E'> | null   // null = 미응답
  answer: Array<'A'|'B'|'C'|'D'|'E'>
  isCorrect: boolean
}

// POST /exams/:id/finish
{ score: number, results: ExamResult[] }        // score는 0..65

// GET /stats
{
  byCategory: Array<{
    category: string
    total: number       // 해당 카테고리 전체 문항 수
    solved: number      // 한 번이라도 푼 수
    correct: number     // 최신 시도가 정답인 수
    accuracy: number    // correct / solved, solved가 0이면 0
  }>
}
```

### 오류 응답

```ts
{ statusCode: number, message: string, error: string }
```

| 상황 | 코드 |
|---|---|
| 토큰 없음·만료·서명 불일치 | 401 |
| 남의 세션 접근 | 404 (403이 아니라 404. 존재 여부를 흘리지 않는다) |
| 진행 중 세션이 있는데 새 세션 생성 | 409 |
| 종료된 세션에 답안 제출 | 409 |
| 종료된 세션을 삭제 시도 | 409 |
| `questionId` 범위 밖 / 선택지 키 불일치 | 400 |
| exam 시도의 `questionId`가 세션 `question_ids`에 없음 | 400 |
| JWT의 `email`이 `ALLOWED_EMAIL`과 불일치 | 403 |

## Nest 모듈 구성

```
apps/api/src/
├─ main.ts                  bootstrap + CORS + ValidationPipe
├─ app.module.ts
├─ auth/
│  ├─ jwks.service.ts       공개키 조회·캐시
│  ├─ supabase-jwt.guard.ts 전역 가드
│  └─ current-user.decorator.ts
├─ catalog/
│  └─ catalog.service.ts    manifest·index 캐시, 채점, 추첨, 검증
├─ attempts/
├─ exams/
├─ progress/
├─ stats/
└─ db/
   ├─ schema.ts             Drizzle 스키마
   ├─ migrations/           순수 SQL
   └─ db.provider.ts        postgres-js { prepare: false }
```

`SupabaseJwtGuard`를 전역 가드로 등록하고 `/health`만 `@Public()`으로 뺀다. 가드를 붙이는 걸 잊어서 뚫리는 사고를 막는다.

`prepare: false`는 트랜잭션 풀러에서 **필수**다. 빠뜨리면 런타임 오류가 난다 (`03-architecture.md` 리스크 표).
