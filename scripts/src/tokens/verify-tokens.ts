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

const THEMES: ThemeName[] = ['light', 'dark']
const JND = 2.3
const CONTRAST_DECIMALS = 2
const DELTA_E_DECIMALS = 1

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
    proseClaims: number
    pairCount: number
    belowJnd: number
    maxExcess: number
  }
}

export function findTokenAnomalies({ tokens, design, markdown }: TokenSources): TokenAnomalies {
  const messages: string[] = []
  const counts: Record<string, number> = {}
  const add = (label: string, failures: string[]) => {
    counts[label] = failures.length
    messages.push(...failures)
  }

  const knownValues = checkKnownValues()
  add('계산기 기지값', knownValues)

  const palette = checkPalette(tokens, design)
  add('팔레트 표', palette.failures)

  const contrast = checkContrast(tokens, design)
  add('대비 표', contrast.failures)

  const cvd = checkCvd(tokens, design)
  add('색각 표', cvd.failures)

  const sanity = checkSanity(tokens)
  add('색각 위생 검사', sanity.failures)

  const prose = checkProse(markdown, tokens, sanity.pairs)
  add('산문 수치', prose.failures)

  return {
    counts,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    messages,
    stats: {
      knownValues: KNOWN_VALUES.contrast.length + 1,
      paletteCells: palette.checked,
      contrastCells: contrast.checked,
      cvdCells: cvd.checked,
      sanityChecks: sanity.checked,
      proseClaims: prose.checked,
      pairCount: sanity.pairs.length,
      belowJnd: sanity.pairs.filter((pair) => pair.worst < JND).length,
      maxExcess: sanity.maxExcess,
    },
  }
}

/** 이 검사가 실패하면 나머지 수치는 전부 의미가 없다 — 계산기가 깨진 것이다. */
function checkKnownValues(): string[] {
  const failures: string[] = []

  for (const { foreground, background, expected } of KNOWN_VALUES.contrast) {
    const actual = round(contrastRatio(foreground, background), CONTRAST_DECIMALS)
    if (actual !== expected) {
      failures.push(`계산기: ${foreground}+${background} 대비 기지값 ${expected}인데 ${actual}`)
    }
  }

  const lab = labOf(KNOWN_VALUES.lab.hex).map((value) => round(value, CONTRAST_DECIMALS))
  if (lab.some((value, at) => value !== KNOWN_VALUES.lab.expected[at])) {
    failures.push(
      `계산기: Lab(${KNOWN_VALUES.lab.hex}) 기지값 ${KNOWN_VALUES.lab.expected.join(', ')}인데 ${lab.join(', ')}`,
    )
  }
  return failures
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
  const pairs: Array<{ a: string; b: string; theme: ThemeName; normal: number; worst: number }> = []
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
 * 표 밖 산문에 박힌 수치. 표만 고치고 산문을 두면 **둘 다 정본으로 읽히므로** 공백보다 나쁘다
 * (루트 `CLAUDE.md` 「규칙을 고치면 그 규칙을 참조하는 곳을 전수로 훑는다」 ②).
 */
function checkProse(
  markdown: string,
  tokens: Tokens,
  pairs: Array<{ a: string; b: string; theme: ThemeName; worst: number }>,
) {
  const worstOf = (a: string, b: string, theme?: ThemeName) => {
    const matched = pairs.filter(
      (pair) =>
        (pair.a === a || pair.b === a) &&
        (pair.a === b || pair.b === b) &&
        (theme === undefined || pair.theme === theme),
    )
    return Math.min(...matched.map((pair) => pair.worst))
  }
  const surfaceContrast = (theme: ThemeName) =>
    contrastRatio(tokens[theme]['surface-container-low']!, tokens[theme]['surface']!)

  const claims: Array<{ pattern: RegExp; expected: number; decimals: number }> = [
    { pattern: /유채 역할 (\d+)개의 전 조합/g, expected: CHROMATIC_ROLES.length, decimals: 0 },
    { pattern: /전 조합 (\d+)쌍을 Light·Dark/g, expected: pairs.length, decimals: 0 },
    { pattern: /\*\*(\d+)쌍 중 JND 미만이/g, expected: pairs.length, decimals: 0 },
    {
      pattern: /쌍 중 JND 미만이 (\d+)건이다/g,
      expected: pairs.filter((pair) => pair.worst < JND).length,
      decimals: 0,
    },
    {
      pattern: /테두리를 쓰면 색으로도 갈린다\(색각 최악 ([\d.]+)\)/g,
      expected: worstOf('correct', 'secondary-container'),
      decimals: DELTA_E_DECIMALS,
    },
    {
      pattern: /`correct` 테두리다 \(색각 최악 ΔE ([\d.]+)\)/g,
      expected: worstOf('correct', 'secondary-container'),
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
      expected: Math.max(
        ...pairs
          .filter((pair) => pair.a === 'error-container' && pair.b === 'correct-container')
          .map((pair) => pair.worst),
      ),
      decimals: DELTA_E_DECIMALS,
    },
    {
      pattern: /`surface-container-low`가 `surface` 대비 ([\d.]+)라/g,
      expected: surfaceContrast('light'),
      decimals: CONTRAST_DECIMALS,
    },
  ]

  const failures: string[] = []
  let checked = 0

  for (const { pattern, expected, decimals } of claims) {
    const found = [...markdown.matchAll(pattern)]
    if (found.length === 0) {
      failures.push(`산문: /${pattern.source}/에 해당하는 문장이 DESIGN.md에 없다`)
      continue
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

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals))
}
