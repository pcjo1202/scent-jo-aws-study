/**
 * `DESIGN.md`의 색 관련 표 셋을 읽는다 — 「팔레트」·「대비 검증」·「색으로만 갈리지 않는 쌍」.
 *
 * 기대값을 이 파일에 적어 두지 않는 것이 요점이다. 검증 대상이 문서이므로 기대값도
 * 문서에서 읽어야 하고, 코드에 복사하면 복사본끼리 대조하게 된다.
 */

import type { ThemeName } from './parse-tokens.ts'

const PALETTE_HEADING = '### 팔레트'
const CONTRAST_HEADING = '### 대비 검증'
const CVD_HEADING = '### 색으로만 갈리지 않는 쌍'

export type PaletteRow = { role: string; hex: string }
export type ContrastRow = { foreground: string; background: string; light: number; dark: number }
export type CvdRow = { a: string; b: string; theme: ThemeName; normal: number; worst: number }

export type DesignTables = {
  palette: Record<ThemeName, PaletteRow[]>
  contrast: ContrastRow[]
  cvd: CvdRow[]
}

export function parseDesign(markdown: string): DesignTables {
  const paletteAt = indexOfHeading(markdown, PALETTE_HEADING)

  return {
    palette: {
      light: readPalette(markdown, '#### Light', paletteAt),
      dark: readPalette(markdown, '#### Dark', paletteAt),
    },
    contrast: readTable(markdown, CONTRAST_HEADING).map(toContrastRow),
    cvd: readTable(markdown, CVD_HEADING).map(toCvdRow),
  }
}

/** 역할·값이 두 벌씩 놓인 표라 한 행에서 최대 두 쌍을 뽑는다. 남는 칸은 비어 있다. */
function readPalette(markdown: string, heading: string, from: number): PaletteRow[] {
  return readTable(markdown, heading, from).flatMap((cells) =>
    [0, 2]
      .map((at) => ({ role: unquote(cells[at]), hex: unquote(cells[at + 1]).toUpperCase() }))
      .filter((row) => row.role !== '' && row.hex !== ''),
  )
}

function toContrastRow(cells: string[]): ContrastRow {
  const [foreground, background] = splitPair(cells[0])
  return { foreground, background, light: toNumber(cells[1]), dark: toNumber(cells[2]) }
}

function toCvdRow(cells: string[]): CvdRow {
  const label = cells[0] ?? ''
  const [a, b] = splitPair(label)
  const theme = /\(Dark\)/i.test(label) ? 'dark' : 'light'
  return { a, b, theme, normal: toNumber(cells[1]), worst: toNumber(cells[2]) }
}

function splitPair(cell: string | undefined): [string, string] {
  const [left = '', right = ''] = (cell ?? '').split('/')
  return [unquote(left), unquote(right.replace(/\(.*\)/, ''))]
}

/** 각주 기호(† ‡ §)와 굵게 표시가 붙은 셀이 있어 숫자만 남긴다. */
function toNumber(cell: string | undefined): number {
  const match = /-?\d+(?:\.\d+)?/.exec(cell ?? '')
  if (!match) throw new Error(`숫자가 없는 셀이다: ${cell}`)
  return Number(match[0])
}

function unquote(cell: string | undefined): string {
  return (cell ?? '').replace(/[`*]/g, '').trim()
}

function indexOfHeading(markdown: string, heading: string): number {
  const at = markdown.indexOf(`\n${heading}\n`)
  if (at < 0) throw new Error(`DESIGN.md에 「${heading}」 절이 없다`)
  return at
}

/**
 * 제목 다음에 처음 나오는 표의 **본문 행**을 읽는다. 머리글과 구분선은 버린다.
 * 표를 못 찾으면 던진다 — 0행을 돌려주면 「대상 없음」이 「위반 없음」으로 통과한다.
 */
function readTable(markdown: string, heading: string, from = 0): string[][] {
  const at = markdown.indexOf(`\n${heading}\n`, from)
  if (at < 0) throw new Error(`DESIGN.md에 「${heading}」 절이 없다`)

  const rows: string[][] = []
  for (const line of markdown.slice(at + heading.length).split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) {
      if (rows.length > 0) break
      continue
    }
    if (/^\|[\s:|-]+\|$/.test(trimmed)) continue
    rows.push(trimmed.slice(1, -1).split('|'))
  }

  const body = rows.slice(1)
  if (body.length === 0) throw new Error(`「${heading}」 아래에 본문 행이 있는 표가 없다`)
  return body
}
