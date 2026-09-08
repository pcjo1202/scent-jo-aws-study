import { describe, expect, it } from 'vitest'

import { wrongQuestionsQuery } from './me'

const API_URL = 'http://localhost:4000'

describe('오답 목록 쿼리', () => {
  /**
   * 「진입 시 고정」을 지키는 것이 이 두 옵션이다. 지우면 포커스·재연결 재조회가 화면의
   * `key` 밖에서 세트를 줄여, 커서는 그대로인 채 문항만 바뀌고 직전 채점 결과가 다음 문항의
   * 카드 위에 남는다 (`docs/02-features.md` 「`/review` 오답 복습」).
   */
  it('포커스·재연결 재조회를 끈다', () => {
    const options = wrongQuestionsQuery(API_URL)

    expect(options.refetchOnWindowFocus).toBe(false)
    expect(options.refetchOnReconnect).toBe(false)
  })

  /** `staleTime`을 고정하면 **재진입**까지 막힌다 — 그때는 세트가 새로 고정돼야 한다. */
  it('staleTime을 건드리지 않는다', () => {
    expect(wrongQuestionsQuery(API_URL).staleTime).toBeUndefined()
  })
})
