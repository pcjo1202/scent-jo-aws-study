import type { Chunk, IndexEntry, Manifest } from '@aws-study/shared'
import type { Comparison } from '../notes/parse-comparison.ts'
import type { OneLiner } from '../notes/parse-oneliner.ts'
import { findTaggingAnomalies } from '../tagging/tagging-anomalies.ts'
import { CHUNK_SIZE } from './build-chunks.ts'
import type { FileDigest } from './build-manifest.ts'

/**
 * 배포할 산출물을 전수로 검증한다 (`08-testing.md` 「data:verify」·`04-data-model.md`).
 *
 * 파싱은 반드시 어딘가 깨지고 1019개를 눈으로 볼 수 없다. 판정을 순수 함수로
 * 두는 이유는 **깨진 산출물을 합성해 게이트 자체를 시험하기 위해서**다 — 정상
 * 데이터에서 0건이 나오는 것은 "검사가 돈다"는 증거가 아니다.
 */

/** 원본에서 확인한 값. 어긋나면 파싱이 깨진 것이다 (`08-testing.md`). */
export const EXPECTED_ANSWER_SIZE_DISTRIBUTION = { 1: 896, 2: 109, 3: 14 }
export const EXPECTED_QUESTION_COUNT = 1019
export const EXPECTED_ONE_LINER_COUNT = 203
export const EXPECTED_COMPARISON_COUNT = 48
export const EXPECTED_COMPARISON_MEMBER_COUNT = 145
/** `08-testing.md` 「골든 픽스처」. 6문항이 파서의 성질을 전부 덮는다. */
export const EXPECTED_FIXTURE_IDS = [1, 2, 44, 242, 451, 494]
/** `04-data-model.md` 「Question」. 원본 문제은행이 A~F를 쓴다. */
const MIN_CHOICE_COUNT = 4
const MAX_CHOICE_COUNT = 6
const MAX_ANSWER_SIZE = 3
/** `01-requirements.md` 「요약 노트」의 ★. 정답 개수 상한과 우연히 같을 뿐 다른 값이다. */
const MAX_IMPORTANCE = 3

export type Artifacts = {
  chunks: Chunk[]
  index: IndexEntry[]
  oneLiners: OneLiner[]
  comparisons: Comparison[]
  /** `tests/fixtures/questions/`에 있는 문항 번호. publish 대상이다. */
  fixtureIds: number[]
  manifest: Manifest
  /** CDN 키 → 디스크에서 다시 잰 값. manifest를 그 자신으로 검증하지 않는다. */
  actualFiles: Record<string, FileDigest>
}

export type ArtifactAnomalies = {
  /** 검사 이름 → 위반 건수. 전부 0이어야 배포할 수 있다. */
  counts: Record<string, number>
  total: number
  /** 사람이 읽는 값. 판정에는 안 쓴다 (`04` 「오분류 대응」 — 정상 범위의 편중은 기계가 못 정한다). */
  answerSizes: Array<[size: number, count: number]>
  choiceCounts: Array<[count: number, questions: number]>
  untagged: number
  categoryCounts: Array<[category: string, count: number]>
}

export function findArtifactAnomalies(artifacts: Artifacts): ArtifactAnomalies {
  const { chunks, index, oneLiners, comparisons, fixtureIds } = artifacts
  const questions = chunks.flatMap((chunk) => chunk.questions)
  const tagging = findTaggingAnomalies(questions, new Set(oneLiners.map((item) => item.category)))

  const counts = {
    ...countChunkShape(chunks),
    ...countQuestionDefects(questions),
    ...countIndexDefects(chunks, index),
    ...countNoteDefects(oneLiners, comparisons),
    '누락된 골든 픽스처': EXPECTED_FIXTURE_IDS.filter((id) => !fixtureIds.includes(id)).length,
    ...countManifestDefects(artifacts, questions.length),
    ...tagging.anomalyCounts,
  }

  return {
    counts,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    answerSizes: distribution(questions.map((question) => question.answer.length)),
    choiceCounts: distribution(questions.map((question) => question.choices.length)),
    untagged: tagging.untagged,
    categoryCounts: tagging.countsByCategory,
  }
}

