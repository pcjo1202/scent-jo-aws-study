import type { QuestionTopics } from './tag-question.ts'

/**
 * 태깅 결과에서 산출을 막아야 할 이상치를 센다 (`04-data-model.md` 「오분류 대응」).
 *
 * 분포를 출력만 하면 사전이 무너져도 사람이 알아채기 전까지 그대로 나간다. 조잡한
 * 붕괴만 기계가 막고, 그 아래 편중은 출력 전문을 사람이 읽는다.
 */

/** 한 카테고리가 이보다 많이 먹으면 별칭 사전이나 롤업이 무너진 것이다. */
const MAX_CATEGORY_SHARE = 0.5
/** `04` 「Question」의 `categories`는 1~3개다. */
const MAX_CATEGORIES = 3

export type TaggingAnomalies = {
  /** 이 개수를 넘긴 카테고리가 편중이다. */
  limit: number
  countsByCategory: Array<[category: string, count: number]>
  overweight: Array<[category: string, count: number]>
  counts: Record<string, number>
  total: number
}

export function findTaggingAnomalies(
  questions: QuestionTopics[],
  knownCategories: Set<string>,
): TaggingAnomalies {
  const countsByCategory = new Map<string, number>()
  for (const { categories } of questions) {
    for (const category of categories) {
      countsByCategory.set(category, (countsByCategory.get(category) ?? 0) + 1)
    }
  }

  const limit = Math.floor(questions.length * MAX_CATEGORY_SHARE)
  const ranked = [...countsByCategory].sort(([, a], [, b]) => b - a)
  const overweight = ranked.filter(([, count]) => count > limit)

  return {
    limit,
    countsByCategory: ranked,
    overweight,
    total: questions.length,
    counts: {
      '카테고리 편중': overweight.length,
      '카테고리 상한 초과 문항': questions.filter(
        (question) => question.categories.length > MAX_CATEGORIES,
      ).length,
      '노트에 없는 카테고리': ranked.filter(([category]) => !knownCategories.has(category)).length,
      '카테고리가 중복된 문항': questions.filter(
        (question) => new Set(question.categories).size !== question.categories.length,
      ).length,
      '서비스가 없는데 카테고리가 붙은 문항': questions.filter(
        (question) => question.services.length === 0 && question.categories.length > 0,
      ).length,
    },
  }
}
