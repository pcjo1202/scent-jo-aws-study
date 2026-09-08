/**
 * `DESIGN.md`가 발행한 색 수치를 `tokens.css`에서 다시 계산해 대조한다 (`docs/10` 「토큰 검증」).
 *
 * 판정만 한다 — 읽기와 출력은 `scripts/src/tokens.ts`가 맡는다. 순서가 하나 강제된다:
 * **계산기 자체 검증이 먼저다.** 기지값을 못 내는 계산기가 낸 나머지 수치는 볼 값이 없다.
 */

import {
  CVD_MODELS,
  KNOWN_VALUES,
  contrastRatio,
  deltaE76,
  labOf,
  simulate,
  toLab,
  toLinear,
  toRgb,
} from './color.ts'
import type { DesignTables } from './parse-design.ts'
import type { ThemeName, Tokens } from './parse-tokens.ts'

/** 「색으로만 갈리지 않는 쌍」이 대상으로 삼는 유채 역할. 표면·윤곽은 무채라 뺀다. */
const CHROMATIC_ROLES = [
  'primary',
  'primary-container',
  'secondary-container',
  'error',
  'error-container',
  'correct',
  'correct-container',
]

/**
 * 무채 역할. 유채와 합치면 `--sys-color-*` 전체가 나와야 한다 — 새 역할이 들어왔는데
 * 어느 쪽에도 없으면 위생 검사가 그 역할을 **모르는 채로** 통과한다.
 */
const ACHROMATIC_ROLES = [
  'on-primary',
  'on-primary-container',
  'on-secondary-container',
  'on-error',
  'on-error-container',
  'on-correct',
  'on-correct-container',
  'surface',
  'on-surface',
  'surface-variant',
  'on-surface-variant',
  'surface-container-lowest',
  'surface-container-low',
  'surface-container',
  'surface-container-high',
  'surface-container-highest',
  'outline',
  'outline-variant',
]

const THEMES: ThemeName[] = ['light', 'dark']
const JND = 2.3
const CONTRAST_DECIMALS = 2
const DELTA_E_DECIMALS = 1
const LAB_DECIMALS = 2

/** 「색으로만 갈리지 않는 쌍」 표가 싣는 최악 쌍의 수. 나머지는 `error`×`correct` 계열이다. */
const LISTED_WORST_COUNT = 4

/**
 * 「시뮬레이션 ΔE ≤ 정상 ΔE」는 CIE76에서 **엄밀하게 참이 아니다.** 올바른 선형공간
 * 구현에서도 126건 중 13건이 정상보다 크다(최대 +1.93). 그래서 초과분을 JND로 받는다 —
 * 식별 한계보다 작은 증가는 애초에 보이지 않으므로 버그의 증거가 아니다.
 *
 * 비율이 아니라 **절대 ΔE**로 재는 이유는 분리력이다. 감마 공간 버그를 넣으면 절대
 * 초과가 +6.19로 3.2배 벌어지지만 비율은 1.084 → 1.112로 겨우 2.6%만 움직인다
 * (정상 ΔE가 작은 쌍에서 비율이 잡음을 증폭한다). 실측은 `docs/10-conventions.md` 「토큰 검증」.
 */
const SIMULATION_EXCESS_TOLERANCE = JND

export type TokenSources = { tokens: Tokens; design: DesignTables; markdown: string }

type Pair = { a: string; b: string; theme: ThemeName; normal: number; worst: number }

export type TokenAnomalies = {
  counts: Record<string, number>
  total: number
  messages: string[]
  stats: {
    knownValues: number
    paletteCells: number
    contrastCells: number
    cvdCells: number
    sanityChecks: number
    coverageChecks: number
    proseClaims: number
    pairCount: number
    belowJnd: number
    maxExcess: number
  }
}

