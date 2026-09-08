/**
 * `POST /exams/:id/finish`와, 같은 세션에 동시에 들어오는 **`:id` 쓰기 경로 전부**의 경합
 * 하네스 (SJO-53·SJO-55). 상대는 답안 제출(`POST /attempts`)·삭제(`DELETE`)·진행 위치
 * 저장(`PATCH`)이다.
 *
 * **실제 DB를 쓴다.** 기본은 건너뛰고 `RACE_PROBE=1`에서만 돈다 — `pnpm test`는 네트워크도
 * 자격증명도 없이 도는 것이 계약이다 (`docs/08`). 실행:
 *
 * ```
 * RACE_PROBE=1 pnpm vitest run apps/api/src/exams/exam-race.spec.ts
 * ```
 *
 * 판정의 원칙은 하나다 — **DB에 남은 상태를 본다.** 회차마다 보는 값이 다르다: ①~④는 `score`가
 * 나중에 읽는 `results`의 정답 수와 같은가(④는 거기에 **이긴 쪽이 하나인가**를 더한다), ⑤는
 * 확정된 세션이 살아남았는가, ⑥은 종료된 세션의 `cursor`가 그대로인가. `finish` 자신의 응답은 어느 쪽이든 정합하므로 응답을 보면 안 된다.
 *
 * 중간에 죽인 실행이 열린 트랜잭션을 남기면 다음 실행이 잠금을 기다리다 엉뚱하게 실패한다.
 * 그때는 코드가 아니라 좀비 커넥션이 원인이므로 다시 돌린다.
 *
 * 조건 ①은 실제로 존재하는 창을 **넓힐 뿐** 없는 창을 만들지 않는다 — 늦추는 지점이 그대로
 * 현재 코드가 왕복 한 번을 쓰는 자리다. ②는 잠금이 들어온 뒤로 임계구역 **안**을 늦추므로
 * 「잠금이 하나라도 빠지면 실패」를 재는 조건이 됐다(수정 전 코드에서는 실재하는 창이었다).
 * ③은 넓히지 않은 자연 경합, ④는 **종료끼리**, ⑤는 종료 도중의 **삭제**, ⑥은 종료 도중의
 * **진행 위치 저장**이다.
 *
 * `process.loadEnvFile`은 **이미 설정된 환경변수를 덮어쓰지 않는다.** 셸에 `DATABASE_URL`이
 * export돼 있으면 `apps/api/.env`가 아니라 그쪽에 붙는데 이 하네스는 행을 지운다 —
 * 전용 `user_id`로 좁혀 있어 피해는 갇히지만, 엉뚱한 DB에 붙었나부터 의심한다.
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
/** 경합의 대상. 나머지 64문항은 미리 답해 둔다 — `QUESTION_IDS`의 마지막 값이다. */
const RACED = 65
/** ⑥이 종료된 세션에 밀어 넣으려는 위치. 세션의 초기 `cursor`(스키마 기본값 0)와 달라야 한다. */
const PATCHED_CURSOR = 7
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

