import { NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { createDb } from '../db/db.provider'
import { findSessionQuery } from './exams.repository'
import { ExamsService } from './exams.service'

import type { CatalogService } from '../catalog/catalog.service'
import type { ProgressRepository } from '../progress/progress.repository'
import type { ExamsRepository } from './exams.repository'

const OWNER_ID = '00000000-0000-4000-8000-000000000001'
const OTHER_ID = '00000000-0000-4000-8000-000000000002'
const SESSION_ID = '00000000-0000-4000-8000-0000000000ff'

/**
 * 소유권 검증 (`docs/08` 「소유권 검증」). RLS를 켜지 않았으므로 **애플리케이션이 유일한
 * 방어선**이다.
 *
 * 남의 세션은 **404**다. 403이 아니다 — 403은 「있지만 네 것이 아니다」를 뜻해 존재 여부를
 * 흘린다.
 *
 * `:id`를 받는 exam 엔드포인트 **전부**를 건다. 소유자 조건은 엔드포인트마다 각자 붙이는
 * 것이라 「하나 넣었으니 나머지도 됐다」가 성립하지 않는다 — 하나가 빠지면 그 경로만
 * 조용히 열린다.
 */
function serviceWhereRepositoryScopesByOwner() {
  const findSession = vi.fn((sessionId: string, userId: string) =>
    // 실제 쿼리와 같은 규칙: 소유자가 아니면 행이 나오지 않는다.
    Promise.resolve(
      userId === OWNER_ID
        ? {
            id: sessionId,
            questionIds: [1],
            contentVersion: 'v2',
            cursor: 0,
            startedAt: new Date(),
            finishedAt: null,
            score: null,
          }
        : undefined,
    ),
  )

  const updateCursor = vi.fn(() => Promise.resolve())
  const deleteSession = vi.fn(() => Promise.resolve())
  const finishSession = vi.fn(() => Promise.resolve(true))

  const repository = {
    findSession,
    updateCursor,
    deleteSession,
    finishSession,
    findSessionAttempts: () => Promise.resolve([]),
  } as unknown as ExamsRepository

  const catalogService = {
    getVersion: () => Promise.resolve('v2'),
    listEntries: () => Promise.resolve([]),
  } as unknown as CatalogService

  const progressRepository = {
    findQuestionStates: () => Promise.resolve([]),
  } as unknown as ProgressRepository

  return {
    service: new ExamsService(repository, catalogService, progressRepository),
    findSession,
    updateCursor,
    deleteSession,
    finishSession,
  }
}

/** 이 목록이 `docs/08` 「소유권 검증」 표의 exam 행과 같아야 한다. */
const OWNED_ROUTES: Array<[string, (service: ExamsService, userId: string) => Promise<unknown>]> = [
  ['GET /exams/:id', (service, userId) => service.getExam(userId, SESSION_ID)],
  ['PATCH /exams/:id', (service, userId) => service.updateExam(userId, SESSION_ID, 3)],
  ['DELETE /exams/:id', (service, userId) => service.deleteExam(userId, SESSION_ID)],
  ['POST /exams/:id/finish', (service, userId) => service.finishExam(userId, SESSION_ID)],
]

describe('소유권 — 남의 세션은 404다', () => {
  it.each(OWNED_ROUTES)('%s', async (_route, call) => {
    const { service } = serviceWhereRepositoryScopesByOwner()

    await expect(call(service, OTHER_ID)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('주인은 같은 경로로 통과한다 — 404가 무조건 나오는 게 아니다', async () => {
    for (const [, call] of OWNED_ROUTES) {
      const { service } = serviceWhereRepositoryScopesByOwner()

      await expect(call(service, OWNER_ID)).resolves.toBeDefined()
    }
  })

  /**
   * 세션을 못 찾았으면 **쓰기까지 가면 안 된다.** 404를 던지고도 갱신·삭제가 이미 나갔으면
   * 방어가 아니라 순서 문제일 뿐이다.
   */
  it('404일 때 쓰기 쿼리가 나가지 않는다', async () => {
    const { service, updateCursor, deleteSession, finishSession } =
      serviceWhereRepositoryScopesByOwner()

    for (const [, call] of OWNED_ROUTES) {
      await call(service, OTHER_ID).catch(() => undefined)
    }

    expect(updateCursor).not.toHaveBeenCalled()
    expect(deleteSession).not.toHaveBeenCalled()
    expect(finishSession).not.toHaveBeenCalled()
  })

  /** 토큰의 `sub`가 그대로 쿼리에 간다 — 본문·경로가 소유자를 바꿀 길이 없다. */
  it('조회에 넘긴 userId가 호출자의 것이다', async () => {
    const { service, findSession } = serviceWhereRepositoryScopesByOwner()

    await service.getExam(OWNER_ID, SESSION_ID)

    expect(findSession).toHaveBeenCalledWith(SESSION_ID, OWNER_ID)
  })
})

/**
 * 위 스펙은 리포지토리를 스텁으로 두므로 **SQL에서 `user_id`가 빠져도 통과한다.**
 * 실제 방어선은 쿼리 문자열이라 여기서 따로 센다 (`progress.spec.ts`와 같은 형태).
 */
describe('소유권 — 쿼리에 user_id가 붙는다', () => {
  function buildSql() {
    const db = createDb('postgres://smoke:smoke@127.0.0.1:5432/smoke')

    return findSessionQuery(db, SESSION_ID, OWNER_ID).toSQL().sql
  }

  it('세션 조회가 id와 user_id를 함께 건다', () => {
    const sql = buildSql()

    expect(sql).toContain('"id" =')
    expect(sql).toContain('"user_id" =')
  })

  /**
   * `ownedSession()`이 네 경로가 쓰는 단 하나의 조건이라, 이 한 줄이 무너지면 조회·커서·
   * 삭제·종료가 동시에 열린다. 그래서 조건을 여기서 못박는다.
   */
  it('user_id 조건 없이는 만들어지지 않는다', () => {
    expect(buildSql()).toMatch(/"user_id" = \$\d/)
  })
})
