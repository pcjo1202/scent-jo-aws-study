import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildIndex, chunkFileName, chunkQuestions } from './artifacts/build-chunks.ts'
import { SOURCE_FILE_NUMBERS, findSourcePdf, readPdfText } from './source-pdfs.ts'
import { splitQuestionBlocks } from './questions/split-blocks.ts'
import { parseQuestion, type ParsedQuestion } from './questions/parse-question.ts'
import { splitNoteSections } from './notes/split-cards.ts'
import { mergeOneLiners, parseOneLiners, type OneLiner } from './notes/parse-oneliner.ts'
import { parseComparisons, type Comparison } from './notes/parse-comparison.ts'
import { parseDesktopOneLiners, parseImportanceByTitle } from './notes/desktop-notes.ts'
import { buildSeamOracle } from './text/seam-oracle.ts'
import { buildSeamLookup } from './text/seam-lookup.ts'
import { buildServiceAliases } from './tagging/service-aliases.ts'
import { tagQuestion, type QuestionTopics } from './tagging/tag-question.ts'
import { findTaggingAnomalies } from './tagging/tagging-anomalies.ts'

/** 원본 PDF에서 학습 데이터를 뽑아 `data/`에 쓴다 (`04-data-model.md` 「data:extract」). */

const EXPECTED_QUESTION_COUNT = 1019
const EXPECTED_ONE_LINER_COUNT = 203
const EXPECTED_COMPARISON_COUNT = 48
/** `01-requirements.md` 「요약 노트」. 분포를 출력만 하면 장식 한 줄이 카테고리가 돼도 안 잡힌다. */
const EXPECTED_CATEGORY_COUNT = 11
/** `01-requirements.md` 「요약 노트」. 한 서비스가 카테고리 둘에 실려 203이 아니다. */
const EXPECTED_UNIQUE_SERVICE_COUNT = 202
const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url))

type Notes = { oneLiners: OneLiner[]; comparisons: Comparison[]; unknownSeams: number }
type TaggedQuestion = ParsedQuestion & QuestionTopics

function main() {
  const questions = parseQuestions()
  const notes = parseNotes()
  const tagged = tagQuestions(questions, notes.oneLiners)

  const anomalies =
    reportQuestions(questions) +
    reportNotes(notes) +
    reportTagging(tagged, new Set(notes.oneLiners.map((item) => item.category)))
  if (anomalies > 0) {
    console.error(`이상치 ${anomalies}건 — data/ 를 쓰지 않는다`)
    process.exitCode = 1
    return
  }

  writeArtifacts(tagged, notes)
}

/**
 * 배포 가능한 파일 세트를 쓴다 (`04-data-model.md` 「chunk-NNN.json」·「index.json」).
 *
 * 문항 통합본은 두지 않는다 — 청크를 이으면 같은 데이터라 둘을 다 두면 갈라질
 * 자리가 생기고, CDN에 올라가지 않아 `data:pull`로도 복구되지 않는다.
 */
function writeArtifacts(questions: TaggedQuestion[], notes: Notes) {
  const chunks = chunkQuestions(questions)

  mkdirSync(`${DATA_DIR}chunks/`, { recursive: true })
  for (const chunk of chunks) write(`chunks/${chunkFileName(chunk.chunk)}`, chunk)
  write('index.json', { entries: buildIndex(chunks) })
  write('oneliners.json', { items: notes.oneLiners })
  write('comparisons.json', { items: notes.comparisons })

  console.log(
    `청크 ${chunks.length}개 · 인덱스 ${chunks.reduce((n, c) => n + c.questions.length, 0)}행`,
  )
}

function parseQuestions() {
  const blocks = [
    SOURCE_FILE_NUMBERS.questionsFirstHalf,
    SOURCE_FILE_NUMBERS.questionsSecondHalf,
  ].flatMap((fileNumber) => splitQuestionBlocks(readPdfText(findSourcePdf(fileNumber))))

  // 줄 이음매 판정은 코퍼스 전체의 빈도를 본다 — 문항 하나로는 표본이 없다.
  const seamHasSpace = buildSeamOracle(blocks.flatMap((block) => block.lines).join('\n'))
  return blocks.map((block) => parseQuestion(block, seamHasSpace))
}

