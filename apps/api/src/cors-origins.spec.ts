import { describe, expect, it } from 'vitest'

import { parseAllowedOrigins } from './cors-origins'

describe('parseAllowedOrigins', () => {
  it('완전 일치 Origin은 문자열 그대로 남긴다', () => {
    expect(parseAllowedOrigins('http://localhost:3000')).toEqual(['http://localhost:3000'])
  })

  it('공백과 빈 항목을 버린다', () => {
    expect(parseAllowedOrigins(' http://localhost:3000 , ,https://example.com')).toEqual([
      'http://localhost:3000',
      'https://example.com',
    ])
  })

  it('허용 Origin이 하나도 없으면 부팅에서 멈춘다', () => {
    expect(() => parseAllowedOrigins(' , ')).toThrow()
  })

  it('와일드카드가 프리뷰 도메인을 매치한다', () => {
    const [matcher] = parseAllowedOrigins('https://aws-study-web-*.vercel.app')

    expect(matcher).toBeInstanceOf(RegExp)
    const pattern = matcher as RegExp
    expect(pattern.test('https://aws-study-web-abc123-pcjo1202.vercel.app')).toBe(true)
    expect(pattern.test('https://aws-study-web-git-chore-sjo-3-pcjo1202.vercel.app')).toBe(true)
  })

  it('와일드카드가 호스트 레이블을 넘지 않는다', () => {
    const pattern = parseAllowedOrigins('https://aws-study-web-*.vercel.app')[0] as RegExp

    // 점을 넘어가면 `https://aws-study-web-x.evil.com` 같은 남의 도메인이 통과한다.
    expect(pattern.test('https://aws-study-web-x.evil.com')).toBe(false)
    expect(pattern.test('https://aws-study-web-x.attacker.vercel.app')).toBe(false)
    expect(pattern.test('https://evil-aws-study-web-x.vercel.app')).toBe(false)
  })
})
