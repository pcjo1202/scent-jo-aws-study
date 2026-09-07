import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { DB } from '../db/db.provider'
import { attempts, examSessions } from '../db/schema'

import type { ChoiceKey } from '@aws-study/shared'
import type { Db } from '../db/db.provider'

export type ExamSessionRow = {
  id: string
  questionIds: number[]
  contentVersion: string
  cursor: number
  startedAt: Date
  finishedAt: Date | null
  score: number | null
}

export type ExamSessionListRow = {
  id: string
  startedAt: Date
  finishedAt: Date | null
  score: number | null
}

/** 세션 안에서 문항별 최신 답안 한 건. */
export type SessionAttemptRow = {
  questionId: number
  selected: ChoiceKey[]
  isCorrect: boolean
}

/**
 * 「세션 채점」 도출 쿼리 (`docs/05` 「도출 쿼리」). 문항별 최신 시도 한 행만 남긴다.
 *
 * **`user_id` 조건이 없는 유일한 쿼리다.** `session_id`가 이미 한 사용자의 세션을
 * 가리키고, 서비스가 이 쿼리를 부르기 전에 소유자 조건이 붙은 `findSession`으로 404를
 * 판정한다 — docs의 쿼리도 같은 형태다. 소유권 판정을 여기로 옮기지 않는다.
 *
 * `Db`를 인자로 받는 것은 `.toSQL()`로 정렬 키가 실제로 붙었는지를 스펙이 세기 위해서다.
 *
 * 셋째 정렬 키가 `id`인 이유는 `created_at` 동점이 실제로 생기기 때문이다 — 오프라인 큐가
 * 날짜만 있는 `answeredAt`을 보내면 여러 행이 같은 자정으로 뭉치고, 동점이면 `distinct on`이
 * 어느 행을 남길지 Postgres가 정하지 않아 **옛 답이 나중 답을 이긴다.** 모의고사는 답을
 * 바꿀 수 있으므로(`02-features.md` 「진행」) 이게 곧 오채점이다.
 */
export function sessionAttemptsQuery(db: Db, sessionId: string) {
  return db
    .selectDistinctOn([attempts.questionId], {
      questionId: attempts.questionId,
      selected: attempts.selected,
      isCorrect: attempts.isCorrect,
    })
    .from(attempts)
    .where(eq(attempts.sessionId, sessionId))
    .orderBy(attempts.questionId, desc(attempts.createdAt), desc(attempts.id))
}

/**
 * `:id`로 세션을 찾는 **모든** 경로가 쓰는 단 하나의 조건 (`docs/05` 「RLS를 v1에서 켜지
 * 않는다」). 조회한 뒤에 소유자를 비교하지 않는다 — 그러면 404와 403이 갈리고 그 차이가
 * 존재 여부를 흘린다.
 *
 * 조건을 함수 하나로 둔 이유는 네 경로(조회·커서·삭제·종료)가 각자 `and(...)`를 쓰면
 * **한 곳에서 `user_id`가 빠져도 나머지가 멀쩡해 보이기** 때문이다.
 *
 * 서비스를 치는 스펙은 이걸 못 잡는다 — 리포지토리를 스텁으로 두므로 조건이 빠져도 404가
 * 그대로 나온다 (2026-09-07 뮤테이션 실측). 잡는 것은 아래 쿼리 함수들의 `.toSQL()`이다.
 */
export function ownedSession(sessionId: string, userId: string) {
  return and(eq(examSessions.id, sessionId), eq(examSessions.userId, userId))
}

/**
 * 아래 네 쿼리를 `Db`를 받는 함수로 뺀 이유는 하나다 — **`.toSQL()`로 조건이 실제로
 * 붙었는지를 스펙이 세기 위해서다.** 리포지토리 메서드 안에 두면 `await`이 접속을 시도해
 * 스펙이 문자열을 볼 수 없고, 서비스를 치는 스펙은 리포지토리를 스텁으로 두므로
 * **조건이 통째로 빠져도 전부 통과한다** (2026-09-07 뮤테이션으로 실측).
 */
export function findSessionQuery(db: Db, sessionId: string, userId: string) {
  return db
    .select({
      id: examSessions.id,
      questionIds: examSessions.questionIds,
      contentVersion: examSessions.contentVersion,
      cursor: examSessions.cursor,
      startedAt: examSessions.startedAt,
      finishedAt: examSessions.finishedAt,
      score: examSessions.score,
    })
    .from(examSessions)
    .where(ownedSession(sessionId, userId))
}

/** 정렬이 계약이다 — 대시보드 「최근 모의고사 3개」가 앞에서 세 개를 자른다 (`docs/05`). */
export function listSessionsQuery(db: Db, userId: string) {
  return db
    .select({
      id: examSessions.id,
      startedAt: examSessions.startedAt,
      finishedAt: examSessions.finishedAt,
      score: examSessions.score,
    })
    .from(examSessions)
    .where(eq(examSessions.userId, userId))
    .orderBy(desc(examSessions.startedAt))
}

