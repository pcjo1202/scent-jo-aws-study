import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'

import { DB } from '../db/db.provider'
import { attempts, examSessions, studyProgress } from '../db/schema'

import type { AttemptSource, ChoiceKey } from '@aws-study/shared'
import type { Db } from '../db/db.provider'

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

@Injectable()
export class AttemptsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async insertAttempt(row: AttemptRow): Promise<void> {
    await this.db.insert(attempts).values(row)
  }

  /**
   * 소유자 조건을 쿼리에 넣는다 — 남의 세션은 「없는 것」으로 나와야 404가 된다.
   * 찾은 뒤에 소유자를 비교하면 403과 404가 갈리고, 그 차이가 존재 여부를 흘린다.
   */
  async findSession(sessionId: string, userId: string): Promise<SessionRow | undefined> {
    const rows = await this.db
      .select({ questionIds: examSessions.questionIds, finishedAt: examSessions.finishedAt })
      .from(examSessions)
      .where(and(eq(examSessions.id, sessionId), eq(examSessions.userId, userId)))

    return rows[0]
  }

  async advancePointer(userId: string, questionId: number): Promise<void> {
    await advancePointerQuery(this.db, userId, questionId)
  }
}
