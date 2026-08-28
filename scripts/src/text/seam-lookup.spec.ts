import { describe, expect, it } from 'vitest'
import { buildSeamLookup } from './seam-lookup.ts'

describe('buildSeamLookup', () => {
  it('세 글자 열쇠에 근거가 있으면 그 판정을 쓴다', () => {
    const seamHasSpace = buildSeamLookup('가나다 라마바 가나다 라마바')

    expect(seamHasSpace('앞 가나다', '라마바 뒤')).toBe(true)
  })

  it('넓은 열쇠에 근거가 없으면 좁혀서 본다', () => {
    // "다라"는 없지만 "다 라"가 있다 — 세 글자로는 못 찾고 두 글자로 찾는다.
    const seamHasSpace = buildSeamLookup('마바다 라사아')

    expect(seamHasSpace('가나다', '라마바')).toBe(true)
  })

  it('붙어 나온 쪽이 잦으면 붙인다', () => {
    const seamHasSpace = buildSeamLookup('가나다라 가나다라 가나 다라')

    expect(seamHasSpace('앞 가나', '다라 뒤')).toBe(false)
  })

  it('어느 폭에도 근거가 없으면 붙인다 — 잘못 넣은 공백이 단어를 쪼갠다', () => {
    expect(buildSeamLookup('상관없는 코퍼스')('가나', '다라')).toBe(false)
  })

  it('공백이 섞인 열쇠는 그 폭을 건너뛴다', () => {
    // 세 글자 열쇠 "나 다"는 공백을 품어 건너뛰고, 한 글자 "다"+"라"가 결정한다.
    const seamHasSpace = buildSeamLookup('마다 라바 사다 라아')

    expect(seamHasSpace('가나 다', '라마')).toBe(true)
  })
})
