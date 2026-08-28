import { describe, expect, it } from 'vitest'

import { canSubmit, isChoiceDisabled, toggleChoice } from './choice-selection'

const SINGLE = { answerCount: 1 }
const DOUBLE = { answerCount: 2 }
const TRIPLE = { answerCount: 3 }

describe('단일정답', () => {
  it('빈 상태에서 고르면 그것만 선택된다', () => {
    expect(toggleChoice([], 'B', SINGLE)).toEqual(['B'])
  })

  it('다른 선택지를 고르면 이전 선택이 풀린다', () => {
    expect(toggleChoice(['B'], 'D', SINGLE)).toEqual(['D'])
  })

  it('이미 고른 것을 다시 눌러도 유지된다', () => {
    expect(toggleChoice(['B'], 'B', SINGLE)).toEqual(['B'])
  })

  it('어떤 선택지도 비활성이 되지 않는다', () => {
    expect(isChoiceDisabled(['B'], 'D', SINGLE)).toBe(false)
    expect(isChoiceDisabled(['B'], 'B', SINGLE)).toBe(false)
  })

  it('하나를 골라야 제출할 수 있다', () => {
    expect(canSubmit([], SINGLE)).toBe(false)
    expect(canSubmit(['B'], SINGLE)).toBe(true)
  })
})

describe('복수정답', () => {
  it('토글로 쌓인다', () => {
    expect(toggleChoice(['A'], 'C', DOUBLE)).toEqual(['A', 'C'])
  })

  it('다시 누르면 해제된다', () => {
    expect(toggleChoice(['A', 'C'], 'A', DOUBLE)).toEqual(['C'])
  })

  it('필요 개수를 채우면 안 고른 선택지가 비활성이 된다', () => {
    expect(isChoiceDisabled(['A', 'C'], 'E', DOUBLE)).toBe(true)
  })

  it('채운 상태에서도 이미 고른 것은 해제할 수 있다', () => {
    expect(isChoiceDisabled(['A', 'C'], 'C', DOUBLE)).toBe(false)
    expect(toggleChoice(['A', 'C'], 'C', DOUBLE)).toEqual(['A'])
  })

  it('상한을 넘는 선택은 무시된다 — 비활성을 우회해도 초과가 만들어지지 않는다', () => {
    expect(toggleChoice(['A', 'C'], 'E', DOUBLE)).toEqual(['A', 'C'])
  })

  it('정확히 채웠을 때만 제출할 수 있다', () => {
    expect(canSubmit(['A'], DOUBLE)).toBe(false)
    expect(canSubmit(['A', 'C'], DOUBLE)).toBe(true)
  })

  it('정답 3개 문항도 같은 규칙을 따른다', () => {
    expect(canSubmit(['A', 'C'], TRIPLE)).toBe(false)
    expect(isChoiceDisabled(['A', 'C'], 'F', TRIPLE)).toBe(false)
    expect(toggleChoice(['A', 'C'], 'F', TRIPLE)).toEqual(['A', 'C', 'F'])
    expect(canSubmit(['A', 'C', 'F'], TRIPLE)).toBe(true)
  })
})
