import { describe, expect, it } from 'vitest'
import { parseDesign } from './parse-design.ts'

/** 실제 `DESIGN.md`의 절 구조만 남긴 최소 문서. 값은 검사 대상이 아니다. */
const MARKDOWN = `
### 팔레트

#### Light

| 역할 | 값 | 역할 | 값 |
|---|---|---|---|
| \`primary\` | \`#964900\` | \`on-primary\` | \`#FFFFFF\` |
| \`surface\` | \`#FFF8F5\` | | |

#### Dark

| 역할 | 값 | 역할 | 값 |
|---|---|---|---|
| \`primary\` | \`#FFB787\` | \`on-primary\` | \`#502400\` |

### 대비 검증

| 조합 | Light | Dark |
|---|---|---|
| \`on-primary\` / \`primary\` | 6.46 | 7.77 |
| \`outline\` / \`surface\` | 4.27 † | 5.84 |

### 색으로만 갈리지 않는 쌍

| 쌍 | 정상 | 색각 최악 | 보라 시절 |
|---|---|---|---|
| \`primary\` / \`error\` (Light) | 28.0 | **2.0** | 73.4 |
| \`error\` / \`correct\` (Dark) | 55.8 | 9.9 | 9.9 |
`

describe('parseDesign', () => {
  it('세 표의 본문 행을 전부 읽는다', () => {
    const design = parseDesign(MARKDOWN)

    expect(design.palette.light).toHaveLength(3)
    expect(design.palette.dark).toHaveLength(2)
    expect(design.contrast).toHaveLength(2)
    expect(design.cvd).toHaveLength(2)
  })

  it('각주 기호가 붙은 셀에서 숫자만 읽는다', () => {
    const [, outline] = parseDesign(MARKDOWN).contrast

    expect(outline).toEqual({
      foreground: 'outline',
      background: 'surface',
      light: 4.27,
      dark: 5.84,
    })
  })

  it('쌍의 테마를 라벨에서 읽고 굵게 표시를 벗긴다', () => {
    const [first] = parseDesign(MARKDOWN).cvd

    expect(first).toEqual({ a: 'primary', b: 'error', theme: 'light', normal: 28, worst: 2 })
  })

  /**
   * 머리글을 글자로 확인하지 않으면 머리글이 지워졌을 때 본문 한 줄이 대신 버려지고
   * 검사 대상이 조용히 한 행 줄어든다 (`docs/10` 「토큰 검증」).
   */
  it('머리글 행이 사라지면 던진다 — 본문을 대신 버리지 않는다', () => {
    const withoutHeader = MARKDOWN.replace('| 조합 | Light | Dark |\n', '')

    expect(() => parseDesign(withoutHeader)).toThrow(/머리글/)
  })

  it('절이 없으면 던진다 — 0행을 통과로 주지 않는다', () => {
    const renamed = MARKDOWN.replace('### 대비 검증', '### 대비 실측')

    expect(() => parseDesign(renamed)).toThrow(/「### 대비 검증」 절이 없다/)
  })

  it('표에 본문 행이 하나도 없으면 던진다', () => {
    const emptied = MARKDOWN.replace(
      /\| `on-primary` \/ `primary` \| 6\.46 \| 7\.77 \|\n/,
      '',
    ).replace(/\| `outline` \/ `surface` \| 4\.27 † \| 5\.84 \|\n/, '')

    expect(() => parseDesign(emptied)).toThrow(/본문 행/)
  })
})
