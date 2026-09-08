/**
 * `tokens.css`를 파싱해 역할 → hex로 해석한다.
 *
 * 화면이 보는 값은 `--sys-color-*`이고 그 값은 `--ref-*`를 한 번 거친다. 문서 표와
 * 대조하려면 그 참조를 풀어야 한다 — 손으로 옮겨 적으면 옮겨 적은 것을 검증하게 된다.
 */

const SYS_COLOR_PREFIX = '--sys-color-'
const LIGHT_SELECTOR = ':root'
const DARK_SELECTOR = "[data-theme='dark']"

export type ThemeName = 'light' | 'dark'
export type Palette = Record<string, string>
export type Tokens = { light: Palette; dark: Palette; referenceCount: number }

type Block = { selector: string; declarations: Array<[string, string]> }

/**
 * 다크는 색 역할만 재매핑하므로 라이트 위에 덮어쓴다. 재매핑되지 않은 역할까지
 * 다크에서 사라지면 문서 표에 있는 행을 「없다」고 잘못 판정한다.
 */
export function parseTokens(css: string): Tokens {
  const references = new Map<string, string>()
  const light: Palette = {}
  const dark: Palette = {}

  for (const { selector, declarations } of readBlocks(stripComments(css))) {
    for (const [property, value] of declarations) {
      if (property.startsWith('--ref-')) references.set(property, value)
      if (!property.startsWith(SYS_COLOR_PREFIX)) continue

      const role = property.slice(SYS_COLOR_PREFIX.length)
      if (selector === DARK_SELECTOR) dark[role] = value
      else if (selector === LIGHT_SELECTOR) light[role] = value
      else throw new Error(`색 역할이 모르는 셀렉터 아래 있다: «${selector}»의 ${property}`)
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

/**
 * 중첩을 평탄화하되 **바깥 셀렉터를 붙여서** 내보낸다. `@media` 안의 `:root`를 그냥
 * `:root`로 접으면 조건부 값이 무조건 값으로 기록되고, 그건 조용히 틀리는 종류다 —
 * 위 `parseTokens`가 모르는 셀렉터를 만나면 던지는 것이 그 방어다.
 */
function readBlocks(css: string): Block[] {
  const blocks: Block[] = []
  let at = 0

  while (at < css.length) {
    const open = css.indexOf('{', at)
    if (open < 0) break

    const selector = css.slice(at, open).trim()
    const close = closingBrace(css, open)
    const body = css.slice(open + 1, close)

    if (body.includes('{')) {
      for (const nested of readBlocks(body)) {
        blocks.push({
          selector: `${selector} ${nested.selector}`,
          declarations: nested.declarations,
        })
      }
    } else {
      blocks.push({ selector, declarations: readDeclarations(body) })
    }
    at = close + 1
  }
  return blocks
}

function closingBrace(css: string, open: number): number {
  let depth = 0
  for (let at = open; at < css.length; at += 1) {
    if (css[at] === '{') depth += 1
    if (css[at] === '}') {
      depth -= 1
      if (depth === 0) return at
    }
  }
  throw new Error('tokens.css의 중괄호가 닫히지 않는다')
}

function readDeclarations(body: string): Array<[string, string]> {
  const declarations: Array<[string, string]> = []

  for (const line of body.split(';')) {
    const at = line.indexOf(':')
    if (at < 0) continue

    const property = line.slice(0, at).trim()
    if (property.startsWith('--')) declarations.push([property, line.slice(at + 1).trim()])
  }
  return declarations
}
