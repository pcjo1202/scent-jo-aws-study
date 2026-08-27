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
    const [matcher] = parseAllowedOrigins('https://aws-study-*-smelljo.vercel.app')

    expect(matcher).toBeInstanceOf(RegExp)
    const pattern = matcher as RegExp
    // Vercel이 실제로 주는 세 형태 (2026-08-27 실측).
    expect(pattern.test('https://aws-study-dzz5vnfco-smelljo.vercel.app')).toBe(true)
    expect(pattern.test('https://aws-study-web-git-main-smelljo.vercel.app')).toBe(true)
    expect(pattern.test('https://aws-study-web-smelljo.vercel.app')).toBe(true)
  })

  it('와일드카드가 호스트 레이블을 넘지 않는다', () => {
    const pattern = parseAllowedOrigins('https://aws-study-*-smelljo.vercel.app')[0] as RegExp

    // 점을 넘어가면 `https://aws-study-web-x.evil.com` 같은 남의 도메인이 통과한다.
    expect(pattern.test('https://aws-study-x-smelljo.evil.com')).toBe(false)
    expect(pattern.test('https://aws-study-x.attacker-smelljo.vercel.app')).toBe(false)
    // 남의 스코프. `-smelljo` 접미사가 유일한 방어선이다.
    expect(pattern.test('https://aws-study-x-attacker.vercel.app')).toBe(false)
  })
})
