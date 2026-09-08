import type { CategoryStats } from '@aws-study/shared'

import type { CategoryBar } from '@/shared/ui/category-bars'

const PERCENT = 100

/**
 * `GET /stats`를 대시보드의 막대로 바꾼다 (`docs/02-features.md` 「빈 상태」의 `/` 정답률 막대
 * 행). **약한 영역이 위로 오게 하는 것이 이 함수의 전부**이고, 그것이 `01-requirements.md`
 * 성공 기준 5번이다.
 *
 * **안 푼 카테고리를 뺀다.** `/stats`는 `solved`가 0이면 `accuracy`를 0으로 돌려주는데
 * (`docs/05-database.md`), 낮은 순 정렬에서 그것들이 항상 맨 위를 차지해 **실제로 약한 영역을
 * 가린다.** 0%와 「아직 안 풂」은 다른 상태다. 뺀 개수는 막대 아래 「아직 안 푼 영역 N개」가
 * 받는다.
 *
 * **정렬은 반올림 전 값으로 한다.** 표시값이 같아도 실제로 낮은 쪽이 위여야 「낮은 순」이다.
 *
 * **표시값·막대 폭·색은 반올림 뒤 값 하나에서 나온다.** 백분율을 먼저 반올림하고 그것을 다시
 * 비율로 되돌려 넘기는 이유가 그것이다 — 반올림 전 값으로 색을 가르면 `0.596`이 「60%」라고
 * 적힌 채 60% 미만 색(`error`)으로 칠해진다.
 */
export function rankCategories(byCategory: CategoryStats[]): {
  bars: CategoryBar[]
  unsolvedCount: number
} {
  const solved = byCategory.filter((stats) => stats.solved > 0)

  const bars = [...solved]
    .sort(
      (left, right) =>
        left.accuracy - right.accuracy || left.category.localeCompare(right.category),
    )
    .map((stats) => {
      const percent = Math.round(stats.accuracy * PERCENT)

      return { category: stats.category, accuracy: percent / PERCENT, value: `${percent}%` }
    })

  return { bars, unsolvedCount: byCategory.length - solved.length }
}
