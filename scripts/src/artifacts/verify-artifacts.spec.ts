import type { ChoiceKey, Question } from '@aws-study/shared'
import { describe, expect, it } from 'vitest'
import type { Comparison } from '../notes/parse-comparison.ts'
import type { OneLiner } from '../notes/parse-oneliner.ts'
import { buildIndex, chunkFileName, chunkQuestions } from './build-chunks.ts'
import {
  DEFAULT_VERSION,
  type FileDigest,
  buildManifest,
  digest,
  toCdnKey,
} from './build-manifest.ts'
import {
  type Artifacts,
  EXPECTED_COMPARISON_COUNT,
  EXPECTED_FIXTURE_IDS,
  EXPECTED_ONE_LINER_COUNT,
  EXPECTED_QUESTION_COUNT,
  findArtifactAnomalies,
} from './verify-artifacts.ts'

/**
 * 게이트를 우회 경로로 평가한다 (루트 `CLAUDE.md`).
 *
 * 실제 산출물이 42항목 전부 0건인 것은 "검사가 돈다"는 증거가 아니다 — 0건 검증과
 * 0건 실패가 같은 0을 준다. 검사마다 그것만 깨뜨리는 산출물을 만들어 **검사 수와
 * 검출 수가 같은지** 세고, 정상 산출물에서 오탐이 없는지 함께 본다.
 */

const CATEGORIES = [
  '컴퓨트',
  '스토리지',
  '데이터베이스',
  '네트워크',
  '보안',
  '메시징',
  '모니터링',
  '분석',
  '운영',
  'AI/ML',
  '마이그레이션',
]
const KEYS: ChoiceKey[] = ['A', 'B', 'C', 'D', 'E', 'F']
/** 실측 분포 (`08-testing.md`). 정답 n개 문항이 선택지 n+3개를 갖는다. */
const ANSWER_SIZE_BY_COUNT = [
  { size: 1, questions: 896 },
  { size: 2, questions: 109 },
  { size: 3, questions: 14 },
]
/** 실측 미태깅 6문항. 노트에 없는 개념만 언급하는 문항이라 정상이다 (`04` 「Question」). */
const UNTAGGED_COUNT = 6
const COMPARISON_MEMBERS = [4, ...Array(EXPECTED_COMPARISON_COUNT - 1).fill(3)]

function question(id: number, answerSize: number): Question {
  const choices = KEYS.slice(0, answerSize + 3).map((key) => ({ key, text: `선택지 ${key}` }))
  const answer = choices.slice(0, answerSize).map((choice) => choice.key)
  const isUntagged = id <= UNTAGGED_COUNT

  return {
    id,
    stem: `지문 ${id}`,
    choices,
    answer,
    requirements: [`조건 ${id}`],
    explanation: `해설 ${id}`,
    // 정답 선택지에는 오답 해설이 없다 (`04` 「Question」).
    rebuttals: choices.slice(answerSize).map((choice) => ({ key: choice.key, text: '반박' })),
    categories: isUntagged ? [] : [CATEGORIES[id % CATEGORIES.length]!],
    services: isUntagged ? [] : [`서비스 ${id % CATEGORIES.length}`],
  }
}

function questions(): Question[] {
  const sizes = ANSWER_SIZE_BY_COUNT.flatMap(({ size, questions }) =>
    Array<number>(questions).fill(size),
  )
  return sizes.map((size, index) => question(index + 1, size))
}

function oneLiners(): OneLiner[] {
  return Array.from({ length: EXPECTED_ONE_LINER_COUNT }, (_, index) => ({
    service: `서비스 ${index}`,
    category: CATEGORIES[index % CATEGORIES.length]!,
    note: `한 줄 ${index}`,
  }))
}

function comparisons(): Comparison[] {
  return COMPARISON_MEMBERS.map((memberCount, index) => ({
    title: `비교 ${index}`,
    importance: (index % 3) + 1,
    members: Array.from({ length: memberCount }, (_, member) => ({
      name: `구성원 ${index}-${member}`,
      selectSignals: '고르는 신호',
      rejectSignals: '버리는 신호',
      keyDifference: '결정적 차이',
    })),
  }))
}

