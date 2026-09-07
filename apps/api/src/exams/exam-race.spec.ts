/**
 * `POST /attempts`와 `POST /exams/:id/finish`의 경합 하네스 (SJO-53).
 *
 * **실제 DB를 쓴다.** 기본은 건너뛰고 `RACE_PROBE=1`에서만 돈다 — `pnpm test`는 네트워크도
 * 자격증명도 없이 도는 것이 계약이다 (`docs/08`). 실행:
 *
 * ```
 * RACE_PROBE=1 pnpm vitest run apps/api/src/exams/exam-race.spec.ts
 * ```
 *
 * 판정은 하나다 — **DB에 남은 `score`가 나중에 읽는 `results`의 정답 수와 같은가.** `finish`
 * 자신의 응답은 어느 쪽이든 정합하므로 응답을 보면 안 된다.
 *
 * 중간에 죽인 실행이 열린 트랜잭션을 남기면 다음 실행이 잠금을 기다리다 엉뚱하게 실패한다.
 * 그때는 코드가 아니라 좀비 커넥션이 원인이므로 다시 돌린다.
 *
 * 조건 ①②는 실제로 존재하는 창을 **넓힐 뿐** 없는 창을 만들지 않는다 — 늦추는 지점이
 * 그대로 현재 코드가 왕복 한 번을 쓰는 자리다. ③은 넓히지 않은 자연 경합이고, ④는 답안이
 * 아니라 **종료끼리** 부딪히는 경우다.
 */
import { eq } from 'drizzle-orm'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'

import { AttemptsRepository } from '../attempts/attempts.repository'
import { AttemptsService } from '../attempts/attempts.service'
import { createDb } from '../db/db.provider'
import { attempts, examSessions } from '../db/schema'
import { ExamsRepository } from './exams.repository'
import { ExamsService } from './exams.service'

import type { IndexEntry } from '@aws-study/shared'
import type { CatalogService } from '../catalog/catalog.service'
import type { Db } from '../db/db.provider'
import type { ProgressRepository } from '../progress/progress.repository'

/** 이 하네스 전용. 끝나면 이 `user_id`의 행을 전부 지우고 0을 센다. */
const USER_ID = '53000000-0000-4000-8000-000000000053'
const VERSION = 'race-probe'
const QUESTION_IDS = Array.from({ length: 65 }, (_, index) => index + 1)
/** 경합의 대상. 나머지 64문항은 미리 답해 둔다. */
const RACED = QUESTION_IDS[64] as number
const WINDOW_MS = 400
const NATURAL_ROUNDS = 10

