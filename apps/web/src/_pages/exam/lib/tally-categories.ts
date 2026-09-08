import type { ExamResult } from '@aws-study/shared'

export type CategoryTally = { category: string; total: number; correct: number }

/**
 * 세션 결과를 카테고리별로 센다 (`docs/02-features.md` 「결과 화면의 구성」).
 *
 * **문항은 자기 카테고리 전부에 산입된다** — `docs/05-database.md` 「카테고리별 정답률」이
 * `/stats`에 대해 확정한 것과 같은 규칙이라, 막대에서 본 것과 필터로 모은 것이 같은 집합이
 * 된다. 그래서 `sum(total)`은 65보다 크고, 카테고리가 0개인 문항(인덱스에 실제로 있다)은
 * 어느 막대에도 안 든다. 둘 다 정상이다.
 *
 * **약한 영역이 위로 오도록 정답률 오름차순이다** (대시보드 막대와 같은 정렬). 같은 값이면
 * 카테고리명으로 갈라 순서가 렌더마다 흔들리지 않게 한다.
 */
export function tallyCategories(
  results: ExamResult[],
  categoriesById: Map<number, string[]>,
): CategoryTally[] {
  const byCategory = new Map<string, CategoryTally>()

  for (const result of results) {
    for (const category of categoriesById.get(result.questionId) ?? []) {
      const tally = byCategory.get(category) ?? { category, total: 0, correct: 0 }
      tally.total += 1
      if (result.isCorrect) tally.correct += 1
      byCategory.set(category, tally)
    }
  }

  return [...byCategory.values()].sort(
    (left, right) =>
      left.correct / left.total - right.correct / right.total ||
      left.category.localeCompare(right.category),
  )
}