export function findTokenAnomalies({ tokens, design, markdown }: TokenSources): TokenAnomalies {
  const messages: string[] = []
  const counts: Record<string, number> = {}
  function record(label: string, failures: string[]) {
    counts[label] = failures.length
    messages.push(...failures)
  }

  const knownValues = checkKnownValues()
  record('계산기 기지값', knownValues.failures)

  const palette = checkPalette(tokens, design)
  record('팔레트 표', palette.failures)

  const contrast = checkContrast(tokens, design)
  record('대비 표', contrast.failures)

  const cvd = checkCvd(tokens, design)
  record('색각 표', cvd.failures)

  const sanity = checkSanity(tokens)
  record('색각 위생 검사', sanity.failures)

  const coverage = checkCoverage(tokens, design, sanity.pairs)
  record('표 완비성', coverage.failures)

  const prose = checkProse(markdown, tokens, sanity.pairs)
  record('산문 수치', prose.failures)

  return {
    counts,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    messages,
    stats: {
      knownValues: knownValues.checked,
      paletteCells: palette.checked,
      contrastCells: contrast.checked,
      cvdCells: cvd.checked,
      sanityChecks: sanity.checked,
      coverageChecks: coverage.checked,
      proseClaims: prose.checked,
      pairCount: sanity.pairs.length,
      belowJnd: sanity.pairs.filter((pair) => pair.worst < JND).length,
      maxExcess: sanity.maxExcess,
    },
  }
}

/**
 * 이 검사가 실패하면 나머지 수치는 전부 의미가 없다 — 계산기가 깨진 것이다.
 *
 * 다만 **색각 경로는 덮지 못한다.** 기지값이 전부 대비·Lab이라, 시뮬레이션은
 * 아래 위생 검사가 유일한 음성 대조다 (`docs/10` 「토큰 검증」).
 */
function checkKnownValues() {
  const failures: string[] = []
  let checked = 0

  for (const { foreground, background, expected } of KNOWN_VALUES.contrast) {
    checked += 1
    const actual = round(contrastRatio(foreground, background), CONTRAST_DECIMALS)
    if (actual !== expected) {
      failures.push(`계산기: ${foreground}+${background} 대비 기지값 ${expected}인데 ${actual}`)
    }
  }

  checked += 1
  const lab = labOf(KNOWN_VALUES.lab.hex).map((value) => round(value, LAB_DECIMALS))
  if (lab.some((value, at) => value !== KNOWN_VALUES.lab.expected[at])) {
    failures.push(
      `계산기: Lab(${KNOWN_VALUES.lab.hex}) 기지값 ${KNOWN_VALUES.lab.expected.join(', ')}인데 ${lab.join(', ')}`,
    )
  }
  return { failures, checked }
}

/** 값 대조만이 아니라 **양쪽 집합이 같은지**도 본다 — 표에서 빠진 역할은 조용히 통과한다. */
function checkPalette(tokens: Tokens, design: DesignTables) {
  const failures: string[] = []
  let checked = 0

  for (const theme of THEMES) {
    const documented = new Map(design.palette[theme].map((row) => [row.role, row.hex]))
    const actual = tokens[theme]

    for (const [role, hex] of documented) {
      checked += 1
      const token = actual[role]
      if (!token) failures.push(`팔레트(${theme}): 표의 \`${role}\`가 tokens.css에 없다`)
      else if (token.toUpperCase() !== hex) {
        failures.push(
          `팔레트(${theme}): \`${role}\` 표 ${hex}인데 tokens.css ${token.toUpperCase()}`,
        )
      }
    }

    for (const role of Object.keys(actual)) {
      if (!documented.has(role)) failures.push(`팔레트(${theme}): \`${role}\`가 표에 없다`)
    }
  }
  return { failures, checked }
}

function checkContrast(tokens: Tokens, design: DesignTables) {
  const failures: string[] = []
  let checked = 0

  for (const row of design.contrast) {
    for (const theme of THEMES) {
      checked += 1
      const [foreground, background] = [
        tokens[theme][row.foreground],
        tokens[theme][row.background],
      ]
      if (!foreground || !background) {
        failures.push(`대비(${theme}): \`${row.foreground}\` / \`${row.background}\` 역할이 없다`)
        continue
      }

      const actual = round(contrastRatio(foreground, background), CONTRAST_DECIMALS)
      const documented = row[theme]
      if (actual !== documented) {
        failures.push(
          `대비(${theme}): \`${row.foreground}\` / \`${row.background}\` 표 ${documented}인데 ${actual}`,
        )
      }
    }
  }
  return { failures, checked }
}