/**
 * 노트는 같은 내용의 두 판본에서 읽는다 (`notes/desktop-notes.ts`).
 *
 * 한줄노트는 두 판본을 합쳐 이음매 공백까지 복원하고, 비교노트는 모바일 판본만
 * 파싱하되 중요도(★)와 이음매 판정을 PC판에서 가져온다 — PC판의 비교표는 4열이
 * 한 줄에 섞여 나와 열별로 가르기 어렵다.
 */
function parseNotes(): Notes {
  const mobileText = readPdfText(findSourcePdf(SOURCE_FILE_NUMBERS.notesMobile))
  const desktopText = readPdfText(findSourcePdf(SOURCE_FILE_NUMBERS.notesDesktop))
  const sections = splitNoteSections(mobileText)

  const mobile = parseOneLiners(sections.oneliner)
  const categories = new Set(mobile.map((card) => card.category))
  const merged = mergeOneLiners([mobile, parseDesktopOneLiners(desktopText, categories)])

  return {
    oneLiners: merged.items,
    unknownSeams: merged.unknownSeams,
    comparisons: parseComparisons(
      sections.comparison,
      parseImportanceByTitle(desktopText),
      buildSeamLookup(desktopText),
    ),
  }
}

/**
 * 문제은행에는 주제 태그가 없다. 노트의 서비스명을 사전으로 삼아 파생시킨다
 * (`04-data-model.md` 「자동 태깅」).
 */
function tagQuestions(questions: ParsedQuestion[], oneLiners: OneLiner[]): TaggedQuestion[] {
  const aliases = buildServiceAliases(oneLiners)
  console.log(
    `별칭 ${aliases.length}개 · 사전 서비스 ${new Set(aliases.map((entry) => entry.service)).size}개`,
  )

  return questions.map((question) => ({ ...question, ...tagQuestion(question, aliases) }))
}

/** 이상치 건수를 돌려준다. 전수 검증은 `data:verify`(SJO-7)의 몫이고, 여기서는 산출을 막는다. */
function reportQuestions(questions: ParsedQuestion[]) {
  const ids = questions.map((question) => question.id)
  const missing = Array.from({ length: EXPECTED_QUESTION_COUNT }, (_, i) => i + 1).filter(
    (id) => !ids.includes(id),
  )

  const counts = {
    '선택지 4개 미만': questions.filter((question) => question.choices.length < 4).length,
    '정답이 실재하지 않는 선택지를 가리킴': countDanglingAnswers(questions),
    '지문·해설이 빈 문항': questions.filter((question) => !question.stem || !question.explanation)
      .length,
    '오답 해설 키가 정답과 겹침': countOverlappingRebuttals(questions),
  }

  console.log(
    `문항 ${questions.length}개 (기대 ${EXPECTED_QUESTION_COUNT}) · 누락 ${missing.length}개`,
  )
  const answerSizes = new Map<number, number>()
  for (const { answer } of questions) {
    answerSizes.set(answer.length, (answerSizes.get(answer.length) ?? 0) + 1)
  }
  console.log(
    `정답 개수 분포: ${[...answerSizes]
      .sort(([a], [b]) => a - b)
      .map(([size, count]) => `${size}개 ${count}`)
      .join(' / ')}`,
  )
  for (const [label, count] of Object.entries(counts)) console.log(`${label}: ${count}개`)

  const countMismatch = questions.length === EXPECTED_QUESTION_COUNT ? 0 : 1
  return missing.length + countMismatch + Object.values(counts).reduce((sum, n) => sum + n, 0)
}

