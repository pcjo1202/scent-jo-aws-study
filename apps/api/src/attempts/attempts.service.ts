import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { CatalogService } from '../catalog/catalog.service'
import { grade, hasOnlyExistingChoices } from '../catalog/grading'
import { AttemptsRepository } from './attempts.repository'

import type {
  AttemptResponse,
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
   * exam이 아니면 `sessionId`를 무시하고 null을 준다 — `attempts_session_source` check가
   * DB에서 같은 규칙을 강제하므로 여기서 400을 만들 이유가 없고, 오프라인 큐가 옛 항목을
   * 재전송할 때 400 하나로 기록이 버려지는 쪽이 더 나쁘다.
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

/** 필터 모드가 `false`를 보낸다. 값이 없으면 순차 진행이므로 기본은 true다 (`docs/05`). */
export function shouldAdvancePointer(input: CreateAttemptRequest): boolean {
  return input.source === 'sequential' && input.advancesPointer !== false
}