/** `04-data-model.md` 「chunk-NNN.json」 — 100문항 단위, 마지막만 19문항. */
function countChunkShape(chunks: Chunk[]) {
  const expectedChunkCount = Math.ceil(EXPECTED_QUESTION_COUNT / CHUNK_SIZE)

  return {
    '청크 개수 불일치': chunks.length === expectedChunkCount ? 0 : 1,
    '청크 번호가 1..N이 아님': chunks.filter((chunk, order) => chunk.chunk !== order + 1).length,
    '청크 크기 초과': chunks.filter((chunk) => chunk.questions.length > CHUNK_SIZE).length,
    // 마지막 청크만 덜 찰 수 있다. 중간이 비면 경계가 밀려 청크 번호가 거짓이 된다.
    '마지막이 아닌 청크가 덜 참': chunks
      .slice(0, -1)
      .filter((chunk) => chunk.questions.length !== CHUNK_SIZE).length,
    '빈 청크': chunks.filter((chunk) => chunk.questions.length === 0).length,
    // 청크 안의 min/max만 보면 흩어진 배치를 못 잡는다. 경계가 순서대로 이어져야 한다.
    '청크 범위가 이어지지 않음': chunks.filter((chunk, order) => {
      const previous = chunks[order - 1]
      return chunk.from > chunk.to || (previous !== undefined && chunk.from !== previous.to + 1)
    }).length,
    'from·to가 실제 문항 id와 다름': chunks.filter((chunk) => {
      const ids = chunk.questions.map((question) => question.id)
      return ids.length > 0 && (chunk.from !== Math.min(...ids) || chunk.to !== Math.max(...ids))
    }).length,
  }
}

function countQuestionDefects(questions: Chunk['questions']) {
  const ids = questions.map((question) => question.id)
  const seen = new Set(ids)
  const missing = Array.from({ length: EXPECTED_QUESTION_COUNT }, (_, index) => index + 1).filter(
    (id) => !seen.has(id),
  )

  return {
    '문항 수 불일치': questions.length === EXPECTED_QUESTION_COUNT ? 0 : 1,
    '누락된 문항 id': missing.length,
    '중복된 문항 id': ids.length - seen.size,
    '범위 밖 문항 id': ids.filter((id) => id < 1 || id > EXPECTED_QUESTION_COUNT).length,
    '선택지 수가 4~6 밖': questions.filter(
      (question) =>
        question.choices.length < MIN_CHOICE_COUNT || question.choices.length > MAX_CHOICE_COUNT,
    ).length,
    '선택지 키 중복': questions.filter(
      (question) =>
        new Set(question.choices.map((choice) => choice.key)).size !== question.choices.length,
    ).length,
    '정답 개수가 1~3 밖': questions.filter(
      (question) => question.answer.length < 1 || question.answer.length > MAX_ANSWER_SIZE,
    ).length,
    '정답이 실재하지 않는 선택지를 가리킴': questions.filter((question) => {
      const keys = new Set(question.choices.map((choice) => choice.key))
      return question.answer.some((key) => !keys.has(key))
    }).length,
    '정답 키 중복': questions.filter(
      (question) => new Set(question.answer).size !== question.answer.length,
    ).length,
    '지문이 빔': questions.filter((question) => !question.stem.trim()).length,
    '해설이 빔': questions.filter((question) => !question.explanation.trim()).length,
    // 키만 보는 검사는 본문이 통째로 비어도 0을 준다 — 배열이 비면 some()이 전부 false다.
    '선택지 본문이 빔': questions.filter((question) =>
      question.choices.some((choice) => !choice.text.trim()),
    ).length,
    '오답 해설 본문이 빔': questions.filter((question) =>
      question.rebuttals.some((rebuttal) => !rebuttal.text.trim()),
    ).length,
    '요구사항이 빔': questions.filter(
      (question) =>
        question.requirements.length === 0 ||
        question.requirements.some((requirement) => !requirement.trim()),
    ).length,
    /**
     * `04-data-model.md` 「Question」 — 정답 선택지에는 오답 해설이 없다.
     *
     * 개수 불변식이라 절 파싱이 통째로 어긋나도 잡힌다. 키 정합만으로는 `rebuttals`가
     * 빈 배열이 되는 회귀를 못 본다.
     */
    '오답 해설 수가 «선택지 − 정답»과 다름': questions.filter(
      (question) => question.rebuttals.length !== question.choices.length - question.answer.length,
    ).length,
    '오답 해설 키가 실재하지 않는 선택지를 가리킴': questions.filter((question) => {
      const keys = new Set(question.choices.map((choice) => choice.key))
      return question.rebuttals.some((rebuttal) => !keys.has(rebuttal.key))
    }).length,
    '오답 해설 키가 정답과 겹침': questions.filter((question) => {
      const answer = new Set(question.answer)
      return question.rebuttals.some((rebuttal) => answer.has(rebuttal.key))
    }).length,
    // 하나의 숫자가 파싱 전체의 건강을 증명한다 (`08-testing.md`).
    '정답 개수 분포 불일치': countDistributionMismatch(
      questions.map((question) => question.answer.length),
      EXPECTED_ANSWER_SIZE_DISTRIBUTION,
    ),
  }
}

