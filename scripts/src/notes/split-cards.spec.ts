import { describe, expect, it } from 'vitest'
import { splitNoteSections } from './split-cards.ts'

/**
 * 페이지 장식은 골든 픽스처가 못 잡는다 — 픽스처의 입력은 이 함수를 **통과한
 * 뒤의** 그룹이라 장식이 이미 걷혀 있다 (`08-testing.md` 「골든 픽스처」).
 *
 * 그래서 우회 경로를 한 입력에 전부 담고 몇 개를 걸러내는지 센다. 위반 샘플
 * 하나가 잡히는 것은 "규칙이 돈다"는 증거이지 "막는다"는 증거가 아니다
 * (`LESSONS.md` 2026-08-28 「프로브를 한 형태만 만들어…」). 정상 케이스도 같은
 * 입력에 넣어 오탐까지 본다.
 *
 * 입력은 원본을 옮기지 않고 구조만 흉내 낸 합성 텍스트다.
 */
const PROBE = [
  '                        AWS SAA C03',
  '                               한줄노트',
  '                        부제 줄',
  '',
  '',
  '컴퓨트', // ① 섹션 구분자 — 카드 없이 카테고리만 있는 그룹
  '',
  '컴퓨트',
  '',
  '서비스 하나',
  '설명 첫 줄이 여기서 끊기고 다',
  '음 줄로 이어진다',
  '',
  '',
  '                              © 2026 저작권 줄', // ② 푸터
  '\f컴퓨트', // ③ 페이지 첫 줄에 붙은 formfeed
  '',
  '서비스 둘',
  '본문에 비교노트 참조 같은 말이 들어간다', // ⑤ 절 표지로 오인하면 안 된다
  '',
  '',
  '',
  '                            AWS SAA C03',
  '                                 비교노트',
  '                        부제 줄',
  '',
  '',
  '가 vs 나',
  '',
  '           가',
  '',
  '선택 신호                    탈락 신호',
].join('\n')

describe('splitNoteSections — 페이지 장식 우회 경로', () => {
  const sections = splitNoteSections(PROBE)
  const flat = [...sections.oneliner, ...sections.comparison].flat()

  it('① 섹션 구분자는 카드와 구분되는 단일 줄 그룹으로 남는다', () => {
    expect(sections.oneliner[0]).toEqual(['컴퓨트'])
    expect(sections.oneliner[1]).toEqual(['컴퓨트'])
  })

  it('② 푸터 줄은 어느 그룹에도 남지 않는다', () => {
    expect(flat.filter((line) => line.includes('저작권'))).toEqual([])
  })

  it('③ formfeed가 붙은 페이지 첫 줄은 온전한 줄이 된다', () => {
    expect(flat).toContain('컴퓨트')
    expect(flat.some((line) => line.includes('\f'))).toBe(false)
  })

  it('④ 카드 사이의 페이지 경계가 두 카드를 붙이지 않는다', () => {
    expect(sections.oneliner).toContainEqual([
      '서비스 하나',
      '설명 첫 줄이 여기서 끊기고 다',
      '음 줄로 이어진다',
    ])
    expect(sections.oneliner.at(-1)).toEqual([
      '서비스 둘',
      '본문에 비교노트 참조 같은 말이 들어간다',
    ])
  })

  it('⑤ 본문에 절 이름이 섞인 줄을 절 경계로 오인하지 않는다', () => {
    // 오인했다면 그 줄 뒤가 전부 비교노트 절로 넘어가 한줄노트 카드가 하나 준다.
    expect(sections.oneliner.filter((group) => group.length > 1)).toHaveLength(2)
  })

  it('두 절 표지는 그룹에서 빠지고 경계가 된다', () => {
    expect(flat.some((line) => line.includes('AWS SAA C03'))).toBe(false)
    expect(sections.comparison[0]).toEqual(['가 vs 나'])
  })
})

describe('splitNoteSections — 원본 구성이 바뀌면 멈춘다', () => {
  it('절 표지가 없으면 던진다', () => {
    expect(() => splitNoteSections('아무 줄\n')).toThrow('노트 절 표지를 찾지 못했다')
  })

  it('절 순서가 뒤집히면 던진다', () => {
    expect(() => splitNoteSections('비교노트\n\n한줄노트\n')).toThrow('원본 구성이 바뀌었다')
  })
})
