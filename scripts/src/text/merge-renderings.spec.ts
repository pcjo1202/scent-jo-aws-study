import { describe, expect, it } from 'vitest'
import { mergeRenderings } from './merge-renderings.ts'

describe('mergeRenderings', () => {
  it('다른 자리에서 접힌 두 판본을 합쳐 공백을 복원한다', () => {
    // 각 판본의 이음매(⏎ 자리)가 다른 판본에서는 줄 안쪽이라 공백이 확정된다.
    const merged = mergeRenderings([
      ['가나 다라마', '바사 아자'],
      ['가나 다라', '마 바사 아자'],
    ])

    expect(merged).toEqual({ text: '가나 다라마 바사 아자', unknownSeams: 0 })
  })

  it('두 판본이 같은 자리에서 접히면 그 자리만 미결로 남고 붙인다', () => {
    const merged = mergeRenderings([
      ['가나', '다라'],
      ['가나', '다라'],
    ])

    expect(merged).toEqual({ text: '가나다라', unknownSeams: 1 })
  })

  it('줄 안에서 넓게 벌어진 자리는 공백 하나가 있었던 것으로 본다', () => {
    // 양쪽 정렬이 만든 여백이다. 줄 끝과 달리 간격 정보가 남아 있다.
    expect(mergeRenderings([['가나     다라']])).toEqual({ text: '가나 다라', unknownSeams: 0 })
  })

  it('같은 자리를 한쪽은 공백, 다른 쪽은 붙은 것으로 읽었으면 던진다', () => {
    // 다수결로 넘기면 "추정하지 않는다"가 깨지고 하필 단어를 쪼개는 쪽으로 기운다.
    expect(() => mergeRenderings([['가나 다라'], ['가나다라']])).toThrow(
      '판본이 같은 자리를 다르게 읽었다',
    )
  })

  it('판본이 서로 다른 글자를 읽었으면 던진다', () => {
    expect(() => mergeRenderings([['가나다'], ['가나라']])).toThrow(
      '판본이 서로 다른 내용을 읽었다',
    )
  })

  it('판본이 없으면 던진다', () => {
    expect(() => mergeRenderings([])).toThrow('합칠 판본이 없다')
  })
})
