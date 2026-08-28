import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SOURCE_FILE_NUMBERS, findSourcePdf, readPdfText } from './source-pdfs.ts'
import { splitQuestionBlocks } from './questions/split-blocks.ts'
import { parseQuestion, type ParsedQuestion } from './questions/parse-question.ts'
import { buildSeamOracle } from './questions/seam-oracle.ts'

/** 원본 PDF에서 학습 데이터를 뽑아 `data/`에 쓴다 (`04-data-model.md` 「data:extract」). */

const EXPECTED_QUESTION_COUNT = 1019
const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url))

function main(): void {
  const blocks = [
    SOURCE_FILE_NUMBERS.questionsFirstHalf,
    SOURCE_FILE_NUMBERS.questionsSecondHalf,
  ].flatMap((fileNumber) => splitQuestionBlocks(readPdfText(findSourcePdf(fileNumber))))

  // 줄 이음매 판정은 코퍼스 전체의 빈도를 본다 — 문항 하나로는 표본이 없다.
  const seamHasSpace = buildSeamOracle(blocks.flatMap((block) => block.lines).join('\n'))
  const questions = blocks.map((block) => parseQuestion(block, seamHasSpace))

  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(`${DATA_DIR}questions.json`, `${JSON.stringify(questions, null, 2)}\n`)

  report(questions)
}

function report(questions: ParsedQuestion[]): void {
  const ids = questions.map((question) => question.id)
  const missing = Array.from({ length: EXPECTED_QUESTION_COUNT }, (_, i) => i + 1).filter(
    (id) => !ids.includes(id),
  )

  const answerSizes = new Map<number, number>()
  for (const { answer } of questions) {
    answerSizes.set(answer.length, (answerSizes.get(answer.length) ?? 0) + 1)
  }

  console.log(
    `문항 ${questions.length}개 (기대 ${EXPECTED_QUESTION_COUNT}) · 누락 ${missing.length}개`,
  )
  console.log(
    `정답 개수 분포: ${[...answerSizes]
      .sort()
      .map(([size, count]) => `${size}개 ${count}`)
      .join(' / ')}`,
  )
  console.log(`선택지 4개 미만: ${questions.filter((q) => q.choices.length < 4).length}개`)
  console.log(`정답이 실재하지 않는 선택지를 가리킴: ${countDanglingAnswers(questions)}개`)
  console.log(`지문·해설이 빈 문항: ${questions.filter((q) => !q.stem || !q.explanation).length}개`)
  console.log(`오답 해설 키가 정답과 겹침: ${countOverlappingRebuttals(questions)}개`)
}

function countDanglingAnswers(questions: ParsedQuestion[]): number {
  return questions.filter((question) => {
    const keys = new Set(question.choices.map((choice) => choice.key))
    return question.answer.some((key) => !keys.has(key))
  }).length
}

function countOverlappingRebuttals(questions: ParsedQuestion[]): number {
  return questions.filter((question) => {
    const answer = new Set(question.answer)
    return question.rebuttals.some((rebuttal) => answer.has(rebuttal.key))
  }).length
}

main()
