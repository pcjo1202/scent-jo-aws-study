import { describe, expect, it } from 'vitest'
import { parseComparisons } from './parse-comparison.ts'

/**
 * 입력은 원본을 옮기지 않고 구조만 흉내 낸 합성 그룹이다.
 *
 * 빈 줄 그룹의 경계가 어긋나는 경우를 한 입력에 모았다 — 결정적 차이가 두 줄로
 * 접히면 그 뒷줄이 다음 구성원의 그룹에 딸려 나온다. 실제 원본에 5건 있다.
 */
const IMPORTANCE = new Map([
  ['가 vs 나', 3],
  ['다 vs 라', 1],
])

describe('parseComparisons', () => {
  const comparisons = parseComparisons(
    [
      ['가 vs 나'],
      ['            가'],
      ['선택 신호                    탈락 신호'],
      ['왼쪽 신호 하나 / 왼쪽 신호      오른쪽 신호 하나 /', '둘                          오른쪽 신호 둘'],
      ['★ 결정적 차이     가의 차이가 여기서 접히고', '                  뒷줄로 이어진다'],
      // 접힌 뒷줄이 다음 구성원명과 같은 그룹으로 온다.
      ['            나'],
      ['선택 신호                    탈락 신호'],
      ['왼쪽만 있는 줄', '                            오른쪽만 있는 줄'],
      ['★ 결정적 차이     나의 차이'],
      ['다 vs 라'],
      ['            다'],
      ['선택 신호                    탈락 신호'],
      ['다의 선택                     다의 탈락'],
      ['★ 결정적 차이     다의 차이'],
      ['다 vs 라 (계속)'],
      ['            라'],
      ['선택 신호                    탈락 신호'],
      ['라의 선택                     라의 탈락'],
      ['★ 결정적 차이     라의 차이'],
    ],
    IMPORTANCE,
    // 이음매 판정은 `../text/seam-lookup.spec.ts`가 덮는다. 여기서는 열·경계만 본다.
    () => true,
  )

  it('제목·중요도·구성원을 읽는다', () => {
    expect(comparisons.map((comparison) => [comparison.title, comparison.importance])).toEqual([
      ['가 vs 나', 3],
      ['다 vs 라', 1],
    ])
  })

  it('(계속) 카드는 같은 비교쌍에 이어 붙는다', () => {
    expect(comparisons[1]?.members.map((member) => member.name)).toEqual(['다', '라'])
  })

  it('두 줄로 접힌 결정적 차이가 다음 구성원명과 섞이지 않는다', () => {
    expect(comparisons[0]?.members[0]?.keyDifference).toBe('가의 차이가 여기서 접히고 뒷줄로 이어진다')
    expect(comparisons[0]?.members[1]?.name).toBe('나')
    expect(comparisons[0]?.members[1]?.keyDifference).toBe('나의 차이')
  })

  it('2열 본문을 열별로 모으고 접힌 줄을 잇는다', () => {
    expect(comparisons[0]?.members[0]).toMatchObject({
      selectSignals: '왼쪽 신호 하나 / 왼쪽 신호 둘',
      rejectSignals: '오른쪽 신호 하나 / 오른쪽 신호 둘',
    })
  })

  it('한쪽 열만 있는 줄은 들여쓰기로 열이 정해진다', () => {
    expect(comparisons[0]?.members[1]).toMatchObject({
      selectSignals: '왼쪽만 있는 줄',
      rejectSignals: '오른쪽만 있는 줄',
    })
  })
})

describe('parseComparisons — 원본 구성이 바뀌면 멈춘다', () => {
  const card = [['가 vs 나'], ['   가'], ['선택 신호    탈락 신호'], ['왼쪽    오른쪽'], ['★ 결정적 차이    차이']]

  it('PC판에 중요도가 없는 제목이면 던진다', () => {
    expect(() => parseComparisons(card, new Map())).toThrow('중요도 표기가 없는 비교쌍')
  })

  it('제목 없이 구성원이 오면 던진다', () => {
    expect(() => parseComparisons(card.slice(1), IMPORTANCE)).toThrow('제목 없이 시작하는 구성원')
  })

  it('구성원명 없이 신호 표가 시작되면 던진다', () => {
    expect(() => parseComparisons([['선택 신호    탈락 신호']], IMPORTANCE)).toThrow(
      '구성원명 없이 신호 표가 시작됐다',
    )
  })
})