/** 산출물을 실제로 직렬화해 잰다 — manifest 검사가 보는 것이 그 값이다. */
function measure(chunks: ReturnType<typeof chunkQuestions>, all: Artifacts['oneLiners']) {
  const files: Record<string, FileDigest> = {}
  for (const chunk of chunks) {
    files[toCdnKey(`chunks/${chunkFileName(chunk.chunk)}`)] = digest(JSON.stringify(chunk))
  }
  files[toCdnKey('index.json')] = digest(JSON.stringify({ entries: buildIndex(chunks) }))
  files[toCdnKey('oneliners.json')] = digest(JSON.stringify({ items: all }))
  files[toCdnKey('comparisons.json')] = digest(JSON.stringify({ items: comparisons() }))
  for (const id of EXPECTED_FIXTURE_IDS) {
    files[`fixtures/questions/${id}.json`] = digest(`픽스처 ${id}`)
  }
  return files
}

function artifacts(): Artifacts {
  const chunks = chunkQuestions(questions())
  const items = oneLiners()
  const actualFiles = measure(chunks, items)

  return {
    chunks,
    index: buildIndex(chunks),
    oneLiners: items,
    comparisons: comparisons(),
    fixtureIds: [...EXPECTED_FIXTURE_IDS],
    actualFiles,
    // manifest에 사본을 넣는다 — 같은 객체를 공유하면 한쪽을 깨뜨려도 차이가 안 난다.
    manifest: buildManifest(structuredClone(actualFiles), {
      version: DEFAULT_VERSION,
      base: 'https://cdn.example/aws-saa/v1',
      generatedAt: '2026-08-31T00:00:00.000Z',
      questionCount: EXPECTED_QUESTION_COUNT,
    }),
  }
}

/** 청크·인덱스를 한꺼번에 바꿔야 하는 파손은 문항을 고치고 다시 만든다. */
function rebuild(broken: Artifacts, mutate: (all: Question[]) => Question[]) {
  const chunks = chunkQuestions(mutate(broken.chunks.flatMap((chunk) => chunk.questions)))
  broken.chunks = chunks
  broken.index = buildIndex(chunks)
}

function firstQuestion(broken: Artifacts) {
  return broken.chunks[0]!.questions[0]!
}

/**
 * 검사 이름 → 그 검사**만** 겨냥한 파손. 다른 검사가 덩달아 걸리는 것은 상관없다 —
 * 여기서 보는 것은 "이 검사가 실제로 무언가를 잡는가"다.
 */
