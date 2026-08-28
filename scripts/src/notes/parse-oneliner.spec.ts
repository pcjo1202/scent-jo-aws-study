import { describe, expect, it } from 'vitest'
import { mergeOneLiners, parseOneLiners, type OneLinerLines } from './parse-oneliner.ts'

/** 입력은 원본을 옮기지 않고 구조만 흉내 낸 합성 그룹이다. */
describe('parseOneLiners', () => {
  it('카드는 직전 카테고리 그룹을 쓴다 — 섹션 구분자는 저절로 덮인다', () => {
    const cards = parseOneLiners([
      ['컴퓨트'], // 섹션 구분자
      ['컴퓨트'],
      ['서비스 하나', '설명 하나'],
      ['스토리지'], // 섹션 구분자
      ['스토리지'],
      ['서비스 둘', '설명 둘'],
    ])

    expect(cards).toEqual([
      { service: ['서비스 하나'], category: '컴퓨트', note: ['설명 하나'] },
      { service: ['서비스 둘'], category: '스토리지', note: ['설명 둘'] },
    ])
  })

  it('노트 줄은 붙이지 않고 그대로 넘긴다 — 잇는 것은 판본을 합칠 때다', () => {
    const cards = parseOneLiners([['카테고리'], ['서비스', '앞줄이 여기서', '뒷줄로 이어진다']])

    expect(cards[0]?.note).toEqual(['앞줄이 여기서', '뒷줄로 이어진다'])
  })

  it('카테고리 없이 카드가 먼저 오면 던진다', () => {
    expect(() => parseOneLiners([['서비스', '설명']])).toThrow('카테고리 없이 시작하는 카드')
  })
})

describe('mergeOneLiners', () => {
  const mobile: OneLinerLines[] = [
    { service: ['어떤 서비스'], category: '컴퓨트', note: ['앞줄 끝 가나 다', '라마 뒷줄'] },
  ]
  const desktop: OneLinerLines[] = [
    { service: ['어떤', '서비스'], category: '컴퓨트', note: ['앞줄 끝 가나', '다라마 뒷줄'] },
  ]

  it('두 판본을 합쳐 이음매 공백을 복원한다', () => {
    expect(mergeOneLiners([mobile, desktop])).toEqual({
      items: [{ service: '어떤 서비스', category: '컴퓨트', note: '앞줄 끝 가나 다라마 뒷줄' }],
      unknownSeams: 0,
    })
  })

  it('판본의 개수가 다르면 던진다', () => {
    expect(() => mergeOneLiners([mobile, []])).toThrow('한줄노트 개수가 다르다')
  })

  it('판본의 카테고리가 다르면 던진다', () => {
    const other = [{ ...desktop[0]!, category: '스토리지' }]

    expect(() => mergeOneLiners([mobile, other])).toThrow('카테고리가 다르다')
  })

  it('판본이 다른 글자를 읽었으면 던진다', () => {
    const other = [{ ...desktop[0]!, note: ['전혀 다른 문장'] }]

    expect(() => mergeOneLiners([mobile, other])).toThrow('서로 다른 내용을 읽었다')
  })
})