export function updateCursorQuery(db: Db, sessionId: string, userId: string, cursor: number) {
  return db.update(examSessions).set({ cursor }).where(ownedSession(sessionId, userId))
}

/** 진행 중 세션만 지운다 — 종료된 세션이 답안째 사라지는 경합을 SQL에서 막는다. */
export function deleteSessionQuery(db: Db, sessionId: string, userId: string) {
  return db
    .delete(examSessions)
    .where(and(ownedSession(sessionId, userId), isNull(examSessions.finishedAt)))
    .returning({ id: examSessions.id })
}

/**
 * `finished_at is null`이 **두 기기 동시 종료에서 점수 덮어쓰기를 막는 유일한 방어선**이다.
 * 서비스의 선조회는 잠금이 아니라 조회라 그 사이가 열려 있다.
 */
export function finishSessionQuery(db: Db, sessionId: string, userId: string, score: number) {
  return db
    .update(examSessions)
    .set({ score, finishedAt: sql`now()` })
    .where(and(ownedSession(sessionId, userId), isNull(examSessions.finishedAt)))
    .returning({ id: examSessions.id })
}

@Injectable()
export class ExamsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * 진행 중 세션이 이미 있으면 `exam_sessions_one_active_idx`가 23505로 막는다 —
   * 서비스가 그걸 409로 옮긴다. 미리 조회해서 판정하지 않는 이유는 조회와 삽입 사이가
   * 열려 있어 두 기기가 동시에 시작하면 어차피 인덱스가 판정하기 때문이다.
   */
  async insertSession(row: {
    userId: string
    questionIds: number[]
    contentVersion: string
  }): Promise<string> {
    const [inserted] = await this.db.insert(examSessions).values(row).returning({
      id: examSessions.id,
    })
    if (inserted === undefined) throw new Error('세션 삽입이 행을 돌려주지 않았다')

    return inserted.id
  }

  /** 최근 순. 목록에 `question_ids`를 싣지 않는다 (`docs/05` 「GET /exams」). */
  async listSessions(userId: string): Promise<ExamSessionListRow[]> {
    return listSessionsQuery(this.db, userId)
  }

  async findSession(sessionId: string, userId: string): Promise<ExamSessionRow | undefined> {
    const rows = await findSessionQuery(this.db, sessionId, userId)

    return rows[0]
  }

  /**
   * `selected`가 `text[]`라 drizzle은 `string[]`으로 준다. `ChoiceKey[]`로 좁히는 것이
   * 안전한 이유는 쓰기 경로가 하나뿐이고 거기서 이미 걸러지기 때문이다 —
   * `AttemptsService.loadEntry()`가 `hasOnlyExistingChoices()`로 그 문항에 없는 키를
   * 400으로 막는다. DB에는 enum이 없으므로 이 단언이 유일한 좁히기다.
   */
  async findSessionAttempts(sessionId: string): Promise<SessionAttemptRow[]> {
    return sessionAttemptsQuery(this.db, sessionId) as Promise<SessionAttemptRow[]>
  }

  async updateCursor(sessionId: string, userId: string, cursor: number): Promise<void> {
    await updateCursorQuery(this.db, sessionId, userId, cursor)
  }

  /**
   * `attempts.session_id`가 `on delete cascade`라 답안도 함께 사라진다 (`docs/05`).
   *
   * `finished_at is null`이 SQL에 붙는 이유는 `finishSession`과 같다 — 서비스의 선조회와
   * 이 문장 사이가 열려 있어, A가 `finish`하는 동안 B가 `DELETE`를 보내면 B의 선조회는
   * `finishedAt = null`을 보고 통과한다. 그러면 **점수까지 확정된 세션이 답안째 사라진다.**
   * 0행이면 서비스가 409로 옮긴다.
   */
  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const deleted = await deleteSessionQuery(this.db, sessionId, userId)

    return deleted.length > 0
  }

  /**
   * `finished_at`과 `score`를 한 문장에서 함께 채운다 — `exam_sessions_finished` check가
   * 둘이 같이 차거나 같이 비기를 요구한다 (`docs/05` 「exam_sessions」).
   *
   * `finished_at is null` 조건이 붙는 이유는 두 기기가 동시에 종료할 때 **두 번째 갱신이
   * 0행을 건드리게** 하기 위해서다. 서비스의 사전 조회만으로는 그 사이가 열려 있어 나중
   * 요청이 앞선 점수를 덮어쓸 수 있다.
   */
  async finishSession(sessionId: string, userId: string, score: number): Promise<boolean> {
    const updated = await finishSessionQuery(this.db, sessionId, userId, score)

    return updated.length > 0
  }
}
