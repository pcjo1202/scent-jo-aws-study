import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { CatalogService } from '../catalog/catalog.service'
import { grade, hasOnlyExistingChoices } from '../catalog/grading'
import { AttemptsRepository } from './attempts.repository'

import type {
  AttemptResponse,
  BatchAttemptItem,
  BatchAttemptResult,
  CreateAttemptBatchResponse,
  CreateAttemptRequest,
  ExamAttemptResponse,
  IndexEntry,
} from '@aws-study/shared'

/** 오프라인 큐 재전송만 `answeredAt`을 갖는다. */
type AttemptInput = CreateAttemptRequest & { answeredAt?: string }

@Injectable()
export class AttemptsService {
  constructor(
    private readonly repository: AttemptsRepository,
    private readonly catalogService: CatalogService,
  ) {}

  async createAttempt(
    userId: string,
    input: AttemptInput,
  ): Promise<AttemptResponse | ExamAttemptResponse> {
    const entry = await this.loadEntry(input)
    const sessionId = await this.resolveSessionId(userId, input)
    const isCorrect = grade(input.selected, entry.answer)

    await this.repository.insertAttempt({
      userId,
      questionId: input.questionId,
      sessionId,
      source: input.source,
      selected: input.selected,
      isCorrect,
      durationMs: input.durationMs,
      createdAt: input.answeredAt === undefined ? undefined : new Date(input.answeredAt),
    })

    // ponytail: 시도와 포인터가 한 트랜잭션이 아니다. 포인터만 실패하면 다음 순차 제출의
    // greatest()가 스스로 따라잡는다 — 원장은 attempts이고 포인터는 파생이다.
    if (shouldAdvancePointer(input)) {
      await this.repository.advancePointer(userId, input.questionId)
    }

    if (input.source === 'exam') return { accepted: true }

    return { isCorrect, answer: entry.answer }
  }

  /**
   * 오프라인 큐 재전송. 항목 하나가 4xx여도 나머지는 저장한다 — 큐가 통째로 버려지면
   * 오프라인에서 푼 기록이 사라진다.
   *
   * **5xx는 `rejected`로 접지 않고 그대로 던진다.** 카탈로그 503이나 DB 장애까지
   * `rejected`가 되면 클라이언트가 「이 항목은 틀렸다」로 읽고 큐에서 버리는데, 실제로는
   * 잠시 뒤 성공했을 항목이다 (`docs/05` 「batch」 — 재시도는 네트워크 오류만).
   *
   * 순차로 도는 이유는 같은 문항이 큐에 두 번 든 경우의 기록 순서를 보존하기 위해서다.
   */
  async createAttemptBatch(
    userId: string,
    items: BatchAttemptItem[],
  ): Promise<CreateAttemptBatchResponse> {
    const results: BatchAttemptResult[] = []

    for (const [index, item] of items.entries()) {
      results.push(await this.runBatchItem(userId, index, item))
    }

    return { results }
  }

  private async runBatchItem(
    userId: string,
    index: number,
    item: BatchAttemptItem,
  ): Promise<BatchAttemptResult> {
    try {
      const response = await this.createAttempt(userId, item)

      if ('isCorrect' in response) return { index, status: 'saved', isCorrect: response.isCorrect }

      return { index, status: 'saved' }
    } catch (error) {
      if (!isClientError(error)) throw error

      return { index, status: 'rejected' }
    }
  }

  private async loadEntry(input: AttemptInput): Promise<IndexEntry> {
    const entry = await this.catalogService.getEntry(input.questionId)
    if (entry === undefined) {
      throw new BadRequestException(`없는 문항이다: ${input.questionId}`)
    }

    if (!hasOnlyExistingChoices(input.selected, entry.choiceCount)) {
      throw new BadRequestException(`선택지 ${entry.choiceCount}개인 문항의 범위를 벗어난 키다`)
    }

    return entry
  }

  /**
   * exam이 아니면 `sessionId`를 **무시하고** null을 준다. `attempts_session_source` check가
   * DB에서 같은 규칙을 강제하므로 여기서 따로 400을 만들 이유가 없다.
   *
   * 무시하는 것이 「무엇이든 받는다」는 뜻은 아니다 — 값의 **모양**은 DTO의 `@IsUUID()`가
   * 앞에서 거르므로 uuid가 아닌 `sessionId`는 여기 오기 전에 400이다.
   */
  private async resolveSessionId(userId: string, input: AttemptInput): Promise<string | null> {
    if (input.source !== 'exam') return null

    if (input.sessionId === undefined) {
      throw new BadRequestException('exam 시도에는 sessionId가 필요하다')
    }

    const session = await this.repository.findSession(input.sessionId, userId)
    if (session === undefined) throw new NotFoundException('세션을 찾을 수 없다')
    if (session.finishedAt !== null) throw new ConflictException('이미 종료된 세션이다')

    if (!session.questionIds.includes(input.questionId)) {
      throw new BadRequestException('그 세션이 묻지 않은 문항이다')
    }

    return input.sessionId
  }
}

const CLIENT_ERROR_MIN = 400
const SERVER_ERROR_MIN = 500

function isClientError(error: unknown): boolean {
  if (!(error instanceof HttpException)) return false

  const status = error.getStatus()

  return status >= CLIENT_ERROR_MIN && status < SERVER_ERROR_MIN
}

/** 필터 모드가 `false`를 보낸다. 값이 없으면 순차 진행이므로 기본은 true다 (`docs/05`). */
export function shouldAdvancePointer(input: CreateAttemptRequest): boolean {
  return input.source === 'sequential' && input.advancesPointer !== false
}