function checkCvd(tokens: Tokens, design: DesignTables) {
  const failures: string[] = []
  let checked = 0

  for (const row of design.cvd) {
    const [a, b] = [tokens[row.theme][row.a], tokens[row.theme][row.b]]
    if (!a || !b) {
      failures.push(`색각(${row.theme}): \`${row.a}\` / \`${row.b}\` 역할이 없다`)
      continue
    }

    const measured = measurePair(a, b)
    for (const [label, actual, documented] of [
      ['정상', round(measured.normal, DELTA_E_DECIMALS), row.normal],
      ['색각 최악', round(measured.worst, DELTA_E_DECIMALS), row.worst],
    ] as const) {
      checked += 1
      if (actual !== documented) {
        failures.push(
          `색각(${row.theme}): \`${row.a}\` / \`${row.b}\` ${label} 표 ${documented}인데 ${actual}`,
        )
      }
    }
  }
  return { failures, checked }
}

/**
 * 유채 역할 전 조합을 테마마다 재고, 시뮬레이션이 정상 시각보다 색을 **벌리지 않는지** 본다.
 * SJO-38이 발행한 불가능한 값(정상 55.8 < 시뮬레이션 58.0)이 걸리는 자리가 여기다.
 */
function checkSanity(tokens: Tokens) {
  const failures: string[] = []
  const pairs: Pair[] = []
  let checked = 0
  let maxExcess = 0

  for (const theme of THEMES) {
    for (let i = 0; i < CHROMATIC_ROLES.length; i += 1) {
      for (let j = i + 1; j < CHROMATIC_ROLES.length; j += 1) {
        const [roleA, roleB] = [CHROMATIC_ROLES[i]!, CHROMATIC_ROLES[j]!]
        const [a, b] = [tokens[theme][roleA], tokens[theme][roleB]]
        if (!a || !b) {
          failures.push(`위생(${theme}): \`${roleA}\` / \`${roleB}\` 역할이 없다`)
          continue
        }

        const { normal, simulations, worst } = measurePair(a, b)
        pairs.push({ a: roleA, b: roleB, theme, normal, worst })

        for (const [model, simulated] of Object.entries(simulations)) {
          checked += 1
          const excess = simulated - normal
          maxExcess = Math.max(maxExcess, excess)
          if (excess > SIMULATION_EXCESS_TOLERANCE) {
            failures.push(
              `위생(${theme}): \`${roleA}\` / \`${roleB}\` ${model} 시뮬레이션 ΔE ${simulated.toFixed(2)}가 정상 ${normal.toFixed(2)}보다 ${excess.toFixed(2)} 크다`,
            )
          }
        }
      }
    }
  }
  return { failures, checked, pairs, maxExcess }
}

function measurePair(a: string, b: string) {
  const [linearA, linearB] = [toLinear(toRgb(a)), toLinear(toRgb(b))]
  const normal = deltaE76(toLab(linearA), toLab(linearB))
  const simulations = Object.fromEntries(
    Object.entries(CVD_MODELS).map(([name, model]) => [
      name,
      deltaE76(toLab(simulate(linearA, model)), toLab(simulate(linearB, model))),
    ]),
  )
  return { normal, simulations, worst: Math.min(...Object.values(simulations)) }
}

/**
 * **검사 대상이 줄어드는 것**을 검사한다. 값 대조는 표에 있는 행만 보므로, 행이 빠지거나
 * 역할이 늘면 조용히 통과한다 — 루트 `CLAUDE.md`가 "0건보다 위험하다"고 적은 부분 집계다.
 */
