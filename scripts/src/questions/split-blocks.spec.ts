import { describe, expect, it } from 'vitest'
import { splitQuestionBlocks } from './split-blocks.ts'

/**
 * 합성 입력만 쓴다 — 저작권 자료를 옮기지 않으려는 것도 있지만, 골든 픽스처가
 * **이 함수를 통과한 뒤의** 블록이라 페이지 장식이 이미 걷혀 있어 여기서 원본을
 * 써도 회귀를 재현하지 못하기 때문이다 (`08-testing.md` 「골든 픽스처」).
 *
 * 이번 이슈에서 실제로 사고를 낸 지점이 formfeed였다 (`LESSONS.md` 2026-08-28).
 */

const HEADING = (id: string) => `Q. ${id}                              SAA-C03 한국어`
const FOOTER = 'AWS SAA-C03 Korean Final · 20260618                          7 / 1702'

describe('splitQuestionBlocks', () => {
  it('문항 시작 줄로 자르고 id를 숫자로 읽는다', () => {
    const blocks = splitQuestionBlocks([HEADING('001'), '지문', HEADING('1019'), '지문'].join('\n'))

    expect(blocks.map((block) => block.id)).toEqual([1, 1019])
  })

  it('페이지 푸터를 본문에서 걷어낸다', () => {
    const blocks = splitQuestionBlocks([HEADING('001'), '앞', FOOTER, '뒤'].join('\n'))

    expect(blocks[0]?.lines).toEqual(['앞', '뒤'])
  })

  it('페이지 첫 줄에 붙는 formfeed가 절 제목을 가리지 않는다', () => {
    const blocks = splitQuestionBlocks([HEADING('001'), '\f   오답 해설', '반박'].join('\n'))

    expect(blocks[0]?.lines).toEqual(['   오답 해설', '반박'])
  })

  it('formfeed가 붙은 문항 시작 줄도 잡는다', () => {
    const blocks = splitQuestionBlocks([`\f${HEADING('501')}`, '지문'].join('\n'))

    expect(blocks.map((block) => block.id)).toEqual([501])
  })

  it('앞뒤 빈 줄은 버리고 가운데 빈 줄은 남긴다', () => {
    const blocks = splitQuestionBlocks([HEADING('001'), '', '지문', '', '선택지', ''].join('\n'))

    expect(blocks[0]?.lines).toEqual(['지문', '', '선택지'])
  })

  it('첫 문항 앞의 표지는 버린다', () => {
    const blocks = splitQuestionBlocks(['표지', HEADING('001'), '지문'].join('\n'))

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.lines).toEqual(['지문'])
  })
})
