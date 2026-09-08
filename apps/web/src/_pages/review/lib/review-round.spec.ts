import { describe, expect, it } from 'vitest'

import { hasRemainingWrong } from './review-round'

const SET_SIZE = 27

describe('필터가 없을 때', () => {
  it('세트를 다 맞히면 남은 오답이 없다', () => {
    expect(hasRemainingWrong({ total: SET_SIZE, correctCount: SET_SIZE, hasFilter: false })).toBe(
      false,
    )
  })

  it('하나라도 틀렸으면 남아 있다', () => {
    expect(
      hasRemainingWrong({ total: SET_SIZE, correctCount: SET_SIZE - 1, hasFilter: false }),
    ).toBe(true)
  })

  it('하나도 못 맞혀도 남아 있다', () => {
    expect(hasRemainingWrong({ total: SET_SIZE, correctCount: 0, hasFilter: false })).toBe(true)
  })
})

describe('필터가 걸렸을 때', () => {
  it('다 맞혀도 남은 것으로 본다 — 필터 밖의 오답을 이 화면이 모른다', () => {
    expect(hasRemainingWrong({ total: 9, correctCount: 9, hasFilter: true })).toBe(true)
  })

  it('틀린 것이 있으면 필터와 무관하게 남아 있다', () => {
    expect(hasRemainingWrong({ total: 9, correctCount: 8, hasFilter: true })).toBe(true)
  })
})
