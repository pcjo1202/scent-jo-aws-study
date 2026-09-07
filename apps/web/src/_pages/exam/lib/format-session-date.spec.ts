import { describe, expect, it } from 'vitest'

import { formatSessionDate } from './format-session-date'

describe('formatSessionDate', () => {
  it('UTC 날짜가 아니라 한국 날짜로 읽는다', () => {
    // 2026-09-04T23:00Z는 한국에서 9월 5일 아침이다. UTC로 자르면 하루 전이 된다.
    expect(formatSessionDate('2026-09-04T23:00:00.000Z')).toBe('2026. 9. 5.')
  })

  it('기기 시간대와 무관하게 같은 문자열을 낸다', () => {
    // 서버와 브라우저가 갈리면 하이드레이션이 깨진다 — 값이 하나여야 한다.
    expect(formatSessionDate('2026-09-05T14:30:00.000Z')).toBe('2026. 9. 5.')
  })
})
