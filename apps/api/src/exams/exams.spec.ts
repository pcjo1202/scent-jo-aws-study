import { ConflictException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { createDb } from '../db/db.provider'
import { EXAM_QUESTION_COUNT } from '../catalog/grading'
import { listSessionsQuery, sessionAttemptsQuery } from './exams.repository'
import { ExamsService, isUniqueViolation, toAnswers } from './exams.service'

import type { IndexEntry } from '@aws-study/shared'
import type { CatalogService } from '../catalog/catalog.service'
import type { ProgressRepository, QuestionState } from '../progress/progress.repository'
import type {
  ExamSessionListRow,
  ExamSessionRow,
  ExamsRepository,
  SessionAttemptRow,
} from './exams.repository'

/** 스텁 트랜잭션이 콜백에 주는 표식. 문장이 이걸 받았으면 트랜잭션 안이다. */
const TX = { transaction: true }

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
  deleteSession?: () => Promise<boolean>
  sessions?: ExamSessionListRow[]
}

function harness(overrides: Overrides = {}) {
  const updateCursor = vi.fn(() => Promise.resolve())
  const deleteSession = vi.fn(overrides.deleteSession ?? (() => Promise.resolve(true)))
  const finishSession = vi.fn(overrides.finishSession ?? (() => Promise.resolve(true)))
  const insertSession = vi.fn<(row: InsertedSession) => Promise<string>>(
    overrides.insertSession ?? (() => Promise.resolve(SESSION_ID)),
  )
  const lockSession = vi.fn(() => Promise.resolve(overrides.session))
  const findSessionAttempts = vi.fn(() => Promise.resolve(overrides.attempts ?? []))

  const repository = {
    insertSession,
    updateCursor,
    deleteSession,
    finishSession,
    listSessions: () => Promise.resolve(overrides.sessions ?? []),
    findSession: () => Promise.resolve(overrides.session),
    // 스텁 트랜잭션은 콜백을 그대로 돌리되 **표식을 넘긴다** — 세 문장이 같은 핸들을 받았는지
    // 세면 「트랜잭션 밖으로 샌 문장」이 잡힌다. 잠금이 실제로 걸리는지는 여기서 셀 수 없다
    // (스텁 경계 밖이다) — `.toSQL()`과 `exam-race.spec.ts`가 그것을 센다.
    transaction: (work: (tx: unknown) => Promise<unknown>) => work(TX),
    lockSession,
    findSessionAttempts,
  } as unknown as ExamsRepository

  const catalogService = {
    loadExamPool: () =>
      Promise.resolve({ version: overrides.version ?? VERSION, questionIds: POOL }),
    getVersion: () => Promise.resolve(overrides.version ?? VERSION),
    loadGradingSnapshot: () =>
      Promise.resolve({ version: overrides.version ?? VERSION, entries: POOL.map(entry) }),
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
    lockSession,
    findSessionAttempts,
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

  /** 선조회와 DELETE 사이에 A가 finish하면 SQL이 0행을 준다 — 점수가 확정된 세션을 지키는 자리다. */
  it('경합에서 0행이 지워지면 409다', async () => {
    const { service } = harness({
      session: session(),
      deleteSession: () => Promise.resolve(false),
    })

    await expect(service.deleteExam(USER_ID, SESSION_ID)).rejects.toBeInstanceOf(ConflictException)
  })

  it('종료된 세션은 409이고 지우지 않는다', async () => {
    const { service, deleteSession } = harness({
      session: session({ finishedAt: new Date(), score: 40 }),
    })

    await expect(service.deleteExam(USER_ID, SESSION_ID)).rejects.toBeInstanceOf(ConflictException)
    expect(deleteSession).not.toHaveBeenCalled()
  })
})

describe('GET /exams — 목록', () => {
  it('네 필드만 주고 Date를 ISO로 바꾼다 — questionIds는 안 담는다', async () => {
    const { service } = harness({
      sessions: [
        {
          id: SESSION_ID,
          startedAt: new Date('2026-09-07T01:00:00.000Z'),
          finishedAt: new Date('2026-09-07T02:00:00.000Z'),
          score: 42,
        },
        {
          id: 'other',
          startedAt: new Date('2026-09-06T01:00:00.000Z'),
          finishedAt: null,
          score: null,
        },
      ],
    })

    const { sessions } = await service.listExams(USER_ID)

    expect(sessions[0]).toEqual({
      id: SESSION_ID,
      startedAt: '2026-09-07T01:00:00.000Z',
      finishedAt: '2026-09-07T02:00:00.000Z',
      score: 42,
    })
    expect(sessions[1]?.finishedAt).toBeNull()
    expect(Object.keys(sessions[0] ?? {})).not.toContain('questionIds')
  })

  it('세션 0건은 빈 목록이다 — 오류가 아니라 빈 상태다', async () => {
    const { service } = harness()

    expect(await service.listExams(USER_ID)).toEqual({ sessions: [] })
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
    expect(finishSession).toHaveBeenCalledWith(SESSION_ID, USER_ID, 1, TX)
  })

  /**
   * 셋 중 하나라도 트랜잭션 밖으로 새면 잠금이 답안 읽기를 못 덮어 경합이 그대로 열린다
   * (SJO-53). 잠금이 **실제로** 걸리는지는 스텁 밖이라 여기서 셀 수 없다 —
   * `exam-ownership.spec.ts`의 `.toSQL()`과 `exam-race.spec.ts`가 그것을 센다.
   */
  it('잠금·답안 읽기·확정이 같은 트랜잭션에서 일어난다', async () => {
    const { service, lockSession, findSessionAttempts, finishSession } = harness({
      session: session(),
    })

    await service.finishExam(USER_ID, SESSION_ID)

    expect(lockSession).toHaveBeenCalledWith(SESSION_ID, USER_ID, TX)
    expect(findSessionAttempts).toHaveBeenCalledWith(SESSION_ID, TX)
    expect(finishSession).toHaveBeenCalledWith(SESSION_ID, USER_ID, 0, TX)
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
   * `finishSession`이 0행을 주면 409로 옮기는지만 본다. **두 기기 동시 종료의 실제 경로는
   * 이게 아니다** — 잠금이 들어온 뒤로 진 쪽은 `lockSession`이 커밋된 행을 다시 읽어
   * 위 테스트(`이미 종료된 세션`)에서 409를 받고, 여기까지 오지 않는다 (2026-09-08 실측,
   * `docs/08` 「경합 가드」). 이 분기를 남기는 이유는 잠금 밖에서 `finishSession`을 부르는
   * 호출자가 생겼을 때 마지막 방어선이기 때문이다.
   */
  it('finishSession이 0행이면 409로 옮긴다', async () => {
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

  it('목록은 startedAt 내림차순이다 (`docs/05` 「GET /exams」)', () => {
    const db = createDb('postgres://smoke:smoke@127.0.0.1:5432/smoke')

    expect(listSessionsQuery(db, USER_ID).toSQL().sql).toContain(
      'order by "exam_sessions"."started_at" desc',
    )
  })

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
