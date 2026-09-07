import { ConflictException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDb } from '../db/db.provider'
import { advancePointerQuery } from './attempts.repository'
import { AttemptsService, shouldAdvancePointer } from './attempts.service'

import type { IndexEntry } from '@aws-study/shared'
import type { CatalogService } from '../catalog/catalog.service'
import type { AttemptRow, AttemptsRepository, SessionRow } from './attempts.repository'

/** 스텁 트랜잭션이 콜백에 주는 표식. 문장이 이걸 받았으면 트랜잭션 안이다. */
const TX = { transaction: true }

const USER_ID = '00000000-0000-4000-8000-000000000001'
const SESSION_ID = '00000000-0000-4000-8000-0000000000ff'

/** 선택지 4개, 정답 A. `'E'`는 이 문항에 없는 키다. */
const ENTRY: IndexEntry = {
  id: 7,
  chunk: 1,
  categories: ['보안'],
  services: [],
  answer: ['A'],
  choiceCount: 4,
}

type Harness = {
  service: AttemptsService
  insertAttempt: ReturnType<typeof vi.fn>
  advancePointer: ReturnType<typeof vi.fn>
}

/** `entry: null`은 「카탈로그에 없는 문항」이다 — 기본값과 구별하려고 undefined를 안 쓴다. */
function harness(session?: SessionRow, entry: IndexEntry | null = ENTRY): Harness {
  const insertAttempt = vi.fn(() => Promise.resolve())
  const advancePointer = vi.fn(() => Promise.resolve())
  const repository = {
    insertAttempt,
    advancePointer,
    // 표식을 넘겨 「insert가 잠금과 같은 트랜잭션에 들었는가」를 셀 수 있게 한다.
    transaction: (work: (tx: unknown) => Promise<unknown>) => work(TX),
    lockSession: () => Promise.resolve(session),
  } as unknown as AttemptsRepository
  const catalogService = {
    getEntry: () => Promise.resolve(entry ?? undefined),
  } as unknown as CatalogService

  return { service: new AttemptsService(repository, catalogService), insertAttempt, advancePointer }
}

function insertedRow(insertAttempt: Harness['insertAttempt']): AttemptRow {
  const [firstCall] = insertAttempt.mock.calls
  if (firstCall === undefined) throw new Error('insertAttempt가 불리지 않았다')

  return firstCall[0] as AttemptRow
}

describe('POST /attempts — 채점과 기록', () => {
  it('서버가 채점한 정오를 기록하고 정답을 돌려준다', async () => {
    const { service, insertAttempt } = harness()

    const response = await service.createAttempt(USER_ID, {
      questionId: 7,
      selected: ['A'],
      source: 'sequential',
    })

    expect(response).toEqual({ isCorrect: true, answer: ['A'] })
    expect(insertedRow(insertAttempt).isCorrect).toBe(true)
    expect(insertedRow(insertAttempt).userId).toBe(USER_ID)
  })

  it('없는 문항은 400이다', async () => {
    const { service } = harness(undefined, null)

    await expect(
      service.createAttempt(USER_ID, { questionId: 9999, selected: ['A'], source: 'sequential' }),
    ).rejects.toThrow(/없는 문항/)
  })

  it('그 문항에 없는 선택지 키는 400이다 — 오답으로 기록하지 않는다', async () => {
    const { service, insertAttempt } = harness()

    await expect(
      service.createAttempt(USER_ID, { questionId: 7, selected: ['E'], source: 'sequential' }),
    ).rejects.toThrow(/범위를 벗어난/)
    expect(insertAttempt).not.toHaveBeenCalled()
  })
})

