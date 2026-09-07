import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import { CatalogService } from '../catalog/catalog.service'
import { EXAM_QUESTION_COUNT, pickExamQuestions } from '../catalog/grading'
import { ProgressRepository } from '../progress/progress.repository'
import { ExamsRepository } from './exams.repository'

import type {
  ChoiceKey,
  CreateExamRequest,
  CreateExamResponse,
  DeleteExamResponse,
  ExamResult,
  ExamSessionResponse,
  IndexEntry,
  FinishExamResponse,
  ListExamsResponse,
  UpdateExamResponse,
} from '@aws-study/shared'
import type { ExamSessionRow, SessionAttemptRow } from './exams.repository'

/** 진행 중 세션이 이미 있을 때 `exam_sessions_one_active_idx`가 주는 코드. */
const UNIQUE_VIOLATION = '23505'

/** 검사할 겹 수. 순환 참조에서 요청이 매달리지 않게 한다. */
const MAX_CAUSE_DEPTH = 5

@Injectable()
export class ExamsService {
  constructor(
    private readonly repository: ExamsRepository,
    private readonly catalogService: CatalogService,
    private readonly progressRepository: ProgressRepository,
  ) {}

  async createExam(userId: string, request: CreateExamRequest): Promise<CreateExamResponse> {
    const { version, questionIds: pool } = await this.catalogService.loadExamPool()
    const questionIds = await this.drawQuestions(userId, pool, request)

    try {
      const id = await this.repository.insertSession({
        userId,
        questionIds,
        contentVersion: version,
      })

      return { id, questionIds, cursor: 0 }
    } catch (error) {
      if (!isUniqueViolation(error)) throw error

      throw new ConflictException('진행 중인 모의고사가 이미 있다')
    }
  }

  async listExams(userId: string): Promise<ListExamsResponse> {
    const sessions = await this.repository.listSessions(userId)

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        startedAt: session.startedAt.toISOString(),
        finishedAt: session.finishedAt?.toISOString() ?? null,
        score: session.score,
      })),
    }
  }

  async getExam(userId: string, sessionId: string): Promise<ExamSessionResponse> {
    const session = await this.requireSession(userId, sessionId)
    const attempts = await this.repository.findSessionAttempts(sessionId)

    return {
      id: session.id,
      questionIds: session.questionIds,
      cursor: session.cursor,
      startedAt: session.startedAt.toISOString(),
      finishedAt: session.finishedAt?.toISOString() ?? null,
      score: session.score,
      answers: toAnswers(attempts),
      // 진행 중이면 null이다 — 시험 도중에 정오가 새면 안 된다 (`docs/02` 「진행」).
      results:
        session.finishedAt === null
          ? null
          : toResults(
              session.questionIds,
              attempts,
              (await this.catalogService.loadGradingSnapshot()).entries,
            ),
    }
  }

  async updateExam(userId: string, sessionId: string, cursor: number): Promise<UpdateExamResponse> {
    const session = await this.requireSession(userId, sessionId)
    if (session.finishedAt !== null) throw new ConflictException('이미 종료된 세션이다')

    await this.repository.updateCursor(sessionId, userId, cursor)

    return { cursor }
  }

  async deleteExam(userId: string, sessionId: string): Promise<DeleteExamResponse> {
    const session = await this.requireSession(userId, sessionId)
    if (session.finishedAt !== null) {
      throw new ConflictException('종료된 세션은 삭제할 수 없다')
    }

    // 선조회와 이 문장 사이에 A가 finish하면 0행이다 — 점수가 확정된 세션을 지우지 않는다.
    const deleted = await this.repository.deleteSession(sessionId, userId)
    if (!deleted) throw new ConflictException('종료된 세션은 삭제할 수 없다')

    return { deleted: true }
  }

  /**
   * 미응답은 오답이고 만점의 분모는 언제나 65다 (`02-features.md` 「종료 / 결과」).
   *
   * **세션 행을 잠그고 답안 읽기와 확정을 한 트랜잭션에 넣는다** (`docs/05` 「세션 채점」).
   * 잠금이 없으면 답안을 읽은 뒤 커밋된 답이 `score`에는 빠지고 나중 `GET`의 `results`에는
   * 들어, 저장된 상태가 영구히 갈린다. `POST /attempts`가 같은 행을 같은 방식으로 잠근다.
   *
   * 카탈로그 스냅샷을 **트랜잭션 밖에서** 먼저 읽는다 — CDN 왕복일 수 있어서 잠금과 풀러
   * 커넥션을 남의 네트워크가 끝날 때까지 붙잡게 된다.
   *
   * `content_version` 대조가 채점보다 **앞에** 있다. 뒤에 두면 낡은 버전 세션을 새 정답으로
   * 이미 채점한 뒤에 409를 주게 되고, 그 사이에 `finishSession`이 성공하면 점수가 박힌다.
   */
  async finishExam(userId: string, sessionId: string): Promise<FinishExamResponse> {
    // 버전 대조와 정답 조회가 한 스냅샷이다 — 갈리면 v1 정오에 v2 정답이 붙는다.
    const { version, entries } = await this.catalogService.loadGradingSnapshot()

    return this.repository.transaction(async (tx) => {
      const session = await this.repository.lockSession(sessionId, userId, tx)
      if (session === undefined) throw new NotFoundException('세션을 찾을 수 없다')
      if (session.finishedAt !== null) throw new ConflictException('이미 종료된 세션이다')
      if (version !== session.contentVersion) {
        throw new ConflictException('세션을 시작한 뒤 문제 데이터가 바뀌었다')
      }

      const attempts = await this.repository.findSessionAttempts(sessionId, tx)
      const results = toResults(session.questionIds, attempts, entries)
      const score = results.filter((result) => result.isCorrect).length

      // 잠금 안이라 여기서 0행이 되는 경로는 없다 — 남겨 두는 이유는 `finishSessionQuery` 주석.
      const finished = await this.repository.finishSession(sessionId, userId, score, tx)
      if (!finished) throw new ConflictException('이미 종료된 세션이다')

      return { score, results }
    })
  }

  /**
   * 남의 세션은 **404**다. 403이 아니다 — 존재 여부를 흘리지 않는다 (`docs/05` 「오류 응답」).
   * 소유자 조건은 쿼리 안에 있어 남의 세션이 애초에 안 나온다.
   */
  private async requireSession(userId: string, sessionId: string): Promise<ExamSessionRow> {
    const session = await this.repository.findSession(sessionId, userId)
    if (session === undefined) throw new NotFoundException('세션을 찾을 수 없다')

    return session
  }

  /**
   * 「안 푼 문항 우선」 (`02-features.md` 「세션 생성」). 안 푼 것이 65개보다 적으면 전부
   * 넣고 모자란 만큼만 푼 것에서 채운 뒤 **합쳐서 다시 섞는다** — 안 푼 문항이 앞에 몰리면
   * 문항 순서가 「이건 처음 보는 문제」를 알려 준다.
   */
  private async drawQuestions(
    userId: string,
    pool: number[],
    request: CreateExamRequest,
  ): Promise<number[]> {
    if (request.preferUnsolved !== true) return pickExamQuestions(pool)

    const states = await this.progressRepository.findQuestionStates(userId)
    const solved = new Set(states.map((state) => state.questionId))
    const unsolved = pool.filter((questionId) => !solved.has(questionId))

    if (unsolved.length >= EXAM_QUESTION_COUNT) return pickExamQuestions(unsolved)

    const filler = pickExamQuestions(
      pool.filter((questionId) => solved.has(questionId)),
      EXAM_QUESTION_COUNT - unsolved.length,
    )

    return pickExamQuestions([...unsolved, ...filler])
  }
}

