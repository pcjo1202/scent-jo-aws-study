import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseAllowedOrigins } from './cors-origins'

describe('parseAllowedOrigins', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

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

    expect(pattern.test('https://aws-study-x-smelljo.evil.com')).toBe(false)
    expect(pattern.test('https://aws-study-x.attacker-smelljo.vercel.app')).toBe(false)
    expect(pattern.test('https://aws-study-x-attacker.vercel.app')).toBe(false)
    expect(pattern.test('http://aws-study-x-smelljo.vercel.app')).toBe(false)
  })

  it('스코프 접미사는 방어선이 아니다 — 남이 만들 수 있는 형태를 통과시킨다', () => {
    const pattern = parseAllowedOrigins('https://aws-study-*-smelljo.vercel.app')[0] as RegExp

    // 팀 슬러그를 `evil-smelljo`로 잡고 프로젝트를 `aws-study`로 만들면 누구나 얻는 호스트다.
    // 남은 위험은 `credentials`를 켜지 않고 인증을 Bearer JWT로 두는 것으로 막는다 (docs/06).
    expect(pattern.test('https://aws-study-x-evil-smelljo.vercel.app')).toBe(true)
  })

  it('배포에서 변수가 없으면 로컬 폴백 없이 부팅에서 멈춘다', () => {
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('CORS_ALLOWED_ORIGINS', undefined)

    expect(() => parseAllowedOrigins()).toThrow()
  })

  it('로컬에서 변수가 없으면 localhost로 떨어진다', () => {
    vi.stubEnv('VERCEL', undefined)
    vi.stubEnv('CORS_ALLOWED_ORIGINS', undefined)

    expect(parseAllowedOrigins()).toEqual(['http://localhost:3000'])
  })
})
