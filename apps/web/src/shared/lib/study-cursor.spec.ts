import { describe, expect, it } from 'vitest'

import { toStartIndex } from './study-cursor'

const SEQUENTIAL = [1, 2, 3, 4, 5]

/** 필터를 걸면 문항 번호가 연속이 아니다. */
const FILTERED = [3, 17, 42]

const NO_POINTER = 0

describe('전체 세트', () => {
  it('한 번도 안 풀었으면 첫 문항에서 연다', () => {
    expect(toStartIndex(SEQUENTIAL, NO_POINTER)).toBe(0)
  })

  it('포인터의 다음 문항에서 연다', () => {
    expect(toStartIndex(SEQUENTIAL, 3)).toBe(3)
  })

  it('마지막 문항을 풀었으면 완주다', () => {
    expect(toStartIndex(SEQUENTIAL, 5)).toBeNull()
  })

  it('포인터가 세트 밖으로 넘어가도 완주다', () => {
    expect(toStartIndex(SEQUENTIAL, 9999)).toBeNull()
  })
})

describe('필터 세트', () => {
  it('포인터를 무시하고 부분집합의 처음부터다 — 진행 위치를 저장하지 않는다', () => {
    expect(toStartIndex(FILTERED, NO_POINTER)).toBe(0)
  })

  it('전체 포인터를 그대로 넘기면 앞쪽이 통째로 건너뛰어진다 — 그래서 0을 넘긴다', () => {
    expect(toStartIndex(FILTERED, 20)).toBe(2)
    expect(toStartIndex(FILTERED, NO_POINTER)).toBe(0)
  })

  it('번호가 연속이 아니어도 「다음」의 뜻은 같다', () => {
    expect(toStartIndex(FILTERED, 3)).toBe(1)
  })
})

describe('빈 세트', () => {
  it('완주와 같은 값을 준다 — 가르는 것은 세트 크기다', () => {
    expect(toStartIndex([], NO_POINTER)).toBeNull()
  })
})