describe('POST /attempts — 진행 포인터', () => {
  it('sequential 기본값은 포인터를 올린다', async () => {
    const { service, advancePointer } = harness()

    await service.createAttempt(USER_ID, { questionId: 7, selected: ['A'], source: 'sequential' })

    expect(advancePointer).toHaveBeenCalledWith(USER_ID, 7)
  })

  it('필터 모드(advancesPointer: false)는 포인터를 건드리지 않는다', async () => {
    const { service, advancePointer } = harness()

    await service.createAttempt(USER_ID, {
      questionId: 7,
      selected: ['A'],
      source: 'sequential',
      advancesPointer: false,
    })

    expect(advancePointer).not.toHaveBeenCalled()
  })

  it.each(['review', 'exam'] as const)('%s 시도는 포인터를 올리지 않는다', (source) => {
    expect(shouldAdvancePointer({ questionId: 7, selected: ['A'], source })).toBe(false)
    expect(
      shouldAdvancePointer({ questionId: 7, selected: ['A'], source, advancesPointer: true }),
    ).toBe(false)
  })

  it('포인터는 greatest()로 올라가 뒤로 가지 않는다', () => {
    const db = createDb('postgres://smoke:smoke@127.0.0.1:5432/smoke')

    const { sql } = advancePointerQuery(db, USER_ID, 7).toSQL()

    expect(sql).toContain('greatest("study_progress"."last_question_id"')
    expect(sql).toContain('on conflict')
  })
})

describe('POST /attempts — exam 세션', () => {
  const activeSession: SessionRow = { questionIds: [7, 8], finishedAt: null }

  it('정오를 돌려주지 않는다', async () => {
    const { service } = harness(activeSession)

    const response = await service.createAttempt(USER_ID, {
      questionId: 7,
      selected: ['A'],
      source: 'exam',
      sessionId: SESSION_ID,
    })

    expect(response).toEqual({ accepted: true })
    expect(response).not.toHaveProperty('isCorrect')
    expect(response).not.toHaveProperty('answer')
  })

  it('정오는 돌려주지 않아도 기록은 남는다', async () => {
    const { service, insertAttempt } = harness(activeSession)

    await service.createAttempt(USER_ID, {
      questionId: 7,
      selected: ['B'],
      source: 'exam',
      sessionId: SESSION_ID,
    })

    expect(insertedRow(insertAttempt).isCorrect).toBe(false)
    expect(insertedRow(insertAttempt).sessionId).toBe(SESSION_ID)
  })

  /**
   * 잠금과 insert가 갈리면 그 사이가 열려 `finish`가 이 답을 빼고 채점한다 (SJO-53).
   * 잠금이 **실제로** 걸리는지는 스텁 밖이라 여기서 셀 수 없다 — `exam-ownership.spec.ts`의
   * `.toSQL()`과 `exam-race.spec.ts`가 그것을 센다.
   */
  it('insert가 세션을 잠근 트랜잭션 안에서 일어난다', async () => {
    const { service, insertAttempt } = harness(activeSession)

    await service.createAttempt(USER_ID, {
      questionId: 7,
      selected: ['A'],
      source: 'exam',
      sessionId: SESSION_ID,
    })

    expect(insertAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID }),
      TX,
    )
  })

  it('남의 세션(또는 없는 세션)은 404다 — 403이 아니다', async () => {
    const { service } = harness(undefined)

    await expect(
      service.createAttempt(USER_ID, {
        questionId: 7,
        selected: ['A'],
        source: 'exam',
        sessionId: SESSION_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('종료된 세션에 제출하면 409다', async () => {
    const { service } = harness({ questionIds: [7], finishedAt: new Date() })

    await expect(
      service.createAttempt(USER_ID, {
        questionId: 7,
        selected: ['A'],
        source: 'exam',
        sessionId: SESSION_ID,
      }),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('세션이 묻지 않은 문항은 400이다', async () => {
    const { service } = harness(activeSession)

    await expect(
      service.createAttempt(USER_ID, {
        questionId: 9,
        selected: ['A'],
        source: 'exam',
        sessionId: SESSION_ID,
      }),
    ).rejects.toThrow(/묻지 않은/)
  })

  it('sessionId 없는 exam 시도는 400이다', async () => {
    const { service } = harness(activeSession)

    await expect(
      service.createAttempt(USER_ID, { questionId: 7, selected: ['A'], source: 'exam' }),
    ).rejects.toThrow(/sessionId/)
  })
})

describe('user_id는 토큰에서만 온다', () => {
  let inserted: AttemptRow

  beforeEach(async () => {
    const { service, insertAttempt } = harness()
    await service.createAttempt(USER_ID, {
      questionId: 7,
      selected: ['A'],
      source: 'sequential',
      ...({ userId: 'attacker' } as object),
    })
    inserted = insertedRow(insertAttempt)
  })

  it('본문의 userId가 토큰을 이기지 못한다', () => {
    expect(inserted.userId).toBe(USER_ID)
  })
})
