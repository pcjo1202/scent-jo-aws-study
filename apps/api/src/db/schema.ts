/**
 * 컬럼 정의만 둔다 — check 제약·인덱스·외래키는 `migrations/`의 SQL이 정본이고 DB가 강제한다
 * (`docs/05-database.md` 「스키마」). 여기에 다시 적으면 두 벌이 되어 갈라진다.
 * 이 파일이 하는 일은 Drizzle 쿼리에 타입을 주는 것뿐이다.
 */
import { bigserial, boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const examSessions = pgTable('exam_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  questionIds: integer('question_ids').array().notNull(),
  contentVersion: text('content_version').notNull(),
  /** 현재 보고 있는 문항의 0-based 인덱스 (`docs/05` 「exam_sessions」). */
  cursor: integer('cursor').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  score: integer('score'),
})

export const attempts = pgTable('attempts', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').notNull(),
  questionId: integer('question_id').notNull(),
  sessionId: uuid('session_id'),
  source: text('source').notNull(),
  selected: text('selected').array().notNull(),
  isCorrect: boolean('is_correct').notNull(),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const studyProgress = pgTable('study_progress', {
  userId: uuid('user_id').primaryKey(),
  lastQuestionId: integer('last_question_id').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
