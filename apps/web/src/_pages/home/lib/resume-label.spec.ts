import { describe, expect, it } from 'vitest'

import { toResumeLabel } from './resume-label'

describe('이어풀기 버튼 문구', () => {
  it('시도 0건이면 이어갈 지점이 없다', () => {
    expect(toResumeLabel({ hasAttempt: false, isFinished: false })).toBe('첫 문제 풀기')
  })

  it('풀던 중이면 이어풀기다', () => {
    expect(toResumeLabel({ hasAttempt: true, isFinished: false })).toBe('이어풀기')
  })

  /** `/study`의 완주 화면과 함께 바뀐다 (`docs/02-features.md` 「빈 상태」의 `/study` 행). */
  it('1019문항을 다 풀었으면 전체 완주다', () => {
    expect(toResumeLabel({ hasAttempt: true, isFinished: true })).toBe('전체 완주')
  })

  /** 완주 판정보다 「시도 0건」이 앞선다 — 둘 다 참일 수 없지만 순서를 고정해 둔다. */
  it('시도 0건이 완주보다 앞선다', () => {
    expect(toResumeLabel({ hasAttempt: false, isFinished: true })).toBe('첫 문제 풀기')
  })
})
