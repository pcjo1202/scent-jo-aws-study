import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseDesign } from './tokens/parse-design.ts'
import { parseTokens } from './tokens/parse-tokens.ts'
import { findTokenAnomalies } from './tokens/verify-tokens.ts'

/**
 * `DESIGN.md`의 색 수치를 `tokens.css`에서 다시 계산해 대조한다 (`docs/10` 「토큰 검증」).
 *
 * 판정은 `tokens/verify-tokens.ts`가 하고 여기서는 읽기와 출력만 한다. 출력에 **검사 건수**를
 * 함께 찍는 이유는 `exit 0`이 "통과"가 아니라 "오류 없음"이기 때문이다 — 표를 못 읽어
 * 0건을 검사해도 0건 실패가 나온다.
 */

const TOKENS_CSS = fileURLToPath(
  new URL('../../apps/web/src/shared/styles/tokens.css', import.meta.url),
)
const DESIGN_MD = fileURLToPath(new URL('../../DESIGN.md', import.meta.url))

function main() {
  const markdown = readFileSync(DESIGN_MD, 'utf8')
  const tokens = parseTokens(readFileSync(TOKENS_CSS, 'utf8'))
  const design = parseDesign(markdown)
  const { counts, total, messages, stats } = findTokenAnomalies({ tokens, design, markdown })

  console.log(
    `대상: reference ${tokens.referenceCount}개 · 역할 Light ${Object.keys(tokens.light).length}개 · Dark ${Object.keys(tokens.dark).length}개 · 유채 조합 ${stats.pairCount}쌍`,
  )
  console.log(
    `검사: 기지값 ${stats.knownValues}건 · 팔레트 ${stats.paletteCells}셀 · 대비 ${stats.contrastCells}셀 · 색각 ${stats.cvdCells}셀 · 위생 ${stats.sanityChecks}건 · 산문 ${stats.proseClaims}건`,
  )
  console.log(
    `색각: JND(2.3) 미만 ${stats.belowJnd}쌍 · 시뮬레이션이 정상보다 큰 최대폭 +${stats.maxExcess.toFixed(2)} ΔE (허용 +2.30)`,
  )

  const entries = Object.entries(counts)
  console.log(`--- 검사 ${entries.length}항목 ---`)
  for (const [label, count] of entries) console.log(`${label}: ${count}건`)

  if (total > 0) {
    for (const message of messages) console.error(`  ${message}`)
    console.error(`위반 ${total}건 — DESIGN.md와 tokens.css가 어긋난다`)
    process.exitCode = 1
    return
  }
  console.log(`위반 0건 — DESIGN.md의 색 수치가 tokens.css와 일치한다`)
}

main()