const BREAKAGES: Array<[label: string, breaks: (broken: Artifacts) => void]> = [
  ['청크 개수 불일치', (broken) => void broken.chunks.pop()],
  ['청크 번호가 1..N이 아님', (broken) => void (broken.chunks[3]!.chunk = 99)],
  ['청크 크기 초과', (broken) => broken.chunks[0]!.questions.push(broken.chunks[1]!.questions[0]!)],
  ['마지막이 아닌 청크가 덜 참', (broken) => void broken.chunks[0]!.questions.pop()],
  ['빈 청크', (broken) => void (broken.chunks[5]!.questions = [])],
  ['from·to가 실제 문항 id와 다름', (broken) => void (broken.chunks[0]!.from = 7)],

  ['문항 수 불일치', (broken) => rebuild(broken, (all) => all.slice(0, -1))],
  ['누락된 문항 id', (broken) => rebuild(broken, (all) => all.filter((q) => q.id !== 500))],
  ['중복된 문항 id', (broken) => void (broken.chunks[0]!.questions[1]!.id = 1)],
  ['범위 밖 문항 id', (broken) => void (firstQuestion(broken).id = 2000)],
  ['선택지 수가 4~6 밖', (broken) => void (firstQuestion(broken).choices.length = 3)],
  ['선택지 키 중복', (broken) => void (firstQuestion(broken).choices[1]!.key = 'A')],
  ['정답 개수가 1~3 밖', (broken) => void (firstQuestion(broken).answer = [])],
  ['정답이 실재하지 않는 선택지를 가리킴', (broken) => void (firstQuestion(broken).answer = ['F'])],
  ['정답 키 중복', (broken) => void (firstQuestion(broken).answer = ['A', 'A'])],
  ['지문이 빔', (broken) => void (firstQuestion(broken).stem = '   ')],
  ['해설이 빔', (broken) => void (firstQuestion(broken).explanation = '')],
  [
    '오답 해설 키가 실재하지 않는 선택지를 가리킴',
    (broken) => void (firstQuestion(broken).rebuttals[0]!.key = 'F'),
  ],
  ['오답 해설 키가 정답과 겹침', (broken) => void (firstQuestion(broken).rebuttals[0]!.key = 'A')],
  [
    // 896/109/14가 895/110/14가 되는 형태. 총량 검증으로는 안 잡힌다.
    '정답 개수 분포 불일치',
    (broken) => void (firstQuestion(broken).answer = ['A', 'B']),
  ],

  ['인덱스 행 수 불일치', (broken) => void broken.index.pop()],
  ['인덱스에 중복된 문항 id', (broken) => broken.index.push(broken.index[0]!)],
  ['청크에 없는 인덱스 행', (broken) => void (broken.index[0]!.id = 9999)],
  ['인덱스에 없는 청크 문항', (broken) => void broken.index.splice(2, 1)],
  ['인덱스의 청크 번호가 틀림', (broken) => void (broken.index[0]!.chunk = 7)],
  ['인덱스의 정답이 청크와 다름', (broken) => void (broken.index[0]!.answer = ['B'])],
  ['choiceCount가 선택지 수와 다름', (broken) => void (broken.index[0]!.choiceCount = 5)],
  ['choiceCount가 4~6 밖', (broken) => void (broken.index[0]!.choiceCount = 9)],
  ['인덱스의 태그가 청크와 다름', (broken) => void (broken.index[0]!.categories = ['보안'])],

  ['한줄노트 개수 불일치', (broken) => void broken.oneLiners.pop()],
  ['빈 값이 있는 한줄노트', (broken) => void (broken.oneLiners[0]!.note = '')],
  ['비교쌍 개수 불일치', (broken) => void broken.comparisons.pop()],
  ['비교 구성원 수 불일치', (broken) => void broken.comparisons[0]!.members.pop()],
  ['빈 값이 있는 비교 구성원', (broken) => void (broken.comparisons[0]!.members[0]!.name = '')],
  ['중요도가 1~3 밖인 비교쌍', (broken) => void (broken.comparisons[0]!.importance = 0)],

  ['누락된 골든 픽스처', (broken) => void (broken.fixtureIds = [1, 2, 44, 242, 494])],

  [
    // 별칭 사전이나 롤업이 무너져 한 카테고리가 전부를 삼킨 모양.
    '카테고리 편중',
    (broken) => rebuild(broken, (all) => all.map((q) => ({ ...q, categories: ['컴퓨트'] }))),
  ],
  [
    // 사전이 통째로 무너지면 아무 카테고리도 안 붙어 편중 상한이 발동하지 않는다.
    '미태깅 과다',
    (broken) => rebuild(broken, (all) => all.map((q) => ({ ...q, categories: [], services: [] }))),
  ],
  [
    '카테고리 상한 초과 문항',
    (broken) => void (firstQuestion(broken).categories = CATEGORIES.slice(0, 4)),
  ],
  ['노트에 없는 카테고리', (broken) => void (firstQuestion(broken).categories = ['없는 카테고리'])],
  [
    '카테고리가 중복된 문항',
    (broken) => void (firstQuestion(broken).categories = ['보안', '보안']),
  ],
  [
    '서비스가 없는데 카테고리가 붙은 문항',
    (broken) => void (broken.chunks[9]!.questions[0]!.services = []),
  ],

  [
    'manifest에 없는 산출물 파일',
    (broken) => void delete broken.manifest.files['questions/chunk-003.json'],
  ],
  [
    '산출물에 없는 manifest 항목',
    (broken) => void (broken.manifest.files['notes/anatomy.json'] = { bytes: 1, sha256: 'x' }),
  ],
  [
    // 올라간 파일이 조용히 바뀐 모양. 크기가 같으면 bytes로는 안 잡힌다.
    'manifest의 sha256 불일치',
    (broken) => void (broken.manifest.files['questions/index.json']!.sha256 = 'f'.repeat(64)),
  ],
  [
    'manifest의 bytes 불일치',
    (broken) => void (broken.manifest.files['questions/index.json']!.bytes = 1),
  ],
  ['manifest 버전이 빔', (broken) => void (broken.manifest.version = '  ')],
  ['manifest의 문항 수가 산출물과 다름', (broken) => void (broken.manifest.questions.total = 1000)],
  ['manifest의 청크 수가 산출물과 다름', (broken) => void (broken.manifest.questions.chunks = 10)],
  ['manifest의 청크 크기가 다름', (broken) => void (broken.manifest.questions.chunkSize = 50)],
]

