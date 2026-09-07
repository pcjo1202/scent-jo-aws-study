import { ServiceUnavailableException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it, vi } from 'vitest'

import { AttemptsService } from './attempts.service'
import { CreateAttemptBatchDto } from './dto/create-attempt.dto'

import type { BatchAttemptItem, IndexEntry } from '@aws-study/shared'
import type { CatalogService } from '../catalog/catalog.service'
import type { AttemptRow, AttemptsRepository, SessionRow } from './attempts.repository'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const ANSWERED_AT = '2026-09-01T10:00:00.000Z'

/** 선택지 4개, 정답 A. */
const ENTRY: IndexEntry = {
  id: 7,
  chunk: 1,
  categories: [],
  services: [],
  answer: ['A'],
  choiceCount: 4,
}

function item(overrides: Partial<BatchAttemptItem> = {}): BatchAttemptItem {
  return {
    questionId: 7,
    selected: ['A'],
    source: 'sequential',
    answeredAt: ANSWERED_AT,
    ...overrides,
  }
}

function harness(
  getEntry: () => Promise<IndexEntry | undefined> = () => Promise.resolve(ENTRY),
  session?: SessionRow,
) {
  const insertAttempt = vi.fn(() => Promise.resolve())
  const repository = {
    insertAttempt,
    advancePointer: () => Promise.resolve(),
    findSession: () => Promise.resolve(session),
  } as unknown as AttemptsRepository

  return {
    service: new AttemptsService(repository, { getEntry } as unknown as CatalogService),
    insertAttempt,
  }
}

describe('POST /attempts/batch', () => {
  it('answeredAt을 created_at으로 기록한다', async () => {
    const { service, insertAttempt } = harness()

    await service.createAttemptBatch(USER_ID, [item()])

    const [firstCall] = insertAttempt.mock.calls as unknown as [[AttemptRow]]
    expect(firstCall[0].createdAt).toEqual(new Date(ANSWERED_AT))
  })

  it('4xx 항목만 rejected가 되고 나머지는 saved다', async () => {
    const { service, insertAttempt } = harness()

    const { results } = await service.createAttemptBatch(USER_ID, [
      item(),
      item({ selected: ['E'] }),
      item({ selected: ['B'] }),
    ])

    expect(results).toEqual([
      { index: 0, status: 'saved', isCorrect: true },
      { index: 1, status: 'rejected' },
      { index: 2, status: 'saved', isCorrect: false },
    ])
    expect(insertAttempt).toHaveBeenCalledTimes(2)
  })

  it('5xx는 rejected로 접지 않고 던진다 — 큐가 버려지면 안 된다', async () => {
    const { service } = harness(() => Promise.reject(new ServiceUnavailableException('카탈로그')))

    await expect(service.createAttemptBatch(USER_ID, [item()])).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })

  it('저장된 exam 항목에도 정오를 담지 않는다', async () => {
    const { service, insertAttempt } = harness(() => Promise.resolve(ENTRY), {
      questionIds: [7],
      finishedAt: null,
    })

    const { results } = await service.createAttemptBatch(USER_ID, [
      item({ source: 'exam', sessionId: '00000000-0000-4000-8000-0000000000ff' }),
    ])

    expect(results).toEqual([{ index: 0, status: 'saved' }])
    expect(insertAttempt).toHaveBeenCalledTimes(1)
  })
})

/**
 * 배치는 화면을 거치지 않고 들어오므로 DTO가 유일한 검증 지점이다. 오탐까지 같이 센다 —
 * 실측(2026-09-07)으로 두 방향이 다르게 깨진다: `@ValidateNested`를 빼면 아래 「잡는다」
 * 셋이 전부 통과해 버리고(검증 없음), `@Type()`을 빼면 반대로 정상 항목까지 거절된다.
 */
describe('배치 DTO의 중첩 검증', () => {
  async function errorsOf(payload: unknown) {
    return validate(plainToInstance(CreateAttemptBatchDto, payload))
  }

  it('정상 항목은 통과한다', async () => {
    expect(await errorsOf({ items: [item()] })).toHaveLength(0)
  })

  it('항목 안의 잘못된 필드를 잡는다', async () => {
    expect(await errorsOf({ items: [{ ...item(), source: 'guess' }] })).not.toHaveLength(0)
  })

  it('선택지를 3개 넘게 고른 항목을 잡는다', async () => {
    expect(
      await errorsOf({ items: [{ ...item(), selected: ['A', 'B', 'C', 'D'] }] }),
    ).not.toHaveLength(0)
  })

  it('answeredAt이 없는 항목을 잡는다', async () => {
    const withoutAnsweredAt: Record<string, unknown> = { ...item() }
    delete withoutAnsweredAt.answeredAt

    expect(await errorsOf({ items: [withoutAnsweredAt] })).not.toHaveLength(0)
  })

  it('빈 배치를 잡는다', async () => {
    expect(await errorsOf({ items: [] })).not.toHaveLength(0)
  })

  /**
   * `duration_ms`가 int4라 이 값을 넘기면 Postgres가 22003으로 죽는데, 그건 HttpException이
   * 아니라 `rejected`로 격리되지 않고 **응답 전체를 날린다** — 앞 항목은 저장됐는데
   * 클라이언트는 `results`를 못 받는다. 상한이 없던 동안 통과했다 (2026-09-07 리뷰).
   */
  it('int4를 넘는 durationMs를 잡는다', async () => {
    expect(
      await errorsOf({ items: [{ ...item(), durationMs: 9_000_000_000_000 }] }),
    ).not.toHaveLength(0)
  })

  it('int4 상한 자체는 통과한다', async () => {
    expect(await errorsOf({ items: [{ ...item(), durationMs: 2_147_483_647 }] })).toHaveLength(0)
  })

  /** `strict`가 없으면 통과해 3월 3일로 조용히 밀린다 (2026-09-07 리뷰). */
  it('존재하지 않는 날짜를 잡는다', async () => {
    expect(await errorsOf({ items: [{ ...item(), answeredAt: '2026-02-31' }] })).not.toHaveLength(0)
  })
})
