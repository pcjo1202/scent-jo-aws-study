/**
 * 색 계산 — WCAG 대비와 색각 시뮬레이션 ΔE.
 *
 * 색각 행렬은 **선형 RGB**에 적용한다. 감마 인코딩된 값에 곱하면 정상 시각보다
 * ΔE가 큰 불가능한 값이 나온다 — SJO-38이 그렇게 계산해 문서에 발행했다.
 */

export type Rgb = readonly [number, number, number]
export type Lab = readonly [number, number, number]
export type Matrix = readonly [Rgb, Rgb, Rgb]

/** W3C가 정의한 상대휘도 계수와 5% 플레어 상수. */
const LUMINANCE_COEFFICIENTS: Rgb = [0.2126, 0.7152, 0.0722]
const CONTRAST_FLARE = 0.05
const SRGB_LINEAR_CUTOFF = 0.04045

const SRGB_TO_XYZ: Matrix = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
]
const D65_WHITE: Rgb = [0.95047, 1.0, 1.08883]
const LAB_DELTA = 6 / 29

/**
 * Machado 2009 severity 1.0 (protan·deutan) + Viénot 1999 deutan. 전부 선형 RGB 공간이다.
 *
 * Viénot deutan은 앞 두 행이 같은 **rank 2** 투영이어야 한다. 널리 인용되는
 * `[[.625,.375,0],[.70,.30,0],[0,.30,.70]]`은 det = -0.0525로 rank 3이라 이색각
 * 투영이 될 수 없다 — 그 행렬은 두 색을 눌러 합치는 대신 옮긴다.
 */
export const CVD_MODELS: Readonly<Record<string, Matrix>> = {
  'machado-protan': [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  'machado-deutan': [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968609],
  ],
  'vienot-deutan': [
    [0.29275, 0.70725, 0.0],
    [0.29275, 0.70725, 0.0],
    [-0.02234, 0.02234, 1.0],
  ],
}

/**
 * 계산기 자체 검증에 쓰는 기지값 — 이 레포 밖에서 온 값이라 순환하지 않는다.
 *
 * 대비 둘은 M3 baseline 팔레트의 알려진 값이고 Lab은 순수 빨강의 표준 좌표다.
 * 하나라도 어긋나면 계산기가 깨진 것이므로 그 뒤 수치를 전부 믿을 수 없다.
 */
export const KNOWN_VALUES = {
  contrast: [
    { foreground: '#6750A4', background: '#FFFFFF', expected: 6.44 },
    { foreground: '#B3261E', background: '#FFFFFF', expected: 6.54 },
  ],
  lab: { hex: '#FF0000', expected: [53.24, 80.09, 67.2] as Lab },
}

export function toRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match?.[1]) throw new Error(`hex가 아니다: ${hex}`)

  const digits = match[1]
  return [channelAt(digits, 0), channelAt(digits, 2), channelAt(digits, 4)]
}

/** sRGB 전달 함수의 역. 대비도 색각도 전부 이 값 위에서 계산한다. */
export function toLinear(rgb: Rgb): Rgb {
  return [decode(rgb[0]), decode(rgb[1]), decode(rgb[2])]
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = toLinear(toRgb(hex))
  return (
    LUMINANCE_COEFFICIENTS[0] * r + LUMINANCE_COEFFICIENTS[1] * g + LUMINANCE_COEFFICIENTS[2] * b
  )
}

export function contrastRatio(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)]
  return (Math.max(x, y) + CONTRAST_FLARE) / (Math.min(x, y) + CONTRAST_FLARE)
}

export function toLab(linear: Rgb): Lab {
  const [x, y, z] = multiply(SRGB_TO_XYZ, linear)
  const [fx, fy, fz] = [pivot(x / D65_WHITE[0]), pivot(y / D65_WHITE[1]), pivot(z / D65_WHITE[2])]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export function labOf(hex: string): Lab {
  return toLab(toLinear(toRgb(hex)))
}

/** CIE76. 「색으로만 갈리지 않는 쌍」이 쓰는 거리이고 식별 한계(JND)는 2.3이다. */
export function deltaE76(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

export function simulate(linear: Rgb, model: Matrix): Rgb {
  return multiply(model, linear)
}

function multiply(matrix: Matrix, vector: Rgb): Rgb {
  return [dot(matrix[0], vector), dot(matrix[1], vector), dot(matrix[2], vector)]
}

function dot(row: Rgb, vector: Rgb): number {
  return row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]
}

function channelAt(digits: string, at: number): number {
  return parseInt(digits.slice(at, at + 2), 16) / 255
}

function decode(channel: number): number {
  return channel <= SRGB_LINEAR_CUTOFF ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function pivot(ratio: number): number {
  return ratio > LAB_DELTA ** 3 ? Math.cbrt(ratio) : ratio / (3 * LAB_DELTA ** 2) + 4 / 29
}
