import { Injectable } from '@nestjs/common'

import { CatalogService } from '../catalog/catalog.service'
import { ProgressRepository } from '../progress/progress.repository'

import type { CategoryStats, IndexEntry, StatsResponse } from '@aws-study/shared'
import type { QuestionState } from '../progress/progress.repository'

@Injectable()
export class StatsService {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly progressRepository: ProgressRepository,
  ) {}

  /** 카테고리는 CDN 인덱스에 있고 DB에 없어 조인할 수 없다 — 앱에서 합친다 (`docs/05`). */
  async getStats(userId: string): Promise<StatsResponse> {
    const [entries, states] = await Promise.all([
      this.catalogService.listEntries(),
      this.progressRepository.findQuestionStates(userId),
    ])

    return { byCategory: toCategoryStats(entries, states) }
  }
}

type Bucket = { total: number; solved: number; correct: number }

/**
 * **문항은 자기 카테고리 전부에 산입된다** (`docs/05` 「카테고리별 정답률」, 2026-09-07 결정).
 * 카테고리 3개짜리 문항은 세 막대에 각각 1을 더하므로 `sum(total)`이 문항 수보다 크다 —
 * v1 데이터는 1665이고, 태그가 없는 6문항은 어느 막대에도 들지 않는다 (`MEMORY.md`
 * 「확인된 사실」). 둘 다 정상이다 — 응답에 합계가 없다.
 *
 * 이름순으로 준다. 낮은 정답률 순 정렬과 「안 푼 카테고리 제외」는 화면이 한다
 * (`02-features.md` 「빈 상태」 — 0%와 「아직 안 풂」은 다른 상태다).
 */
export function toCategoryStats(entries: IndexEntry[], states: QuestionState[]): CategoryStats[] {
  const correctByQuestion = new Map(states.map((state) => [state.questionId, state.isCorrect]))
  const buckets = new Map<string, Bucket>()

  for (const entry of entries) {
    const isCorrect = correctByQuestion.get(entry.id)

    for (const category of entry.categories) {
      const bucket = buckets.get(category) ?? { total: 0, solved: 0, correct: 0 }

      bucket.total += 1
      if (isCorrect !== undefined) {
        bucket.solved += 1
        if (isCorrect) bucket.correct += 1
      }

      buckets.set(category, bucket)
    }
  }

  return [...buckets]
    .map(([category, bucket]) => ({
      category,
      ...bucket,
      accuracy: bucket.solved === 0 ? 0 : bucket.correct / bucket.solved,
    }))
    .sort((left, right) => left.category.localeCompare(right.category))
}