describe('findArtifactAnomalies', () => {
  it('실측과 같은 산출물은 위반 0건이다 — 오탐이 없다', () => {
    const anomalies = findArtifactAnomalies(artifacts())

    expect(anomalies.counts).toEqual(
      Object.fromEntries(Object.keys(anomalies.counts).map((label) => [label, 0])),
    )
    expect(anomalies.total).toBe(0)
  })

  it('정상 산출물의 규모가 실측과 같다 — 표본이 작으면 비율 상한의 뜻이 달라진다', () => {
    const anomalies = findArtifactAnomalies(artifacts())

    expect(anomalies.answerSizes).toEqual([
      [1, 896],
      [2, 109],
      [3, 14],
    ])
    expect(anomalies.choiceCounts).toEqual([
      [4, 896],
      [5, 109],
      [6, 14],
    ])
    expect(anomalies.untagged).toBe(UNTAGGED_COUNT)
  })

  it.each(BREAKAGES)('«%s» 를 잡는다', (label, breaks) => {
    const broken = structuredClone(artifacts())
    breaks(broken)

    expect(findArtifactAnomalies(broken).counts[label]).toBeGreaterThan(0)
  })

  it('검사 항목 전부에 프로브가 있다 — 죽은 검사가 없다', () => {
    const labels = Object.keys(findArtifactAnomalies(artifacts()).counts)
    const probed = new Set(BREAKAGES.map(([label]) => label))

    expect(labels.filter((label) => !probed.has(label))).toEqual([])
    expect(probed.size).toBe(labels.length)
  })

  it('청크 하나가 통째로 사라져도 문항 수로 잡힌다 — 총량이 마지막 방어선이다', () => {
    const broken = structuredClone(artifacts())
    broken.chunks.splice(4, 1)

    expect(findArtifactAnomalies(broken).counts['문항 수 불일치']).toBe(1)
    expect(findArtifactAnomalies(broken).total).toBeGreaterThan(0)
  })

  it('산출물이 비면 통과가 아니라 위반이다 — 0건 검증과 0건 실패를 가른다', () => {
    const empty = artifacts()
    const anomalies = findArtifactAnomalies({
      ...empty,
      chunks: [],
      index: [],
      oneLiners: [],
      comparisons: [],
      fixtureIds: [],
    })

    expect(anomalies.counts['문항 수 불일치']).toBe(1)
    expect(anomalies.counts['누락된 문항 id']).toBe(EXPECTED_QUESTION_COUNT)
    expect(anomalies.counts['누락된 골든 픽스처']).toBe(EXPECTED_FIXTURE_IDS.length)
    expect(anomalies.total).toBeGreaterThan(0)
  })
})
