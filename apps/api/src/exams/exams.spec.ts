import { ConflictException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { createDb } from '../db/db.provider'
import { EXAM_QUESTION_COUNT } from '../catalog/grading'
import { sessionAttemptsQuery } from './exams.repository'
import { ExamsService, isUniqueViolation, toAnswers } from './exams.service'

import type { IndexEntry } from '@aws-study/shared'
import type { CatalogService } from '../catalog/catalog.service'
import type { ProgressRepository, QuestionState } from '../progress/progress.repository'
import type { ExamSessionRow, ExamsRepository, SessionAttemptRow } from './exams.repository'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const SESSION_ID = '00000000-0000-4000-8000-0000000000ff'
const VERSION = 'v2'

/** 1019문항. 실제 데이터 크기라 「안 푼 것이 65 미만」 경계가 진짜로 재현된다. */
const POOL = Array.from({ length: 1019 }, (_, index) => index + 1)

function entry(id: number): IndexEntry {
  return { id, chunk: 1, categories: [], services: [], answer: ['A'], choiceCount: 4 }
}

type InsertedSession = { userId: string; questionIds: number[]; contentVersion: string }

type Overrides = {
  session?: ExamSessionRow
  attempts?: SessionAttemptRow[]
  states?: QuestionState[]
  version?: string
  insertSession?: (row: InsertedSession) => Promise<string>
  finishSession?: () => Promise<boolean>
}

function harness(overrides: Overrides = {}) {
  const updateCursor = vi.fn(() => Promise.resolve())
  const deleteSession = vi.fn(() => Promise.resolve())
  const finishSession = vi.fn(overrides.finishSession ?? (() => Promise.resolve(true)))
  const insertSession = vi.fn<(row: InsertedSession) => Promise<string>>(
    overrides.insertSession ?? (() => Promise.resolve(SESSION_ID)),
  )

  const repository = {
    insertSession,
    updateCursor,
    deleteSession,
    finishSession,
    listSessions: () => Promise.resolve([]),
    findSession: () => Promise.resolve(overrides.session),
    findSessionAttempts: () => Promise.resolve(overrides.attempts ?? []),
  } as unknown as ExamsRepository

  const catalogService = {
    loadExamPool: () =>
      Promise.resolve({ version: overrides.version ?? VERSION, questionIds: POOL }),
    getVersion: () => Promise.resolve(overrides.version ?? VERSION),
    listEntries: () => Promise.resolve(POOL.map(entry)),
  } as unknown as CatalogService

  const progressRepository = {
    findQuestionStates: () => Promise.resolve(overrides.states ?? []),
  } as unknown as ProgressRepository

  return {
    service: new ExamsService(repository, catalogService, progressRepository),
    insertSession,
    updateCursor,
    deleteSession,
    finishSession,
  }
}

function session(overrides: Partial<ExamSessionRow> = {}): ExamSessionRow {
  return {
    id: SESSION_ID,
    questionIds: POOL.slice(0, EXAM_QUESTION_COUNT),
    contentVersion: VERSION,
    cursor: 0,
    startedAt: new Date('2026-09-07T00:00:00.000Z'),
    finishedAt: null,
    score: null,
    ...overrides,
  }
}

describe('POST /exams — 추첨과 세션 생성', () => {
  it('65문항을 중복 없이 뽑고 커서 0으로 시작한다', async () => {
    const { service } = harness()

    const response = await service.createExam(USER_ID, {})

    expect(response.questionIds).toHaveLength(EXAM_QUESTION_COUNT)
    expect(new Set(response.questionIds).size).toBe(EXAM_QUESTION_COUNT)
    expect(response.cursor).toBe(0)
  })

  /** 세션과 버전이 갈리면 그 세션은 `finish`에서 영원히 409다 (`catalog.loadExamPool`). */
  it('추첨한 풀과 같은 스냅샷의 content_version을 박는다', async () => {
    const { service, insertSession } = harness()

    await service.createExam(USER_ID, {})

    expect(insertSession.mock.calls[0]?.[0]).toMatchObject({
      userId: USER_ID,
      contentVersion: VERSION,
    })
  })

  it('preferUnsolved는 안 푼 문항만 뽑는다', async () => {
    const solved = POOL.slice(0, 900).map((questionId) => ({ questionId, isCorrect: true }))
    const { service } = harness({ states: solved })

    const { questionIds } = await service.createExam(USER_ID, { preferUnsolved: true })

    expect(questionIds.every((id) => id > 900)).toBe(true)
  })

  /**
   * 안 푼 것이 65개보다 적어도 65개다 — 만점의 분모가 흔들리면 안 된다. 그리고 안 푼 것이
   * 앞에 몰리면 문항 순서가 「이건 처음 보는 문제」를 알려 준다.
   */
  it('안 푼 문항이 65개 미만이면 푼 문항으로 채우고 섞는다', async () => {
    const states = POOL.slice(0, 1009).map((questionId) => ({ questionId, isCorrect: true }))
    const { service } = harness({ states })

    const { questionIds } = await service.createExam(USER_ID, { preferUnsolved: true })
    const unsolvedPositions = questionIds
      .map((id, position) => (id > 1009 ? position : -1))
      .filter((position) => position >= 0)

    expect(questionIds).toHaveLength(EXAM_QUESTION_COUNT)
    expect(new Set(questionIds).size).toBe(EXAM_QUESTION_COUNT)
    expect(unsolvedPositions).toHaveLength(10)
    // 안 푼 10개가 0..9에 그대로 몰려 있으면 섞이지 않은 것이다.
    expect(unsolvedPositions).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('preferUnsolved가 없으면 푼 문항도 후보다', async () => {
    const states = POOL.map((questionId) => ({ questionId, isCorrect: true }))
    const { service } = harness({ states })

    const { questionIds } = await service.createExam(USER_ID, {})

    expect(questionIds).toHaveLength(EXAM_QUESTION_COUNT)
  })

  /** 부분 유니크 인덱스가 판정한다 — 미리 조회해도 그 사이가 열려 있다. */
  it('진행 중 세션이 있으면 409다 (23505 → 409)', async () => {
    const { service } = harness({
      insertSession: () => Promise.reject(Object.assign(new Error('duplicate'), { code: '23505' })),
    })

    await expect(service.createExam(USER_ID, {})).rejects.toBeInstanceOf(ConflictException)
  })

  it('23505가 아닌 DB 오류는 409로 접지 않는다', async () => {
    const { service } = harness({
      insertSession: () => Promise.reject(Object.assign(new Error('연결 끊김'), { code: '08006' })),
    })

    await expect(service.createExam(USER_ID, {})).rejects.not.toBeInstanceOf(ConflictException)
  })
})

/**
 * drizzle 0.45가 드라이버 오류를 `DrizzleQueryError`로 감싸 원본을 `cause`에 넣는다.
 * 한 겹만 보면 다음 업그레이드에서 조용히 안 맞고 409가 500으로 되돌아간다.
 */
describe('23505 검출', () => {
  it('감싸지 않은 드라이버 오류를 찾는다', () => {
    expect(isUniqueViolation(Object.assign(new Error('x'), { code: '23505' }))).toBe(true)
  })

  it('DrizzleQueryError처럼 cause에 감싼 것도 찾는다', () => {
    const driver = Object.assign(new Error('duplicate key'), { code: '23505' })

    expect(isUniqueViolation(new Error('Failed query', { cause: driver }))).toBe(true)
  })

  it('두 겹으로 감싸도 찾는다', () => {
    const driver = Object.assign(new Error('duplicate key'), { code: '23505' })
    const once = new Error('Failed query', { cause: driver })

    expect(isUniqueViolation(new Error('outer', { cause: once }))).toBe(true)
  })

  it('다른 코드와 코드 없는 오류는 아니다', () => {
    expect(isUniqueViolation(Object.assign(new Error('x'), { code: '23514' }))).toBe(false)
    expect(isUniqueViolation(new Error('그냥 오류'))).toBe(false)
    expect(isUniqueViolation(undefined)).toBe(false)
  })

  /** cause가 자기 자신을 가리켜도 멈춘다 — 무한 루프가 요청을 매달리게 두지 않는다. */
  it('cause 순환에 빠지지 않는다', () => {
    const looped = new Error('loop')
    looped.cause = looped

    expect(isUniqueViolation(looped)).toBe(false)
  })
})

describe('PATCH /exams/:id — 진행 위치', () => {
  it('커서를 저장하고 그대로 돌려준다', async () => {
    const { service, updateCursor } = harness({ session: session() })

    expect(await service.updateExam(USER_ID, SESSION_ID, 12)).toEqual({ cursor: 12 })
    expect(updateCursor).toHaveBeenCalledWith(SESSION_ID, USER_ID, 12)
  })

  /** 되돌아가면 커서도 뒤로 간다 — 진도 카운터가 아니라 위치다 (`docs/05`). */
  it('뒤로 가는 이동도 저장한다', async () => {
    const { service, updateCursor } = harness({ session: session({ cursor: 30 }) })

    await service.updateExam(USER_ID, SESSION_ID, 3)

    expect(updateCursor).toHaveBeenCalledWith(SESSION_ID, USER_ID, 3)
  })

  it('종료된 세션이면 409다', async () => {
    const { service, updateCursor } = harness({
      session: session({ finishedAt: new Date(), score: 40 }),
    })

    await expect(service.updateExam(USER_ID, SESSION_ID, 1)).rejects.toBeInstanceOf(
      ConflictException,
    )
    expect(updateCursor).not.toHaveBeenCalled()
  })
})

describe('DELETE /exams/:id — 포기', () => {
  it('진행 중 세션을 지운다', async () => {
    const { service, deleteSession } = harness({ session: session() })

    expect(await service.deleteExam(USER_ID, SESSION_ID)).toEqual({ deleted: true })
    expect(deleteSession).toHaveBeenCalledWith(SESSION_ID, USER_ID)
  })

  it('종료된 세션은 409이고 지우지 않는다', async () => {
    const { service, deleteSession } = harness({
      session: session({ finishedAt: new Date(), score: 40 }),
    })

    await expect(service.deleteExam(USER_ID, SESSION_ID)).rejects.toBeInstanceOf(ConflictException)
    expect(deleteSession).not.toHaveBeenCalled()
  })
})

describe('GET /exams/:id — 상태와 답안', () => {
  const attempts: SessionAttemptRow[] = [
    { questionId: 1, selected: ['A'], isCorrect: true },
    { questionId: 2, selected: ['B', 'C'], isCorrect: false },
  ]

  it('문항별 최신 답안을 맵으로 준다', () => {
    expect(toAnswers(attempts)).toEqual({ 1: ['A'], 2: ['B', 'C'] })
  })

  /** 시험 도중에 정오가 새면 안 된다 (`docs/02` 「진행」). */
  it('진행 중이면 results가 null이다', async () => {
    const { service } = harness({ session: session(), attempts })

    const response = await service.getExam(USER_ID, SESSION_ID)

    expect(response.results).toBeNull()
    expect(response.answers).toEqual({ 1: ['A'], 2: ['B', 'C'] })
  })

  it('종료된 세션은 results를 함께 준다', async () => {
    const { service } = harness({
      session: session({ finishedAt: new Date(), score: 1 }),
      attempts,
    })

    const response = await service.getExam(USER_ID, SESSION_ID)

    expect(response.results).toHaveLength(EXAM_QUESTION_COUNT)
    expect(response.score).toBe(1)
  })
})

describe('POST /exams/:id/finish — 채점', () => {
  it('미응답은 오답이고 만점의 분모는 65다', async () => {
    const attempts: SessionAttemptRow[] = [
      { questionId: 1, selected: ['A'], isCorrect: true },
      { questionId: 2, selected: ['B'], isCorrect: false },
    ]
    const { service, finishSession } = harness({ session: session(), attempts })

    const { score, results } = await service.finishExam(USER_ID, SESSION_ID)

    expect(score).toBe(1)
    expect(results).toHaveLength(EXAM_QUESTION_COUNT)
    expect(results.filter((result) => result.selected === null)).toHaveLength(
      EXAM_QUESTION_COUNT - 2,
    )
    expect(results.every((result) => result.isCorrect === (result.questionId === 1))).toBe(true)
    expect(finishSession).toHaveBeenCalledWith(SESSION_ID, USER_ID, 1)
  })

  /**
   * 저장된 `is_correct`를 쓰고 재채점하지 않는다. 카탈로그 정답이 `['A']`인데 저장된
   * 시도가 「`['B']`인데 정답」이면 이 테스트는 정답 1개를 세야 한다 — 재채점하면 0이다.
   */
  it('isCorrect는 저장값이고 카탈로그로 재채점하지 않는다', async () => {
    const attempts: SessionAttemptRow[] = [{ questionId: 1, selected: ['B'], isCorrect: true }]
    const { service } = harness({ session: session(), attempts })

    const { score, results } = await service.finishExam(USER_ID, SESSION_ID)

    expect(score).toBe(1)
    expect(results[0]).toEqual({
      questionId: 1,
      selected: ['B'],
      answer: ['A'],
      isCorrect: true,
    })
  })

  it('content_version이 갈리면 409이고 점수를 박지 않는다', async () => {
    const { service, finishSession } = harness({
      session: session({ contentVersion: 'v1' }),
      version: 'v2',
    })

    await expect(service.finishExam(USER_ID, SESSION_ID)).rejects.toBeInstanceOf(ConflictException)
    expect(finishSession).not.toHaveBeenCalled()
  })

  it('이미 종료된 세션에 재호출하면 409다', async () => {
    const { service, finishSession } = harness({
      session: session({ finishedAt: new Date(), score: 40 }),
    })

    await expect(service.finishExam(USER_ID, SESSION_ID)).rejects.toBeInstanceOf(ConflictException)
    expect(finishSession).not.toHaveBeenCalled()
  })

  /**
   * 두 기기가 동시에 눌러 둘 다 사전 조회를 통과한 경우. `finished_at is null` 조건이
   * 진 쪽을 0행으로 만들고, 서비스가 그걸 409로 옮긴다 — 앞선 점수가 덮이지 않는다.
   */
  it('경합에서 진 쪽은 0행을 갱신하고 409를 받는다', async () => {
    const { service } = harness({
      session: session(),
      finishSession: () => Promise.resolve(false),
    })

    await expect(service.finishExam(USER_ID, SESSION_ID)).rejects.toBeInstanceOf(ConflictException)
  })
})

/**
 * 「세션 채점」 도출 쿼리가 docs의 형태인지를 센다 (`docs/05` 「도출 쿼리」).
 * 어느 절이 빠져도 실패한다.
 */
describe('세션 채점 쿼리', () => {
  function buildSql() {
    const db = createDb('postgres://smoke:smoke@127.0.0.1:5432/smoke')

    return sessionAttemptsQuery(db, SESSION_ID).toSQL().sql
  }

  it('문항별 최신 한 행만 남긴다', () => {
    expect(buildSql()).toContain('distinct on ("attempts"."question_id")')
  })

  it('created_at 동점을 id로 가른다', () => {
    expect(buildSql()).toContain(
      'order by "attempts"."question_id", "attempts"."created_at" desc, "attempts"."id" desc',
    )
  })

  it('세션 조건 없이는 만들어지지 않는다', () => {
    expect(buildSql()).toContain('"session_id" =')
  })
})
