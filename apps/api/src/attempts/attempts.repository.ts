import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'

import { DB } from '../db/db.provider'
import { attempts, examSessions, studyProgress } from '../db/schema'

import type { AttemptSource, ChoiceKey } from '@aws-study/shared'
import type { Db, DbOrTx, Tx } from '../db/db.provider'

export type AttemptRow = {
  userId: string
  questionId: number
  sessionId: string | null
  source: AttemptSource
  selected: ChoiceKey[]
  isCorrect: boolean
  durationMs?: number
  /** 오프라인 큐 재전송만 넘긴다 — 없으면 DB의 `now()`가 쓰인다 (`docs/05` 「batch」). */
  createdAt?: Date
}

export type SessionRow = { questionIds: number[]; finishedAt: Date | null }

/**
 * 포인터는 뒤로 가지 않는다 (`docs/05` 「study_progress」). `greatest()`의 왼쪽은
 * 충돌한 **기존 행**의 값이라 되돌아가서 다시 풀어도 진도가 깎이지 않는다.
 */
export function advancePointerQuery(db: Db, userId: string, questionId: number) {
  return db
    .insert(studyProgress)
    .values({ userId, lastQuestionId: questionId })
    .onConflictDoUpdate({
      target: studyProgress.userId,
      set: {
        lastQuestionId: sql`greatest(${studyProgress.lastQuestionId}, ${questionId})`,
        updatedAt: sql`now()`,
      },
    })
}

/**
 * 소유자 조건을 쿼리에 넣는다 — 남의 세션은 「없는 것」으로 나와야 404가 된다.
 * 찾은 뒤에 소유자를 비교하면 403과 404가 갈리고, 그 차이가 존재 여부를 흘린다.
 *
 * **`for update`가 이 파일에서 유일하게 경합을 막는 줄이다.** 잠금 없이 조회만 하면 검사와
 * insert 사이가 열려, 그 창에 `finish`가 답안을 읽고 확정해 버리면 이 답이 `score`에는
 * 빠지고 나중 `results`에는 들어 저장된 상태가 갈린다 (`docs/05` 「세션 채점」).
 * `exams`의 `lockSessionQuery`가 같은 행을 같은 방식으로 잠근다 — 둘이 짝이라 한쪽만
 * 잠그면 아무것도 직렬화되지 않는다.
 *
 * 쿼리를 `Db`를 받는 함수로 뺀 이유는 `.toSQL()`로 그 절이 실제로 붙었는지를 스펙이 세기
 * 위해서다 — 서비스를 치는 스펙은 리포지토리를 스텁으로 두므로 절이 빠져도 전부 통과한다.
 */
export function lockSessionQuery(db: DbOrTx, sessionId: string, userId: string) {
  return db
    .select({ questionIds: examSessions.questionIds, finishedAt: examSessions.finishedAt })
    .from(examSessions)
    .where(and(eq(examSessions.id, sessionId), eq(examSessions.userId, userId)))
    .for('update')
}

@Injectable()
export class AttemptsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async insertAttempt(row: AttemptRow, db: DbOrTx = this.db): Promise<void> {
    await db.insert(attempts).values(row)
  }

  /** exam 경로가 잠금 → 검사 → insert를 한 트랜잭션으로 묶는 자리 (SJO-53). */
  async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(work)
  }

  /** 트랜잭션 안에서만 부른다 — 밖에서는 문장이 끝나는 즉시 잠금이 풀린다. */
  async lockSession(sessionId: string, userId: string, tx: Tx): Promise<SessionRow | undefined> {
    const rows = await lockSessionQuery(tx, sessionId, userId)

    return rows[0]
  }

  async advancePointer(userId: string, questionId: number): Promise<void> {
    await advancePointerQuery(this.db, userId, questionId)
  }
}
