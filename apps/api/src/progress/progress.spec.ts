import { describe, expect, it } from 'vitest'

import { createDb } from '../db/db.provider'
import { questionStatesQuery } from './progress.repository'
import { ProgressService, toStateMap, toWrongQuestionIds } from './progress.service'

import type { ProgressRepository, QuestionState } from './progress.repository'

const USER_ID = '00000000-0000-4000-8000-000000000001'

/** postgres-js는 첫 쿼리까지 접속하지 않는다. `.toSQL()`은 문자열만 만든다. */
function buildStatesSql() {
  const db = createDb('postgres://smoke:smoke@127.0.0.1:5432/smoke')

  return questionStatesQuery(db, USER_ID).toSQL().sql
}

function stubRepository(states: QuestionState[], lastQuestionId = 0, activeSessionId = null) {
  return {
    findQuestionStates: () => Promise.resolve(states),
    findLastQuestionId: () => Promise.resolve(lastQuestionId),
    findActiveSessionId: () => Promise.resolve(activeSessionId),
  } as unknown as ProgressRepository
}

/**
 * 「미완료 exam 세션 제외」는 체크박스가 아니라 횡단 제약이다 (`docs/05` 「도출 쿼리」).
 * 도출 쿼리를 하나로 둔 것이 그 제약을 구조적으로 강제하는 장치이므로, 그 하나가
 * 정말 docs의 형태인지를 여기서 센다 — 어느 절이 빠져도 실패한다.
 */
describe('풀이 상태 맵 쿼리', () => {
  it('미완료 exam 세션의 시도를 제외하는 절이 붙어 있다', () => {
    const sql = buildStatesSql()

    expect(sql).toContain('"session_id" is null')
    expect(sql).toContain('"exam_sessions"')
    expect(sql).toContain('"finished_at" is not null')
  })

  it('문항별 최신 한 행만 남긴다', () => {
    const sql = buildStatesSql()

    expect(sql).toContain('distinct on ("attempts"."question_id")')
    expect(sql).toContain('order by "attempts"."question_id", "attempts"."created_at" desc')
  })

  it('user_id 조건 없이는 만들어지지 않는다', () => {
    expect(buildStatesSql()).toContain('"user_id" =')
  })
})

describe('도출', () => {
  const states: QuestionState[] = [
    { questionId: 1, isCorrect: true },
    { questionId: 3, isCorrect: false },
    { questionId: 5, isCorrect: false },
  ]

  it('안 푼 문항은 상태 맵에 키가 없다', () => {
    expect(toStateMap(states)).toEqual({ 1: 'correct', 3: 'wrong', 5: 'wrong' })
  })

  it('오답 목록은 최신 시도가 오답인 것만 번호순으로 준다', () => {
    expect(toWrongQuestionIds(states)).toEqual([3, 5])
  })

  it('빈 기록은 빈 맵과 빈 목록이다', () => {
    expect(toStateMap([])).toEqual({})
    expect(toWrongQuestionIds([])).toEqual([])
  })
})

describe('GET /me/progress', () => {
  it('solvedCount는 distinct 문항 수이고 포인터와 갈라진다', async () => {
    const service = new ProgressService(
      stubRepository(
        [
          { questionId: 1, isCorrect: true },
          { questionId: 3, isCorrect: false },
          { questionId: 5, isCorrect: true },
        ],
        5,
      ),
    )

    const summary = await service.getSummary(USER_ID)

    expect(summary.solvedCount).toBe(3)
    expect(summary.lastQuestionId).toBe(5)
    expect(summary.wrongCount).toBe(1)
  })

  it('시도 0건이면 진도도 0이다', async () => {
    const summary = await new ProgressService(stubRepository([])).getSummary(USER_ID)

    expect(summary).toEqual({
      lastQuestionId: 0,
      solvedCount: 0,
      wrongCount: 0,
      activeSessionId: null,
    })
  })
})
