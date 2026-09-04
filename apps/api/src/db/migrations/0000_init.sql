-- docs/05-database.md 「스키마」에서 그대로 옮긴 것이다. 이 파일이 DB의 정본이고
-- src/db/schema.ts는 컬럼만 다시 적어 Drizzle 쿼리에 타입을 준다.
-- 적용된 마이그레이션은 수정하지 않는다 — 새 파일만 추가한다 (apps/api/CLAUDE.md).

create table exam_sessions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null,
  question_ids  int[]       not null,
  content_version text      not null,
  cursor        int         not null default 0,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  score         int,

  constraint exam_sessions_size      check (cardinality(question_ids) = 65),
  constraint exam_sessions_cursor    check (cursor between 0 and cardinality(question_ids) - 1),
  constraint exam_sessions_score     check (score is null or score between 0 and 65),
  constraint exam_sessions_finished  check ((finished_at is null) = (score is null))
);

create index exam_sessions_user_started_idx
  on exam_sessions (user_id, started_at desc);

-- 사용자당 진행 중 세션은 최대 1개
create unique index exam_sessions_one_active_idx
  on exam_sessions (user_id)
  where finished_at is null;

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

create table study_progress (
  user_id           uuid        primary key,
  last_question_id  int         not null default 0,
  updated_at        timestamptz not null default now(),

  constraint study_progress_range check (last_question_id between 0 and 1019)
);