/** 인덱스가 청크와 갈라지면 서버가 틀린 정답으로 채점한다 (`04` 「index.json」). */
function countIndexDefects(chunks: Chunk[], index: IndexEntry[]) {
  const chunkById = new Map(
    chunks.flatMap((chunk) =>
      chunk.questions.map((question) => [question.id, { chunk, question }]),
    ),
  )
  const entryIds = new Set(index.map((entry) => entry.id))

  return {
    '인덱스 행 수 불일치': index.length === EXPECTED_QUESTION_COUNT ? 0 : 1,
    '인덱스에 중복된 문항 id': index.length - entryIds.size,
    '청크에 없는 인덱스 행': index.filter((entry) => !chunkById.has(entry.id)).length,
    '인덱스에 없는 청크 문항': [...chunkById.keys()].filter((id) => !entryIds.has(id)).length,
    '인덱스의 청크 번호가 틀림': index.filter(
      (entry) => chunkById.get(entry.id)?.chunk.chunk !== entry.chunk,
    ).length,
    '인덱스의 정답이 청크와 다름': index.filter((entry) => {
      const question = chunkById.get(entry.id)?.question
      return question !== undefined && !isSameKeys(entry.answer, question.answer)
    }).length,
    'choiceCount가 선택지 수와 다름': index.filter(
      (entry) => entry.choiceCount !== chunkById.get(entry.id)?.question.choices.length,
    ).length,
    'choiceCount가 4~6 밖': index.filter(
      (entry) => entry.choiceCount < MIN_CHOICE_COUNT || entry.choiceCount > MAX_CHOICE_COUNT,
    ).length,
    '인덱스의 태그가 청크와 다름': index.filter((entry) => {
      const question = chunkById.get(entry.id)?.question
      if (question === undefined) return false
      return (
        entry.categories.join(' ') !== question.categories.join(' ') ||
        entry.services.join(' ') !== question.services.join(' ')
      )
    }).length,
  }
}

function countNoteDefects(oneLiners: OneLiner[], comparisons: Comparison[]) {
  const members = comparisons.flatMap((comparison) => comparison.members)

  return {
    '한줄노트 개수 불일치': oneLiners.length === EXPECTED_ONE_LINER_COUNT ? 0 : 1,
    '빈 값이 있는 한줄노트': oneLiners.filter(
      (item) => !item.service || !item.note || !item.category,
    ).length,
    '비교쌍 개수 불일치': comparisons.length === EXPECTED_COMPARISON_COUNT ? 0 : 1,
    '비교 구성원 수 불일치': members.length === EXPECTED_COMPARISON_MEMBER_COUNT ? 0 : 1,
    '빈 값이 있는 비교 구성원': members.filter(
      (member) =>
        !member.name || !member.selectSignals || !member.rejectSignals || !member.keyDifference,
    ).length,
    '중요도가 1~3 밖인 비교쌍': comparisons.filter(
      (comparison) => comparison.importance < 1 || comparison.importance > MAX_IMPORTANCE,
    ).length,
  }
}

/**
 * manifest가 실제 산출물과 갈라지면 배포가 조용히 반쪽이 된다 (`04` 「manifest.json」).
 *
 * 비교 대상은 manifest에 적힌 값이 아니라 **디스크에서 다시 잰 값**이다 — 자기가
 * 적은 해시로 자기를 검증하면 무엇도 확인하지 못한다.
 */
function countManifestDefects({ manifest, chunks, actualFiles }: Artifacts, questionCount: number) {
  const listed = Object.keys(manifest.files)
  const actual = Object.keys(actualFiles)

  return {
    'manifest에 없는 산출물 파일': actual.filter((key) => !(key in manifest.files)).length,
    '산출물에 없는 manifest 항목': listed.filter((key) => !(key in actualFiles)).length,
    'manifest의 sha256 불일치': listed.filter(
      (key) => key in actualFiles && manifest.files[key]!.sha256 !== actualFiles[key]!.sha256,
    ).length,
    'manifest의 bytes 불일치': listed.filter(
      (key) => key in actualFiles && manifest.files[key]!.bytes !== actualFiles[key]!.bytes,
    ).length,
    'manifest 버전이 빔': manifest.version.trim() ? 0 : 1,
    'manifest의 문항 수가 산출물과 다름': manifest.questions.total === questionCount ? 0 : 1,
    'manifest의 청크 수가 산출물과 다름': manifest.questions.chunks === chunks.length ? 0 : 1,
    'manifest의 청크 크기가 다름': manifest.questions.chunkSize === CHUNK_SIZE ? 0 : 1,
  }
}

function countDistributionMismatch(values: number[], expected: Record<number, number>) {
  const actual = new Map(distribution(values))
  const sizes = new Set([...actual.keys(), ...Object.keys(expected).map(Number)])

  return [...sizes].filter((size) => (actual.get(size) ?? 0) !== (expected[size] ?? 0)).length
}

function isSameKeys(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((key, index) => key === right[index])
}

function distribution(values: number[]): Array<[number, number]> {
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)

  return [...counts].sort(([a], [b]) => a - b)
}