function checkCoverage(
  tokens: Tokens,
  design: DesignTables,
  pairs: Pair[],
): { failures: string[]; checked: number } {
  const failures: string[] = []
  let checked = 0

  // ① `--sys-color-*` 역할이 전부 유채/무채 중 하나로 분류돼 있는가
  const classified = new Set([...CHROMATIC_ROLES, ...ACHROMATIC_ROLES])
  for (const role of Object.keys(tokens.light)) {
    checked += 1
    if (!classified.has(role)) {
      failures.push(`완비성: \`${role}\`가 유채·무채 어느 쪽으로도 분류돼 있지 않다`)
    }
  }
  for (const role of classified) {
    checked += 1
    if (!(role in tokens.light))
      failures.push(`완비성: 분류 목록의 \`${role}\`가 tokens.css에 없다`)
  }

  // ② 「대비 검증」이 모든 `on-` 역할을 한 번 이상 재고 있는가
  const measured = new Set(design.contrast.flatMap((row) => [row.foreground, row.background]))
  for (const role of Object.keys(tokens.light).filter((name) => name.startsWith('on-'))) {
    checked += 1
    if (!measured.has(role)) failures.push(`완비성: \`${role}\`가 「대비 검증」 표에 없다`)
  }

  // ③ 「색으로만 갈리지 않는 쌍」이 선정 기준대로인가 — 최악 4쌍 + `error`×`correct` 계열
  const worstFirst = [...pairs].sort((a, b) => a.worst - b.worst)
  const required = new Set([
    ...worstFirst.slice(0, LISTED_WORST_COUNT).map(keyOf),
    ...pairs.filter(isVerdictPair).map(keyOf),
  ])
  const listed = new Set(design.cvd.map((row) => keyOf({ a: row.a, b: row.b, theme: row.theme })))

  for (const key of required) {
    checked += 1
    if (!listed.has(key)) failures.push(`완비성: 선정 기준상 실려야 할 ${key}가 표에 없다`)
  }
  for (const key of listed) {
    checked += 1
    if (!required.has(key)) failures.push(`완비성: 선정 기준 밖의 ${key}가 표에 있다`)
  }
  return { failures, checked }
}

/** 정오를 나르는 두 계열. 「색으로만 갈리지 않는 쌍」이 값과 무관하게 항상 싣는 행이다. */
function isVerdictPair({ a, b }: { a: string; b: string }): boolean {
  const pair = [a, b].sort().join(' / ')
  return pair === 'correct / error' || pair === 'correct-container / error-container'
}

function keyOf({ a, b, theme }: { a: string; b: string; theme: ThemeName }): string {
  return `\`${[a, b].sort().join('` / `')}\` (${theme})`
}

/**
 * 표 밖 산문에 박힌 수치. 표만 고치고 산문을 두면 **둘 다 정본으로 읽히므로** 공백보다 나쁘다
 * (루트 `CLAUDE.md` 「규칙을 고치면 그 규칙을 참조하는 곳을 전수로 훑는다」 ②).
 */