function reportNotes({ oneLiners, comparisons, unknownSeams }: Notes) {
  const members = comparisons.flatMap((comparison) => comparison.members)
  const counts = {
    '한줄노트 개수 불일치': oneLiners.length === EXPECTED_ONE_LINER_COUNT ? 0 : 1,
    '카테고리 종수 불일치':
      new Set(oneLiners.map((item) => item.category)).size === EXPECTED_CATEGORY_COUNT ? 0 : 1,
    '고유 서비스명 개수 불일치':
      new Set(oneLiners.map((item) => item.service)).size === EXPECTED_UNIQUE_SERVICE_COUNT ? 0 : 1,
    '비교쌍 개수 불일치': comparisons.length === EXPECTED_COMPARISON_COUNT ? 0 : 1,
    // 두 판본을 합쳐도 공백을 못 정한 자리. 0이 아니면 원본 구성이 바뀐 것이다.
    '판본을 합쳐도 미결인 이음매': unknownSeams,
    '빈 값이 있는 한줄노트': oneLiners.filter((item) => !item.service || !item.note).length,
    '빈 값이 있는 비교 구성원': members.filter(
      (member) =>
        !member.name || !member.selectSignals || !member.rejectSignals || !member.keyDifference,
    ).length,
    '중요도가 1~3 밖인 비교쌍': comparisons.filter(
      (comparison) => comparison.importance < 1 || comparison.importance > 3,
    ).length,
  }

  console.log(
    `한줄노트 ${oneLiners.length}개 (기대 ${EXPECTED_ONE_LINER_COUNT}) · 고유 서비스명 ${new Set(oneLiners.map((item) => item.service)).size}개 (기대 ${EXPECTED_UNIQUE_SERVICE_COUNT})`,
  )
  console.log(`카테고리 분포: ${formatDistribution(oneLiners.map((item) => item.category))}`)
  console.log(
    `비교쌍 ${comparisons.length}쌍 (기대 ${EXPECTED_COMPARISON_COUNT}) · 구성원 ${members.length}명`,
  )
  console.log(
    `중요도 분포: ${formatDistribution(comparisons.map((comparison) => `★${comparison.importance}`))}`,
  )
  for (const [label, count] of Object.entries(counts)) console.log(`${label}: ${count}개`)

  return Object.values(counts).reduce((sum, n) => sum + n, 0)
}

/**
 * 이상치 건수를 돌려준다. 판정은 `tagging/tagging-anomalies.ts`가 하고 여기서는
 * 출력만 한다 — 게이트를 따로 테스트하려면 순수 함수여야 한다.
 */
function reportTagging(questions: TaggedQuestion[], knownCategories: Set<string>) {
  const anomalies = findTaggingAnomalies(questions, knownCategories)

  console.log(
    `태깅 대상 ${questions.length}개 (기대 ${EXPECTED_QUESTION_COUNT}) · 미태깅 ${anomalies.untagged}개 (${formatShare(anomalies.untagged, questions.length)}, 상한 ${anomalies.untaggedLimit}개)`,
  )
  console.log(
    `문항당 카테고리 수: ${formatDistribution(questions.map((question) => `${question.categories.length}개`))}`,
  )
  console.log(
    `태깅 카테고리 분포 (상한 ${anomalies.limit}개): ${anomalies.countsByCategory
      .map(([category, count]) => `${category} ${count}(${formatShare(count, questions.length)})`)
      .join(' · ')}`,
  )
  for (const [category, count] of anomalies.overweight) {
    console.log(`카테고리 편중 «${category}»: ${count}개 — 상한 ${anomalies.limit}개`)
  }
  for (const [label, count] of Object.entries(anomalies.anomalyCounts)) {
    console.log(`${label}: ${count}건`)
  }

  return Object.values(anomalies.anomalyCounts).reduce((sum, count) => sum + count, 0)
}

function formatShare(count: number, total: number) {
  return `${((count / total) * 100).toFixed(1)}%`
}

function formatDistribution(values: Array<string | number>) {
  const counts = new Map<string | number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)

  return [...counts]
    .sort(([, a], [, b]) => b - a)
    .map(([value, count]) => `${value} ${count}`)
    .join(' · ')
}

function countDanglingAnswers(questions: ParsedQuestion[]) {
  return questions.filter((question) => {
    const keys = new Set(question.choices.map((choice) => choice.key))
    return question.answer.some((key) => !keys.has(key))
  }).length
}

function countOverlappingRebuttals(questions: ParsedQuestion[]) {
  return questions.filter((question) => {
    const answer = new Set(question.answer)
    return question.rebuttals.some((rebuttal) => answer.has(rebuttal.key))
  }).length
}

/** CDN에 그대로 올라가는 파일이라 들여쓰기를 넣지 않는다 (`04` 「chunk-NNN.json」의 크기 추정치). */
function write(name: string, data: unknown) {
  writeFileSync(`${DATA_DIR}${name}`, JSON.stringify(data))
}

main()
