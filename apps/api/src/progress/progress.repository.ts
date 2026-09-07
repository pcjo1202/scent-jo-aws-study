import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm'

import { DB } from '../db/db.provider'
import { attempts, examSessions, studyProgress } from '../db/schema'

import type { Db } from '../db/db.provider'

/** 문항별 최신 시도의 정오. 여기 없는 문항이 「안 푼 것」이다. */
export type QuestionState = { questionId: number; isCorrect: boolean }

/**
 * 풀이 상태 맵 (`docs/05` 「도출 쿼리」). 문항 번호 오름차순으로 나온다.
 *
 * **도출은 이 쿼리 하나뿐이다.** 오답 목록·`solvedCount`·카테고리별 정답률은 전부 이
 * 결과를 접어서 만든다 — 「미완료 exam 세션 제외」가 엔드포인트마다 다시 쓰이는 조건이면
 * 한 곳이 빠져도 화면은 멀쩡하고 시험 중 정오만 조용히 샌다.
 *
 * `Db`를 인자로 받는 것은 `.toSQL()`로 이 조건이 실제로 붙었는지를 스펙이 세기 위해서다.
 */
export function questionStatesQuery(db: Db, userId: string) {
  const finishedSessionIds = db
    .select({ id: examSessions.id })
    .from(examSessions)
    .where(isNotNull(examSessions.finishedAt))

  return db
    .selectDistinctOn([attempts.questionId], {
      questionId: attempts.questionId,
      isCorrect: attempts.isCorrect,
    })
    .from(attempts)
    .where(
      and(
        eq(attempts.userId, userId),
        or(isNull(attempts.sessionId), inArray(attempts.sessionId, finishedSessionIds)),
      ),
    )
    .orderBy(attempts.questionId, desc(attempts.createdAt))
}

@Injectable()
export class ProgressRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findQuestionStates(userId: string): Promise<QuestionState[]> {
    return questionStatesQuery(this.db, userId)
  }

  /** 행이 없으면 0 — 아직 시작 안 함이다 (`docs/05` 「study_progress」). */
  async findLastQuestionId(userId: string): Promise<number> {
    const rows = await this.db
      .select({ lastQuestionId: studyProgress.lastQuestionId })
      .from(studyProgress)
      .where(eq(studyProgress.userId, userId))

    return rows[0]?.lastQuestionId ?? 0
  }

  /** 부분 유니크 인덱스가 사용자당 하나를 보장한다 (`docs/05` 「exam_sessions」). */
  async findActiveSessionId(userId: string): Promise<string | null> {
    const rows = await this.db
      .select({ id: examSessions.id })
      .from(examSessions)
      .where(and(eq(examSessions.userId, userId), isNull(examSessions.finishedAt)))

    return rows[0]?.id ?? null
  }
}