function entry(id: number): IndexEntry {
  return { id, chunk: 1, categories: [], services: [], answer: ['A'], choiceCount: 4 }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const catalogService = {
  getEntry: (id: number) => Promise.resolve(entry(id)),
  loadExamPool: () => Promise.resolve({ version: VERSION, questionIds: QUESTION_IDS }),
  loadGradingSnapshot: () =>
    Promise.resolve({ version: VERSION, entries: QUESTION_IDS.map(entry) }),
} as unknown as CatalogService

const progressRepository = {
  findQuestionStates: () => Promise.resolve([]),
} as unknown as ProgressRepository

/** 답안을 읽은 **뒤**를 늦춘다 — 지금 코드가 `finishSession`까지 왕복 한 번을 쓰는 자리다. */
class SlowFinishRepository extends ExamsRepository {
  async findSessionAttempts(...args: Parameters<ExamsRepository['findSessionAttempts']>) {
    const rows = await super.findSessionAttempts(...args)
    await sleep(WINDOW_MS)

    return rows
  }
}

/** 세션 검사를 통과한 **뒤**를 늦춘다 — insert까지의 창이 그것이다. */
class SlowAttemptRepository extends AttemptsRepository {
  async lockSession(...args: Parameters<AttemptsRepository['lockSession']>) {
    const row = await super.lockSession(...args)
    await sleep(WINDOW_MS)

    return row
  }
}

type Round = { score: number | null; correctInResults: number; note: string }

describe.skipIf(process.env.RACE_PROBE !== '1')('SJO-53 경합 — 실제 DB', () => {
  let db: Db

  beforeAll(() => {
    // 레포 루트에서 실행한다 — 파일 첫 주석의 명령이 그 형태다.
    process.loadEnvFile('apps/api/.env')
    db = createDb(process.env.DATABASE_URL as string)
  })

  afterAll(async () => {
    await wipe()
    const sessions = await db.select().from(examSessions).where(eq(examSessions.userId, USER_ID))
    const rows = await db.select().from(attempts).where(eq(attempts.userId, USER_ID))
    console.log(`정리 후 전용 user 행: exam_sessions=${sessions.length} attempts=${rows.length}`)
    expect(sessions.length + rows.length).toBe(0)
  })

  async function wipe() {
    await db.delete(examSessions).where(eq(examSessions.userId, USER_ID))
    await db.delete(attempts).where(eq(attempts.userId, USER_ID))
  }

  /** 64문항을 미리 답한 진행 중 세션. 65번째가 경합 대상이다. 준비는 늦추지 않은 경로로 한다. */
  async function seed() {
    const attemptsService = new AttemptsService(new AttemptsRepository(db), catalogService)
    await wipe()
    const sessionId = await new ExamsRepository(db).insertSession({
      userId: USER_ID,
      questionIds: QUESTION_IDS,
      contentVersion: VERSION,
    })

    for (const questionId of QUESTION_IDS.slice(0, 64)) {
      await attemptsService.createAttempt(USER_ID, {
        questionId,
        selected: ['A'],
        source: 'exam',
        sessionId,
      })
    }

    return sessionId
  }

  /** 저장된 `score`와, 나중에 읽는 `results`의 정답 수. */
  async function readBack(examsService: ExamsService, sessionId: string): Promise<Round> {
    const session = await examsService.getExam(USER_ID, sessionId)

    return {
      score: session.score,
      correctInResults: (session.results ?? []).filter((result) => result.isCorrect).length,
      note: '',
    }
  }

  /** 409·404는 정상 결과다 — 어느 쪽이 이겼는지만 기록하고 판정은 DB 상태로 한다. */
  function swallowConflict(error: unknown) {
    return `${(error as Error).constructor.name}`
  }

  /**
   * 두 기기가 동시에 종료를 누르는 경우. 이긴 쪽만 확정하고 진 쪽은 409여야 한다
   * (`docs/05` 「오류 응답」). 여기서 가드가 둘로 갈린다 — **행 잠금**과
   * `finishSessionQuery`의 `finished_at is null`. 어느 쪽이 실제로 막는지는 뮤테이션으로
   * 센다 (증거는 이슈 코멘트).
   */
  async function doubleFinishRound() {
    const slow = new ExamsService(new SlowFinishRepository(db), catalogService, progressRepository)
    const fast = new ExamsService(new ExamsRepository(db), catalogService, progressRepository)

    const sessionId = await seed()
    const finish = (service: ExamsService) =>
      service.finishExam(USER_ID, sessionId).then(() => 'finished', swallowConflict)

    const notes = await Promise.all([finish(slow), sleep(WINDOW_MS / 4).then(() => finish(fast))])
    const result = await readBack(fast, sessionId)
    const winners = notes.filter((note) => note === 'finished').length

    return { ...result, winners, note: notes.join(' | ') }
  }

  async function round(widen: 'finish' | 'attempt' | 'none'): Promise<Round> {
    const examsRepository =
      widen === 'finish' ? new SlowFinishRepository(db) : new ExamsRepository(db)
    const attemptsRepository =
      widen === 'attempt' ? new SlowAttemptRepository(db) : new AttemptsRepository(db)
    const examsService = new ExamsService(examsRepository, catalogService, progressRepository)
    const attemptsService = new AttemptsService(attemptsRepository, catalogService)

    const sessionId = await seed()

    const submit = () =>
      attemptsService
        .createAttempt(USER_ID, {
          questionId: RACED,
          selected: ['A'],
          source: 'exam',
          sessionId,
        })
        .then(() => 'saved', swallowConflict)
    const finish = () =>
      examsService.finishExam(USER_ID, sessionId).then(() => 'finished', swallowConflict)

    const notes =
      widen === 'finish'
        ? await Promise.all([finish(), sleep(WINDOW_MS / 4).then(submit)])
        : widen === 'attempt'
          ? await Promise.all([submit(), sleep(WINDOW_MS / 4).then(finish)])
          : await Promise.all([finish(), submit()])

    const result = await readBack(examsService, sessionId)

    return { ...result, note: notes.join(' | ') }
  }

  /**
   * **실행 회차를 함께 단언한다.** 어긋남 0건과 0회 실행은 둘 다 「어긋남 없음」으로 보이는데
   * 뒤엣것은 통과가 아니다 (`CLAUDE.md` 「`exit 0`은 통과가 아니다」).
   */
  async function measure(widen: 'finish' | 'attempt' | 'none', rounds: number) {
    const mismatched: Round[] = []
    for (let index = 0; index < rounds; index += 1) {
      const outcome = await round(widen)
      if (outcome.score !== outcome.correctInResults) mismatched.push(outcome)
    }

    return { rounds, mismatched: mismatched.length, sample: mismatched[0] ?? null }
  }

  it('① finish가 답안을 읽은 뒤 들어온 답안', { timeout: 120_000 }, async () => {
    expect(await measure('finish', 3)).toEqual({ rounds: 3, mismatched: 0, sample: null })
  })

  it('② 세션 검사를 통과한 답안이 finish 뒤에 커밋', { timeout: 120_000 }, async () => {
    expect(await measure('attempt', 3)).toEqual({ rounds: 3, mismatched: 0, sample: null })
  })

  it('③ 넓히지 않은 자연 경합', { timeout: 180_000 }, async () => {
    expect(await measure('none', NATURAL_ROUNDS)).toEqual({
      rounds: NATURAL_ROUNDS,
      mismatched: 0,
      sample: null,
    })
  })

  it('④ 두 기기 동시 종료 — 이긴 쪽만 확정한다', { timeout: 120_000 }, async () => {
    const rounds = 3
    const outcomes = []
    for (let index = 0; index < rounds; index += 1) {
      const outcome = await doubleFinishRound()
      outcomes.push({
        winners: outcome.winners,
        consistent: outcome.score === outcome.correctInResults,
      })
    }

    expect(outcomes).toEqual(
      Array.from({ length: rounds }, () => ({ winners: 1, consistent: true })),
    )
  })
})
