/**
 * `tokens.css`를 파싱해 역할 → hex로 해석한다.
 *
 * 화면이 보는 값은 `--sys-color-*`이고 그 값은 `--ref-*`를 한 번 거친다. 문서 표와
 * 대조하려면 그 참조를 풀어야 한다 — 손으로 옮겨 적으면 옮겨 적은 것을 검증하게 된다.
 */

const SYS_COLOR_PREFIX = '--sys-color-'
const DARK_SELECTOR = "[data-theme='dark']"

export type ThemeName = 'light' | 'dark'
export type Palette = Record<string, string>
export type Tokens = { light: Palette; dark: Palette; referenceCount: number }

/**
 * 다크는 색 역할만 재매핑하므로 라이트 위에 덮어쓴다. 재매핑되지 않은 역할까지
 * 다크에서 사라지면 문서 표에 있는 행을 「없다」고 잘못 판정한다.
 */
export function parseTokens(css: string): Tokens {
  const blocks = readBlocks(stripComments(css))
  const references = new Map<string, string>()
  const light: Palette = {}
  const dark: Palette = {}

  for (const { selector, declarations } of blocks) {
    for (const [property, value] of declarations) {
      if (property.startsWith('--ref-')) references.set(property, value)
      if (!property.startsWith(SYS_COLOR_PREFIX)) continue

      const role = property.slice(SYS_COLOR_PREFIX.length)
      if (selector === DARK_SELECTOR) dark[role] = value
      else light[role] = value
    }
  }

  return {
    light: resolveAll(light, references),
    dark: resolveAll({ ...light, ...dark }, references),
    referenceCount: references.size,
  }
}

function resolveAll(palette: Palette, references: Map<string, string>): Palette {
  return Object.fromEntries(
    Object.entries(palette).map(([role, value]) => [role, resolve(role, value, references)]),
  )
}

/** 참조가 한 단계 더 깊어지면 그때 재귀로 바꾼다 — 지금 계층은 sys → ref 한 번뿐이다. */
function resolve(role: string, value: string, references: Map<string, string>): string {
  const variable = /^var\((--[\w-]+)\)$/.exec(value)?.[1]
  if (!variable) return value

  const resolved = references.get(variable)
  if (!resolved) throw new Error(`${SYS_COLOR_PREFIX}${role}가 없는 참조를 가리킨다: ${variable}`)
  return resolved
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function readBlocks(
  css: string,
): Array<{ selector: string; declarations: Array<[string, string]> }> {
  const blocks: Array<{ selector: string; declarations: Array<[string, string]> }> = []

  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] ?? '').trim()
    const declarations: Array<[string, string]> = []

    for (const line of (match[2] ?? '').split(';')) {
      const at = line.indexOf(':')
      if (at < 0) continue

      const property = line.slice(0, at).trim()
      if (property.startsWith('--')) declarations.push([property, line.slice(at + 1).trim()])
    }
    blocks.push({ selector, declarations })
  }
  return blocks
}
