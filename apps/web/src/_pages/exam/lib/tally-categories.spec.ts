import { describe, expect, it } from 'vitest'

import type { ChoiceKey, ExamResult } from '@aws-study/shared'

import { tallyCategories } from './tally-categories'

function result(questionId: number, isCorrect: boolean, selected: ChoiceKey[] | null = ['A']) {
  return { questionId, selected, answer: ['A'] as ChoiceKey[], isCorrect } satisfies ExamResult
}

describe('tallyCategories', () => {
  it('문항을 자기 카테고리 전부에 산입한다 — 합이 문항 수보다 크다', () => {
    const tallies = tallyCategories(
      [result(1, true), result(2, false)],
      new Map([
        [1, ['컴퓨트', '스토리지']],
        [2, ['스토리지']],
      ]),
    )

    expect(tallies).toEqual([
      { category: '스토리지', total: 2, correct: 1 },
      { category: '컴퓨트', total: 1, correct: 1 },
    ])
    expect(tallies.reduce((sum, tally) => sum + tally.total, 0)).toBe(3)
  })

  it('카테고리가 없는 문항은 어느 막대에도 안 든다', () => {
    expect(tallyCategories([result(1, true)], new Map([[1, []]]))).toEqual([])
    expect(tallyCategories([result(1, true)], new Map())).toEqual([])
  })

  it('정답률 오름차순이고 같으면 카테고리명으로 가른다', () => {
    const tallies = tallyCategories(
      [result(1, false), result(2, true), result(3, true), result(4, true)],
      new Map([
        [1, ['낮음']],
        [2, ['높음']],
        [3, ['가나다']],
        [4, ['하하하']],
      ]),
    )

    expect(tallies.map((tally) => tally.category)).toEqual(['낮음', '가나다', '높음', '하하하'])
  })

  /** 미응답은 오답으로 채점되므로(`docs/02` 「종료 / 결과」) 분모에 들고 분자에서 빠진다. */
  it('미응답을 분모에 넣고 오답으로 센다', () => {
    expect(tallyCategories([result(1, false, null)], new Map([[1, ['컴퓨트']]]))).toEqual([
      { category: '컴퓨트', total: 1, correct: 0 },
    ])
  })
})
