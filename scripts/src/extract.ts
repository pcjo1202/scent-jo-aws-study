import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SOURCE_FILE_NUMBERS, findSourcePdf, readPdfText } from './source-pdfs.ts'
import { splitQuestionBlocks } from './questions/split-blocks.ts'
import { parseQuestion, type ParsedQuestion } from './questions/parse-question.ts'
import { buildSeamOracle } from './text/seam-oracle.ts'

/** 원본 PDF에서 학습 데이터를 뽑아 `data/`에 쓴다 (`04-data-model.md` 「data:extract」). */

const EXPECTED_QUESTION_COUNT = 1019
const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url))

function main() {
  const blocks = [
    SOURCE_FILE_NUMBERS.questionsFirstHalf,
    SOURCE_FILE_NUMBERS.questionsSecondHalf,
  ].flatMap((fileNumber) => splitQuestionBlocks(readPdfText(findSourcePdf(fileNumber))))

  // 줄 이음매 판정은 코퍼스 전체의 빈도를 본다 — 문항 하나로는 표본이 없다.
  const seamHasSpace = buildSeamOracle(blocks.flatMap((block) => block.lines).join('\n'))
  const questions = blocks.map((block) => parseQuestion(block, seamHasSpace))

  const anomalies = report(questions)
  if (anomalies > 0) {
    console.error(`이상치 ${anomalies}건 — data/ 를 쓰지 않는다`)
    process.exitCode = 1
    return
  }

  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(`${DATA_DIR}questions.json`, `${JSON.stringify(questions, null, 2)}\n`)
}

/** 이상치 건수를 돌려준다. 전수 검증은 `data:verify`(SJO-7)의 몫이고, 여기서는 산출을 막는다. */
function report(questions: ParsedQuestion[]) {
  const ids = questions.map((question) => question.id)
  const missing = Array.from({ length: EXPECTED_QUESTION_COUNT }, (_, i) => i + 1).filter(
    (id) => !ids.includes(id),
  )

  const answerSizes = new Map<number, number>()
  for (const { answer } of questions) {
    answerSizes.set(answer.length, (answerSizes.get(answer.length) ?? 0) + 1)
  }

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

main()