/**
 * `isCorrect`는 **채점 당시 저장된 값**이고 카탈로그로 다시 채점하지 않는다. 재채점하면
 * `content_version`이 갈린 세션에서 DB에 박힌 `score`와 어긋나, 같은 화면이 「62점」과
 * 정답 63개를 동시에 보여준다 (`docs/05` 「주요 요청/응답」).
 *
 * `answer`만 카탈로그에서 읽는다 — 해설 화면이 정답을 보여줘야 하고 그건 DB에 없다.
 */
export function toResults(
  questionIds: number[],
  attempts: SessionAttemptRow[],
  entries: IndexEntry[],
): ExamResult[] {
  const answers = new Map(entries.map((entry) => [entry.id, entry.answer]))
  const byQuestion = new Map(attempts.map((attempt) => [attempt.questionId, attempt]))

  return questionIds.map((questionId) => {
    const attempt = byQuestion.get(questionId)

    return {
      questionId,
      selected: attempt?.selected ?? null,
      // 빈 배열은 「정답 없음」이 아니라 **카탈로그에 그 문항이 없다**는 뜻이다. v2에서
      // 문항이 빠진 옛 세션을 열 때만 가능하고, 그 세션은 finish에서 이미 409다 —
      // 남는 경로는 종료된 세션의 재열람뿐이라 화면이 정답 자리를 비운다. 던지지 않는
      // 이유는 나머지 64문항의 리뷰까지 막을 이유가 없어서다.
      answer: answers.get(questionId) ?? [],
      isCorrect: attempt?.isCorrect ?? false,
    }
  })
}

/** 문항별 최신 답안. 아직 안 고른 문항은 키가 없다. */
export function toAnswers(attempts: SessionAttemptRow[]): Record<number, ChoiceKey[]> {
  return Object.fromEntries(attempts.map((attempt) => [attempt.questionId, attempt.selected]))
}

/**
 * drizzle 0.45가 드라이버 오류를 `DrizzleQueryError`로 감싸고 원본을 `cause`에 넣는다
 * (`pg-core/session.cjs`의 `queryWithCache` — 2026-09-07 설치본 대조). 감싸는 깊이가
 * 버전마다 다를 수 있어 **cause 사슬을 따라간다** — 한 겹만 보면 다음 업그레이드에서
 * 조용히 안 맞고 409가 500으로 되돌아간다.
 *
 * `DrizzleQueryError.message`에는 쿼리 전문과 파라미터가 들어 있다. 로그로 흘리지 않는다.
 */
export function isUniqueViolation(error: unknown): boolean {
  for (let current = error, depth = 0; current !== null && current !== undefined; depth += 1) {
    if (depth >= MAX_CAUSE_DEPTH) return false
    if (typeof current === 'object' && 'code' in current && current.code === UNIQUE_VIOLATION) {
      return true
    }
    if (!(current instanceof Error)) return false

    current = current.cause
  }

  return false
}
