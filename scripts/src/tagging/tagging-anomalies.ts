import { MAX_CATEGORIES, type QuestionTopics } from './tag-question.ts'

/**
 * 태깅 결과에서 산출을 막아야 할 이상치를 센다 (`04-data-model.md` 「오분류 대응」).
 *
 * 분포를 출력만 하면 사전이 무너져도 사람이 알아채기 전까지 그대로 나간다. 조잡한
 * 붕괴만 기계가 막고, 그 아래 편중은 출력 전문을 사람이 읽는다.
 */

/** 한 카테고리가 이보다 많이 먹으면 별칭 사전이나 롤업이 무너진 것이다. */
export const MAX_CATEGORY_SHARE = 0.5
/**
 * 미태깅이 이보다 많으면 사전이 통째로 무너진 것이다.
 *
 * 편중 상한만으로는 못 잡는다 — 아무 카테고리도 안 붙으면 쏠릴 것도 없다. 실측
 * 0.6%이고 루트 별칭을 전부 빼도 6.2%라, 10%는 그 위의 붕괴만 잡는다.
 */
export const MAX_UNTAGGED_SHARE = 0.1

export type TaggingAnomalies = {
  /** 이 개수를 넘긴 카테고리가 편중이다. */
  limit: number
  untaggedLimit: number
  untagged: number
  countsByCategory: Array<[category: string, count: number]>
  overweight: Array<[category: string, count: number]>
  anomalyCounts: Record<string, number>
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
  const untaggedLimit = Math.floor(questions.length * MAX_UNTAGGED_SHARE)
  const untagged = questions.filter((question) => question.services.length === 0).length
  const ranked = [...countsByCategory].sort(([, a], [, b]) => b - a)
  const overweight = ranked.filter(([, count]) => count > limit)

  return {
    limit,
    untaggedLimit,
    untagged,
    countsByCategory: ranked,
    overweight,
    total: questions.length,
    anomalyCounts: {
      '카테고리 편중': overweight.length,
      '미태깅 과다': untagged > untaggedLimit ? 1 : 0,
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