describe.skipIf(process.env.RACE_PROBE !== '1')('finish 경합 — 실제 DB', () => {
  let db: Db

  beforeAll(() => {
    // 레포 루트에서 실행한다 — 파일 첫 주석의 명령이 그 형태다.
    process.loadEnvFile('apps/api/.env')
    const url = process.env.DATABASE_URL
    if (url === undefined) throw new Error('DATABASE_URL이 없다 — apps/api/.env를 확인한다')

    db = createDb(url)
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

  /**
   * `finish` 도중에 다른 기기가 삭제를 누르는 경우. 삭제 경로는 세션을 **잠그지 않으므로**
   * `deleteSessionQuery`의 `finished_at is null`이 여기서는 진짜 방어선이다 — 그것이
   * 추론이 아니라 측정이 되도록 이 회차를 둔다. 뚫리면 점수까지 확정된 세션이 답안째
   * 사라진다(cascade).
   */
  async function deleteDuringFinishRound() {
    const slow = new ExamsService(new SlowFinishRepository(db), catalogService, progressRepository)
    const fast = new ExamsService(new ExamsRepository(db), catalogService, progressRepository)

    const sessionId = await seed()
    const notes = await Promise.all([
      slow.finishExam(USER_ID, sessionId).then(() => 'finished', swallowConflict),
      sleep(WINDOW_MS / 4).then(() =>
        fast.deleteExam(USER_ID, sessionId).then(() => 'deleted', swallowConflict),
      ),
    ])

    const survived = await fast.getExam(USER_ID, sessionId).then(
      (session) => session.score !== null,
      () => false,
    )

    return { survived, note: notes.join(' | ') }
  }

  /**
   * `finish` 도중에 다른 기기가 **진행 위치를 저장**하는 경우 (SJO-55). ⑤와 같은 모양이다 —
   * `PATCH` 경로도 세션을 **잠그지 않으므로** `updateCursorQuery`의 `finished_at is null`이
   * 여기서는 진짜 방어선이다. 뚫리면 종료된 세션의 `cursor`가 바뀌고 200이 나간다
   * (`docs/05` 「오류 응답」이 409로 정한 자리).
   *
   * 판정은 응답이 아니라 **DB에 남은 `cursor`**다 — 서비스의 선조회는 잠금이 아니라, 통과한
   * 뒤 `UPDATE`가 잠금 대기에서 풀려 적용되는 창을 못 막는다.
   */
  async function patchDuringFinishRound() {
    const slow = new ExamsService(new SlowFinishRepository(db), catalogService, progressRepository)
    const fast = new ExamsService(new ExamsRepository(db), catalogService, progressRepository)

    const sessionId = await seed()
    const notes = await Promise.all([
      slow.finishExam(USER_ID, sessionId).then(() => 'finished', swallowConflict),
      sleep(WINDOW_MS / 4).then(() =>
        fast.updateExam(USER_ID, sessionId, PATCHED_CURSOR).then(() => 'patched', swallowConflict),
      ),
    ])

    const [row] = await db
      .select({ cursor: examSessions.cursor, finishedAt: examSessions.finishedAt })
      .from(examSessions)
      .where(eq(examSessions.id, sessionId))

    return {
      cursor: row?.cursor ?? null,
      finished: row?.finishedAt != null,
      // `swallowConflict`는 **모든** 오류를 문자열로 바꾼다 — 404든 연결 오류든 `cursor`는 0이라
      // 「가드가 막았다」와 「PATCH가 애초에 못 갔다」가 구분되지 않는다. 409를 함께 센다.
      rejected: notes.includes('ConflictException'),
      note: notes.join(' | '),
    }
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

  it('⑤ finish 도중의 삭제 — 확정된 세션이 살아남는다', { timeout: 120_000 }, async () => {
    const rounds = 3
    const outcomes = []
    for (let index = 0; index < rounds; index += 1) {
      outcomes.push({ survived: (await deleteDuringFinishRound()).survived })
    }

    expect(outcomes).toEqual(Array.from({ length: rounds }, () => ({ survived: true })))
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

  /**
   * 마진은 「`WINDOW_MS / 4` 대 왕복 한 번」이다 — `PATCH`는 선조회 한 왕복 뒤 100ms에 `UPDATE`를
   * 던지고, 그 전에 `finish`의 잠금이 잡혀 있어야 대기가 생긴다. 풀러 RTT가 그보다 커지면
   * `PATCH`가 먼저 커밋해 이 회차만 빨개지는데 **그건 프로덕션의 정상 동작이다** — 회귀로
   * 읽지 말고 `WINDOW_MS`를 키운다.
   */
  it('⑥ finish 도중의 PATCH — 종료된 세션의 cursor가 안 바뀐다', { timeout: 120_000 }, async () => {
    const rounds = 3
    const outcomes = []
    for (let index = 0; index < rounds; index += 1) {
      const outcome = await patchDuringFinishRound()
      outcomes.push({
        cursor: outcome.cursor,
        finished: outcome.finished,
        rejected: outcome.rejected,
      })
    }

    // 셋을 함께 센다 — 종료되지 않은 회차는 경합을 잰 것이 아니고, 409가 없으면 「막았다」가
    // 아니라 「PATCH가 못 갔다」일 수 있다.
    expect(outcomes).toEqual(
      Array.from({ length: rounds }, () => ({ cursor: 0, finished: true, rejected: true })),
    )
  })
})
