import { describe, expect, it } from 'vitest'
import { parseTokens } from './parse-tokens.ts'

const CSS = `
/* 주석은 무시한다 */
:root {
  --ref-primary-40: #964900;
  --ref-primary-80: #ffb787;
  --ref-neutral-98: #fff8f5;
}
:root {
  --sys-color-primary: var(--ref-primary-40);
  --sys-color-surface: var(--ref-neutral-98);
}
[data-theme='dark'] {
  --sys-color-primary: var(--ref-primary-80);
}
`

describe('parseTokens', () => {
  it('sys → ref 참조를 풀어 hex로 돌려준다', () => {
    const tokens = parseTokens(CSS)

    expect(tokens.light).toEqual({ primary: '#964900', surface: '#fff8f5' })
    expect(tokens.referenceCount).toBe(3)
  })

  it('다크에서 재매핑되지 않은 역할은 라이트 값을 유지한다', () => {
    const tokens = parseTokens(CSS)

    expect(tokens.dark.primary).toBe('#ffb787')
    expect(tokens.dark.surface).toBe('#fff8f5')
  })

  /** 조건부 값이 무조건 값으로 기록되면 조용히 틀린다 (`docs/10` 「토큰 검증」). */
  it('@media 안의 색 역할은 던진다 — 무조건 값으로 접지 않는다', () => {
    const nested = `${CSS}\n@media (width >= 600px) { :root { --sys-color-primary: #ff0000; } }`

    expect(() => parseTokens(nested)).toThrow(/모르는 셀렉터/)
  })

  it('미디어 쿼리라도 색이 아닌 역할은 통과시킨다', () => {
    const nested = `${CSS}\n@media (width >= 600px) { :root { --sys-layout-margin: 24px; } }`

    expect(() => parseTokens(nested)).not.toThrow()
  })

  it('없는 참조를 가리키면 던진다', () => {
    const dangling = ':root { --sys-color-primary: var(--ref-missing); }'

    expect(() => parseTokens(dangling)).toThrow(/없는 참조/)
  })
})
