import { Injectable } from '@nestjs/common'

import { ProgressRepository } from './progress.repository'

import type {
  ProgressResponse,
  QuestionStatesResponse,
  WrongQuestionsResponse,
} from '@aws-study/shared'
import type { QuestionState } from './progress.repository'

@Injectable()
export class ProgressService {
  constructor(private readonly repository: ProgressRepository) {}

  async getSummary(userId: string): Promise<ProgressResponse> {
    const [states, lastQuestionId, activeSessionId] = await Promise.all([
      this.repository.findQuestionStates(userId),
      this.repository.findLastQuestionId(userId),
      this.repository.findActiveSessionId(userId),
    ])

    return {
      lastQuestionId,
      solvedCount: states.length,
      wrongCount: toWrongQuestionIds(states).length,
      activeSessionId,
    }
  }

  async getQuestionStates(userId: string): Promise<QuestionStatesResponse> {
    const states = await this.repository.findQuestionStates(userId)

    return { states: toStateMap(states) }
  }

  async getWrongQuestions(userId: string): Promise<WrongQuestionsResponse> {
    const states = await this.repository.findQuestionStates(userId)

    return { questionIds: toWrongQuestionIds(states) }
  }
}

/** 쿼리가 문항 번호 오름차순으로 주므로 정렬을 다시 하지 않는다. */
export function toWrongQuestionIds(states: QuestionState[]): number[] {
  return states.filter((state) => !state.isCorrect).map((state) => state.questionId)
}

export function toStateMap(states: QuestionState[]): Record<number, 'correct' | 'wrong'> {
  return Object.fromEntries(
    states.map((state) => [state.questionId, state.isCorrect ? 'correct' : 'wrong']),
  )
}
