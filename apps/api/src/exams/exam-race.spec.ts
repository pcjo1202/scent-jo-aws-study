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
 * 조건 ①②는 실제로 존재하는 창을 **넓힐 뿐** 없는 창을 만들지 않는다 — 늦추는 지점이
 * 그대로 현재 코드가 왕복 한 번을 쓰는 자리다. 조건 ③은 넓히지 않은 자연 경합이다.
 */
import { fileURLToPath } from 'node:url'

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

import { eq } from 'drizzle-orm'

/** 이 하네스 전용. 끝나면 이 `user_id`의 행을 전부 지우고 0을 센다. */
const USER_ID = '53000000-0000-4000-8000-000000000053'
const VERSION = 'race-probe'
const QUESTION_IDS = Array.from({ length: 65 }, (_, index) => index + 1)
/** 경합의 대상. 나머지 64문항은 미리 답해 둔다. */
const RACED = QUESTION_IDS[64] as number
const WINDOW_MS = 400
const NATURAL_ROUNDS = 10

const entry = (id: number): IndexEntry => ({
  id,
  chunk: 1,
  categories: [],
  services: [],
  answer: ['A'],
  choiceCount: 4,
})

const catalogService = {
  getEntry: (id: number) => Promise.resolve(entry(id)),
  loadExamPool: () => Promise.resolve({ version: VERSION, questionIds: QUESTION_IDS }),
  loadGradingSnapshot: () =>
    Promise.resolve({ version: VERSION, entries: QUESTION_IDS.map(entry) }),
} as unknown as CatalogService

const progressRepository = {
  findQuestionStates: () => Promise.resolve([]),
} as unknown as ProgressRepository

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
  async findSession(...args: Parameters<AttemptsRepository['findSession']>) {
    const row = await super.findSession(...args)
    await sleep(WINDOW_MS)

    return row
  }
}

type Round = { score: number | null; correctInResults: number; note: string }

describe.skipIf(process.env.RACE_PROBE !== '1')('SJO-53 경합 — 실제 DB', () => {
  let db: Db

  beforeAll(() => {
    process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)))
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

  const swallowConflict = (error: unknown) => `${(error as Error).constructor.name}`

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

  async function measure(widen: 'finish' | 'attempt' | 'none', rounds: number) {
    const mismatched: Round[] = []
    for (let index = 0; index < rounds; index += 1) {
      const outcome = await round(widen)
      if (outcome.score !== outcome.correctInResults) mismatched.push(outcome)
    }

    console.log(
      `[${widen}] ${rounds}회 중 어긋남 ${mismatched.length}회` +
        (mismatched[0] === undefined
          ? ''
          : ` — 예: score=${mismatched[0].score} results정답=${mismatched[0].correctInResults} (${mismatched[0].note})`),
    )

    return mismatched
  }

  it('① finish가 답안을 읽은 뒤 들어온 답안', { timeout: 120_000 }, async () => {
    expect(await measure('finish', 3)).toEqual([])
  })

  it('② 세션 검사를 통과한 답안이 finish 뒤에 커밋', { timeout: 120_000 }, async () => {
    expect(await measure('attempt', 3)).toEqual([])
  })

  it('③ 넓히지 않은 자연 경합', { timeout: 180_000 }, async () => {
    expect(await measure('none', NATURAL_ROUNDS)).toEqual([])
  })
})
