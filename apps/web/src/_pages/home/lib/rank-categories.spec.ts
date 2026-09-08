import { describe, expect, it } from 'vitest'

import type { CategoryStats } from '@aws-study/shared'

import { rankCategories } from './rank-categories'

function stats(category: string, solved: number, correct: number): CategoryStats {
  return {
    category,
    total: 100,
    solved,
    correct,
    // `/stats`가 `solved === 0`에 0을 주는 것까지 그대로 흉내낸다 (`docs/05-database.md`).
    accuracy: solved === 0 ? 0 : correct / solved,
  }
}

describe('대시보드 카테고리 막대', () => {
  /**
   * 이 제외가 없으면 안 푼 카테고리가 `accuracy: 0`으로 항상 맨 위를 차지해 **「약한 영역
   * 식별」 기능 자체가 무력화된다** (`docs/02-features.md` 「빈 상태」).
   */
  it('안 푼 카테고리를 막대에서 빼고 그 개수를 따로 준다', () => {
    const { bars, unsolvedCount } = rankCategories([
      stats('네트워크', 0, 0),
      stats('컴퓨트', 10, 4),
      stats('보안', 0, 0),
    ])

    expect(bars.map((bar) => bar.category)).toEqual(['컴퓨트'])
    expect(unsolvedCount).toBe(2)
  })

  it('정답률 오름차순 — 약한 영역이 위로 온다', () => {
    const { bars } = rankCategories([
      stats('스토리지', 10, 9),
      stats('컴퓨트', 10, 3),
      stats('네트워크', 10, 6),
    ])

    expect(bars.map((bar) => bar.category)).toEqual(['컴퓨트', '네트워크', '스토리지'])
  })

  /** 같은 값이면 이름으로 갈라 순서가 렌더마다 흔들리지 않게 한다. */
  it('동률은 카테고리명으로 가른다', () => {
    const { bars } = rankCategories([stats('하', 10, 5), stats('가', 10, 5)])

    expect(bars.map((bar) => bar.category)).toEqual(['가', '하'])
  })

  /** 표시값이 같아도 실제로 낮은 쪽이 위여야 「낮은 순」이다 — 정렬은 반올림 전 값으로 한다. */
  it('반올림 뒤 같은 값이 되는 둘도 원래 크기 순서를 지킨다', () => {
    const { bars } = rankCategories([stats('나중', 1000, 606), stats('먼저', 1000, 605)])

    expect(bars.map((bar) => bar.value)).toEqual(['61%', '61%'])
    expect(bars.map((bar) => bar.category)).toEqual(['먼저', '나중'])
  })

  /**
   * 색 판정(60% 경계)과 막대 폭이 `accuracy`에서 나오므로, 표시값과 갈리면 「60%」라고 적힌
   * 줄이 60% 미만 색으로 칠해진다.
   */
  it('표시값과 막대·색의 근거가 같은 반올림 값이다', () => {
    const [bar] = rankCategories([stats('경계', 1000, 596)]).bars

    expect(bar?.value).toBe('60%')
    expect(bar?.accuracy).toBe(0.6)
  })

  it('한 번도 안 풀었으면 막대가 없고 전부 안 푼 영역이다', () => {
    const { bars, unsolvedCount } = rankCategories([stats('가', 0, 0), stats('나', 0, 0)])

    expect(bars).toEqual([])
    expect(unsolvedCount).toBe(2)
  })
})
