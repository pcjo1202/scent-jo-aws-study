import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Chunk, IndexEntry, Manifest } from '@aws-study/shared'
import {
  FIXTURE_KEY_PREFIX,
  type FileDigest,
  digest,
  toCdnKey,
} from './artifacts/build-manifest.ts'
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
    `대상: 청크 ${artifacts.chunks.length}개 · 문항 ${questionCount}개 · 인덱스 ${artifacts.index.length}행 · 한줄노트 ${artifacts.oneLiners.length}개 · 비교쌍 ${artifacts.comparisons.length}쌍 · 픽스처 ${artifacts.fixtureIds.length}개 · manifest ${Object.keys(artifacts.manifest.files).length}파일 (실측 ${Object.keys(artifacts.actualFiles).length}파일)`,
  )
  console.log(
    `manifest: ${artifacts.manifest.version} · base «${artifacts.manifest.base}» · ${artifacts.manifest.generatedAt}`,
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

  // 디렉터리가 통째로 없어도 ENOENT로 죽지 않는다 — 「누락된 골든 픽스처」로 잡아야
  // 무엇이 빠졌는지 출력에 남는다.
  const fixtureFiles = existsSync(FIXTURES_DIR)
    ? readdirSync(FIXTURES_DIR).filter((name) => /\.(json|txt)$/.test(name))
    : []

  return {
    chunks: chunkFiles.map((name) => read<Chunk>(`chunks/${name}`)),
    index: read<{ entries: IndexEntry[] }>('index.json').entries,
    oneLiners: read<{ items: OneLiner[] }>('oneliners.json').items,
    comparisons: read<{ items: Comparison[] }>('comparisons.json').items,
    fixtureIds: fixtureFiles
      .filter((name) => name.endsWith('.json'))
      .map((name) => Number(name.replace('.json', ''))),
    manifest: read<Manifest>('manifest.json'),
    actualFiles: measureFiles(chunkFiles, fixtureFiles),
  }
}

/** manifest가 적어 둔 값이 아니라 디스크를 다시 잰다 (`artifacts/verify-artifacts.ts`). */
function measureFiles(chunkFiles: string[], fixtureFiles: string[]): Record<string, FileDigest> {
  const local = [
    ...chunkFiles.map((name) => `chunks/${name}`),
    'index.json',
    'oneliners.json',
    'comparisons.json',
  ]

  return {
    ...Object.fromEntries(
      local.map((name) => [toCdnKey(name), digest(readFileSync(`${DATA_DIR}${name}`))]),
    ),
    ...Object.fromEntries(
      fixtureFiles.map((name) => [
        `${FIXTURE_KEY_PREFIX}${name}`,
        digest(readFileSync(`${FIXTURES_DIR}${name}`)),
      ]),
    ),
  }
}

/**
 * 형태를 좁히지 않는 단언이다. 안전한 근거는 **읽은 값을 바로 판정에 넘기기 때문**이다 —
 * 구조가 어긋나면 `findArtifactAnomalies`가 개수·키·정합 위반으로 잡아 배포를 막는다.
 */
function read<T>(name: string): T {
  return JSON.parse(readFileSync(`${DATA_DIR}${name}`, 'utf8')) as T
}

function format(counts: Array<[string | number, number]>) {
  return counts.map(([value, count]) => `${value} ${count}`).join(' · ')
}

main()
