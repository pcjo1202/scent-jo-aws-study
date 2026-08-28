import { describe, expect, it } from 'vitest'
import { parseDesktopOneLiners, parseImportanceByTitle } from './desktop-notes.ts'

/**
 * 걷어내야 할 줄을 한 입력에 모았다. 하나만 넣고 "잡힌다"를 확인하면 나머지를 못
 * 본다 (`LESSONS.md` 2026-08-28 「프로브를 한 형태만 만들어…」). 특히 ④ 섹션 제목은
 * 실제로 앞 행의 노트 끝에 붙어 나왔던 자리다.
 *
 * 입력은 원본을 옮기지 않고 구조만 흉내 낸 합성 텍스트다.
 */
const CATEGORIES = new Set(['컴퓨트', '스토리지'])
const PROBE = [
  'Part 1 · 한줄노트',
  '          컴퓨트', // ④ 카테고리 섹션 제목
  '',
  '                    서비스명       카테고리        한줄노트', // ⑥ 표 머리글
  '',
  '서비스 하나            컴퓨트     설명이 여기서 끊기고     양쪽 정렬로 벌어진 자리', // ① 3열 + 열 안 여백
  '                                 뒷줄로 이어진다', // ③ 노트가 접힌 줄
  '',
  '                    © 2026 저작권 줄       1 / 47', // ⑤ 푸터
  '\f긴 이름을 가진 서비스 (기존       스토리지    다른 설명', // ⑤ formfeed
  '이름 뒷부분)                              설명의 뒷줄', // ② 서비스명 + 노트가 함께 접힌 줄
  '',
  '          스토리지', // ④ 카테고리 섹션 제목 — 앞 행 노트에 붙으면 안 된다
  '',
  'Part 2 · 비교노트', // ⑦ 여기부터는 읽지 않는다
  '표 뒤의 서비스        컴퓨트     읽히면 안 되는 설명',
].join('\n')

describe('parseDesktopOneLiners — 표 장식 우회 경로', () => {
  const cards = parseDesktopOneLiners(PROBE, CATEGORIES)

  it('Part 2 앞의 표 행만 읽는다', () => {
    expect(cards).toHaveLength(2)
    expect(JSON.stringify(cards)).not.toContain('읽히면 안 되는')
  })

  it('① 3열을 서비스명·카테고리·노트로 가른다', () => {
    expect(cards[0]).toMatchObject({ service: ['서비스 하나'], category: '컴퓨트' })
  })

  it('③ 들여쓰인 이어지는 줄은 노트로 간다 — 열 안 여백은 공백 하나로 접는다', () => {
    expect(cards[0]?.note).toEqual([
      '설명이 여기서 끊기고 양쪽 정렬로 벌어진 자리',
      '뒷줄로 이어진다',
    ])
  })

  it('② 들여쓰기 없이 이어지는 줄의 첫 조각은 서비스명이 접힌 것이다', () => {
    expect(cards[1]).toEqual({
      service: ['긴 이름을 가진 서비스 (기존', '이름 뒷부분)'],
      category: '스토리지',
      note: ['다른 설명', '설명의 뒷줄'],
    })
  })

  it('④⑤⑥ 섹션 제목·푸터·formfeed·표 머리글은 어느 행에도 남지 않는다', () => {
    const text = JSON.stringify(cards)
    for (const decoration of ['저작권', '\\f', '서비스명', 'Part ']) {
      expect(text).not.toContain(decoration)
    }
    // 섹션 제목이 살아 있었다면 그 앞 행의 노트 끝에 붙는다.
    expect(cards.at(-1)?.note.at(-1)).toBe('설명의 뒷줄')
  })
})

describe('parseImportanceByTitle', () => {
  it('제목 뒤 ★ 개수를 읽는다 — 모바일 판본에 없는 값이다', () => {
    const importance = parseImportanceByTitle(
      [
        '가 vs 나                     [★★★]',
        '다 vs 라        [★]',
        '★ 결정적 차이   본문의 별은 세지 않는다',
      ].join('\n'),
    )

    expect([...importance]).toEqual([
      ['가 vs 나', 3],
      ['다 vs 라', 1],
    ])
  })
})
