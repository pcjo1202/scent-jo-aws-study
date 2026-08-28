import { describe, expect, it } from 'vitest'

import { toChoiceResult } from './choice-result'

describe('toChoiceResult', () => {
  const singleAnswer = { selected: ['A' as const], answer: ['B' as const] }

  it('고른 정답', () => {
    expect(toChoiceResult('A', { selected: ['A'], answer: ['A'] })).toBe('chosen-correct')
  })

  it('고른 오답', () => {
    expect(toChoiceResult('A', singleAnswer)).toBe('chosen-wrong')
  })

  it('안 고른 정답', () => {
    expect(toChoiceResult('B', singleAnswer)).toBe('missed-correct')
  })

  it('안 고른 오답', () => {
    expect(toChoiceResult('C', singleAnswer)).toBe('unchosen-wrong')
  })

  it('복수정답에서 하나만 맞히면 네 자리가 모두 나온다', () => {
    const attempt = { selected: ['A' as const, 'C' as const], answer: ['A' as const, 'B' as const] }

    expect(toChoiceResult('A', attempt)).toBe('chosen-correct')
    expect(toChoiceResult('B', attempt)).toBe('missed-correct')
    expect(toChoiceResult('C', attempt)).toBe('chosen-wrong')
    expect(toChoiceResult('D', attempt)).toBe('unchosen-wrong')
  })
})
