import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { DB } from '../db/db.provider'
import { attempts, examSessions } from '../db/schema'

import type { ChoiceKey } from '@aws-study/shared'
import type { Db, DbOrTx, Tx } from '../db/db.provider'

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
export function sessionAttemptsQuery(db: DbOrTx, sessionId: string) {
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
 * 조건을 함수 하나로 둔 이유는 다섯 경로(조회·잠금·커서·삭제·종료)가 각자 `and(...)`를 쓰면
 * **한 곳에서 `user_id`가 빠져도 나머지가 멀쩡해 보이기** 때문이다.
 *
 * **이 모듈 밖에 같은 모양이 하나 더 있다** — `attempts`의 `lockSessionQuery`가 자기 컬럼만
 * 골라 같은 조건을 직접 쓴다. 둘을 한 함수로 합치지 않는 대신 `exam-ownership.spec.ts`가
 * 둘을 같은 목록에 넣어 `user_id` 절을 함께 센다.
 *
 * 서비스를 치는 스펙은 이걸 못 잡는다 — 리포지토리를 스텁으로 두므로 조건이 빠져도 404가
 * 그대로 나온다 (2026-09-07 뮤테이션 실측). 잡는 것은 아래 쿼리 함수들의 `.toSQL()`이다.
 */
export function ownedSession(sessionId: string, userId: string) {
  return and(eq(examSessions.id, sessionId), eq(examSessions.userId, userId))
}

/**
 * `:id`를 받는 다섯 쿼리(조회·잠금·커서·삭제·종료)를 `Db`를 받는 함수로 뺀 이유는 하나다 — **`.toSQL()`로 조건이 실제로
 * 붙었는지를 스펙이 세기 위해서다.** 리포지토리 메서드 안에 두면 `await`이 접속을 시도해
 * 스펙이 문자열을 볼 수 없고, 서비스를 치는 스펙은 리포지토리를 스텁으로 두므로
 * **조건이 통째로 빠져도 전부 통과한다** (2026-09-07 뮤테이션으로 실측).
 */
export function findSessionQuery(db: DbOrTx, sessionId: string, userId: string) {
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

/**
 * 같은 조회에 행 잠금을 건다. **이것과 `attempts`의 같은 잠금이 짝이 되어**
 * `POST /attempts`와 `finish`를 직렬화한다 — 잠금이 없으면 `finish`가 답안을 읽은 뒤
 * 커밋된 답이 `score`에는 빠지고 `results`에는 들어 저장된 상태가 갈린다 (SJO-53).
 *
 * 풀러(:6543)에서 성립하는 것을 실측했다 — 트랜잭션 모드가 못 쓰는 것은 prepared statement
 * 같은 **세션 수준** 기능이고 행 잠금은 트랜잭션 수명이다 (`docs/03` 「데이터베이스 연결」).
 *
 * **반드시 트랜잭션 안에서 부른다.** 밖에서 부르면 그 문장이 끝나는 즉시 잠금이 풀려
 * 아무것도 막지 못하면서 막는 것처럼 보인다.
 */
export function lockSessionQuery(db: DbOrTx, sessionId: string, userId: string) {
  return findSessionQuery(db, sessionId, userId).for('update')
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
 * `finished_at is null`이 이미 끝난 세션에 점수를 덮어쓰지 못하게 한다.
 *
 * **세션 잠금(SJO-53)이 들어온 뒤 이 절은 이 경로에서 잉여다** — 2026-09-08 뮤테이션 실측:
 * 절을 지워도 경합 하네스 4조건이 전부 통과한다(두 기기 동시 종료 포함). 진 쪽의
 * `lockSession`이 커밋된 행을 다시 읽어 먼저 409를 내기 때문이다.
 *
 * 그래도 지우지 않는다 — 잠금 **밖에서** 이 문장을 부르는 호출자가 생기면 그때는 이것뿐이고,
 * 그 호출자는 자기가 마지막 방어선을 지나간 줄 모른다. `deleteSessionQuery`의 같은 절은
 * 잉여가 아니다: 삭제 경로는 잠그지 않는다.
 */
export function finishSessionQuery(db: DbOrTx, sessionId: string, userId: string, score: number) {
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
  async findSessionAttempts(sessionId: string, db: DbOrTx = this.db): Promise<SessionAttemptRow[]> {
    return sessionAttemptsQuery(db, sessionId) as Promise<SessionAttemptRow[]>
  }

  /** `finish`가 잠금 → 답안 읽기 → 확정을 한 트랜잭션으로 묶는 자리 (SJO-53). */
  async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(work)
  }

  /** 트랜잭션 안에서만 부른다 — `lockSessionQuery` 주석 참조. */
  async lockSession(
    sessionId: string,
    userId: string,
    tx: Tx,
  ): Promise<ExamSessionRow | undefined> {
    const rows = await lockSessionQuery(tx, sessionId, userId)

    return rows[0]
  }

  async updateCursor(sessionId: string, userId: string, cursor: number): Promise<void> {
    await updateCursorQuery(this.db, sessionId, userId, cursor)
  }

  /**
   * `attempts.session_id`가 `on delete cascade`라 답안도 함께 사라진다 (`docs/05`).
   *
   * **삭제 경로는 세션을 잠그지 않으므로 `finished_at is null`이 여기서는 진짜 방어선이다**
   * (`finishSession`에서는 잠금이 들어와 잉여가 됐다 — `finishSessionQuery` 주석). 서비스의
   * 선조회와 이 문장 사이가 열려 있어, A가 `finish`하는 동안 B가 `DELETE`를 보내면 B의
   * 선조회는 `finishedAt = null`을 보고 통과한다. 그러면 **점수까지 확정된 세션이 답안째
   * 사라진다.** 0행이면 서비스가 409로 옮긴다.
   */
  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const deleted = await deleteSessionQuery(this.db, sessionId, userId)

    return deleted.length > 0
  }

  /**
   * `finished_at`과 `score`를 한 문장에서 함께 채운다 — `exam_sessions_finished` check가
   * 둘이 같이 차거나 같이 비기를 요구한다 (`docs/05` 「exam_sessions」).
   *
   * **잠긴 트랜잭션 안에서 부른다** (`ExamsService.finishExam`). 밖에서 부르면 남는 방어가
   * `finished_at is null` 하나뿐이다 — 그 조건을 왜 그래도 두는지는 `finishSessionQuery` 주석.
   */
  async finishSession(
    sessionId: string,
    userId: string,
    score: number,
    db: DbOrTx = this.db,
  ): Promise<boolean> {
    const updated = await finishSessionQuery(db, sessionId, userId, score)

    return updated.length > 0
  }
}