function checkProse(markdown: string, tokens: Tokens, pairs: Pair[]) {
  function worstOf(a: string, b: string, theme?: ThemeName): number {
    const matched = pairs.filter(
      (pair) =>
        (pair.a === a || pair.b === a) &&
        (pair.a === b || pair.b === b) &&
        (theme === undefined || pair.theme === theme),
    )
    if (matched.length === 0) throw new Error(`유채 쌍이 아니다: ${a} × ${b}`)
    return Math.min(...matched.map((pair) => pair.worst))
  }

  function roleContrast(foreground: string, background: string, theme: ThemeName): number {
    const [a, b] = [tokens[theme][foreground], tokens[theme][background]]
    if (!a || !b) throw new Error(`역할이 없다: ${foreground} / ${background} (${theme})`)
    return contrastRatio(a, b)
  }

  const belowJnd = pairs.filter((pair) => pair.worst < JND).length
  const errorCorrect = pairs.filter(
    (pair) => pair.a === 'error-container' && pair.b === 'correct-container',
  )

  const claims: Claim[] = [
    { pattern: /유채 역할 (\d+)개의 전 조합/g, expected: CHROMATIC_ROLES.length, decimals: 0 },
    { pattern: /전 조합 (\d+)쌍을 Light·Dark/g, expected: pairs.length, decimals: 0 },
    { pattern: /\*\*(\d+)쌍 중 JND 미만이/g, expected: pairs.length, decimals: 0 },
    { pattern: /쌍 중 JND 미만이 (\d+)건이다/g, expected: belowJnd, decimals: 0 },
    {
      pattern: /`correct` × `secondary-container` 색각 최악 (?:ΔE )?([\d.]+)/g,
      expected: worstOf('correct', 'secondary-container'),
      decimals: DELTA_E_DECIMALS,
      occurrences: 2,
    },
    {
      pattern: /이 잠금이 풀리면 위 ([\d.]+)이 바로 문제가 된다/g,
      expected: worstOf('primary', 'error', 'light'),
      decimals: DELTA_E_DECIMALS,
    },
    {
      pattern: /적록색약 ΔE ([\d.]+)/g,
      expected: worstOf('primary', 'error', 'light'),
      decimals: DELTA_E_DECIMALS,
    },
    {
      pattern: /색각 최악 ([\d.]+)~[\d.]+으로/g,
      expected: worstOf('error-container', 'correct-container'),
      decimals: DELTA_E_DECIMALS,
    },
    {
      pattern: /색각 최악 [\d.]+~([\d.]+)으로/g,
      expected: Math.max(...errorCorrect.map((pair) => pair.worst)),
      decimals: DELTA_E_DECIMALS,
    },
    // 조사가 「가」·「는」으로 갈리고 역할 이름이 생략된 곳도 있어 값 쪽으로 느슨하게 잡는다.
    // 루트 `CLAUDE.md` 「검색어는 내가 쓴 표기로만 만들지 않는다」 — 출현 수를 함께 박는다.
    {
      pattern: /`surface` 대비 ([\d.]+)라/g,
      expected: roleContrast('surface-container-low', 'surface', 'light'),
      decimals: CONTRAST_DECIMALS,
      occurrences: 3,
    },
    {
      pattern: /`correct-container`는 `surface` 대비 그레이스케일\n([\d.]+):1\(Light\)/g,
      expected: roleContrast('correct-container', 'surface', 'light'),
      decimals: CONTRAST_DECIMALS,
    },
    {
      pattern: /`#E68236`은 소스이지 `primary` 값이 아니다\.\*\* 흰 글자 대비 ([\d.]+):1/g,
      expected: contrastRatio('#E68236', '#FFFFFF'),
      decimals: CONTRAST_DECIMALS,
    },
  ]

  const failures: string[] = []
  let checked = 0

  for (const { pattern, expected, decimals, occurrences } of claims) {
    const found = [...markdown.matchAll(pattern)]
    if (found.length === 0) {
      failures.push(`산문: /${pattern.source}/에 해당하는 문장이 DESIGN.md에 없다`)
      continue
    }
    if (occurrences !== undefined && found.length !== occurrences) {
      failures.push(
        `산문: /${pattern.source}/가 ${occurrences}곳에 있어야 하는데 ${found.length}곳이다`,
      )
    }

    const rounded = round(expected, decimals)
    for (const match of found) {
      checked += 1
      if (Number(match[1]) !== rounded) {
        failures.push(`산문: /${pattern.source}/ 문서 ${match[1]}인데 ${rounded}`)
      }
    }
  }
  return { failures, checked }
}

/**
 * `occurrences`는 **패턴이 표기 하나에만 맞는 경우**를 막는다. 같은 값이 조사만 달리해
 * 여러 절에 흩어져 있으면 좁은 정규식이 한 곳만 짚고 나머지는 갈라진 채 통과한다.
 */
type Claim = { pattern: RegExp; expected: number; decimals: number; occurrences?: number }

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals))
}
