import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Chunk, IndexEntry } from '@aws-study/shared'
import { type Artifacts, findArtifactAnomalies } from './artifacts/verify-artifacts.ts'
import type { Comparison } from './notes/parse-comparison.ts'
import type { OneLiner } from './notes/parse-oneliner.ts'

/**
 * `data/`의 산출물을 전수 검증한다 (`04-data-model.md` 「data:verify」).
 *
 * 원본 PDF를 보지 않는다 — `data:pull`로 받아 온 기기에서도 그대로 돌아야
 * 배포 게이트 구실을 한다. 판정은 `artifacts/verify-artifacts.ts`가 하고
 * 여기서는 읽기와 출력만 한다.
 */

const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url))
const FIXTURES_DIR = fileURLToPath(new URL('../../tests/fixtures/questions/', import.meta.url))

function main() {
  const artifacts = readArtifacts()
  const anomalies = findArtifactAnomalies(artifacts)
  const questionCount = artifacts.chunks.reduce((sum, chunk) => sum + chunk.questions.length, 0)

  console.log(
    `대상: 청크 ${artifacts.chunks.length}개 · 문항 ${questionCount}개 · 인덱스 ${artifacts.index.length}행 · 한줄노트 ${artifacts.oneLiners.length}개 · 비교쌍 ${artifacts.comparisons.length}쌍 · 픽스처 ${artifacts.fixtureIds.length}개`,
  )
  console.log(`정답 개수 분포: ${format(anomalies.answerSizes)}`)
  console.log(`선택지 수 분포: ${format(anomalies.choiceCounts)}`)
  console.log(`미태깅 문항: ${anomalies.untagged}개`)
  console.log(`카테고리 분포: ${format(anomalies.categoryCounts)}`)

  const entries = Object.entries(anomalies.counts)
  console.log(`--- 검사 ${entries.length}항목 ---`)
  for (const [label, count] of entries) console.log(`${label}: ${count}건`)

  if (anomalies.total > 0) {
    console.error(`위반 ${anomalies.total}건 — 배포할 수 없다`)
    process.exitCode = 1
    return
  }
  console.log(`위반 0건 — 배포 가능`)
}

function readArtifacts(): Artifacts {
  const chunkFiles = readdirSync(`${DATA_DIR}chunks`)
    .filter((name) => name.endsWith('.json'))
    .sort()

  return {
    chunks: chunkFiles.map((name) => read<Chunk>(`chunks/${name}`)),
    index: read<{ entries: IndexEntry[] }>('index.json').entries,
    oneLiners: read<{ items: OneLiner[] }>('oneliners.json').items,
    comparisons: read<{ items: Comparison[] }>('comparisons.json').items,
    fixtureIds: readdirSync(FIXTURES_DIR)
      .filter((name) => name.endsWith('.json'))
      .map((name) => Number(name.replace('.json', ''))),
  }
}

function read<T>(name: string): T {
  return JSON.parse(readFileSync(`${DATA_DIR}${name}`, 'utf8')) as T
}

function format(counts: Array<[string | number, number]>) {
  return counts.map(([value, count]) => `${value} ${count}`).join(' · ')
}

main()
