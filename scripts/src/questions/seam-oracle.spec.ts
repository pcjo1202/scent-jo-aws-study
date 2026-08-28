import { describe, expect, it } from 'vitest'
import { buildSeamOracle, seamKey } from './seam-oracle.ts'

// 저작권 자료를 옮기지 않으려고 합성 코퍼스를 쓴다. 판정 논리만 본다.
const CORPUS = [
  '가나 다라', // 띄어 쓴 쪽 2회
  '가나 다라',
  '가나다라', // 붙여 쓴 쪽 1회
  '마바사아', // 붙여 쓴 쪽 2회
  '마바사아',
  '마바 사아', // 띄어 쓴 쪽 1회
].join('\n')

describe('buildSeamOracle', () => {
  const seamHasSpace = buildSeamOracle(CORPUS)

  it('코퍼스에서 띄어 쓴 쪽이 많으면 띄운다', () => {
    expect(seamHasSpace('가나', '다라')).toBe(true)
  })

  it('붙여 쓴 쪽이 많거나 같으면 붙인다', () => {
    expect(seamHasSpace('마바', '사아')).toBe(false)
  })

  it('코퍼스에 없는 조합은 붙인다 — 없는 근거로 띄우면 단어를 쪼갠다', () => {
    expect(seamHasSpace('없는', '조합')).toBe(false)
  })

  it('한글이 아니거나 문맥이 짧으면 판정하지 않는다', () => {
    expect(seamKey('S3', '버킷은')).toBeUndefined()
    expect(seamKey('가', '나다')).toBeUndefined()
  })

  it('직전 어절의 끝 두 글자만 본다', () => {
    expect(seamHasSpace('아주 긴 앞말 가나', '다라')).toBe(true)
  })
})
