import { SOURCE_FILE_NUMBERS, findSourcePdf, readPdfText } from './source-pdfs.ts'
import { splitQuestionBlocks } from './questions/split-blocks.ts'

/** 원본 PDF에서 학습 데이터를 뽑아 `data/`에 쓴다 (`04-data-model.md` 「data:extract」). */

const EXPECTED_QUESTION_COUNT = 1019

function main(): void {
  const blocks = [
    SOURCE_FILE_NUMBERS.questionsFirstHalf,
    SOURCE_FILE_NUMBERS.questionsSecondHalf,
  ].flatMap((fileNumber) => splitQuestionBlocks(readPdfText(findSourcePdf(fileNumber))))

  const ids = blocks.map((block) => block.id)
  const missing = Array.from({ length: EXPECTED_QUESTION_COUNT }, (_, i) => i + 1).filter(
    (id) => !ids.includes(id),
  )
  const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i)

  console.log(`문항 블록 ${blocks.length}개 (기대 ${EXPECTED_QUESTION_COUNT})`)
  console.log(`누락 ${missing.length}개 · 중복 ${duplicated.length}개`)
  if (missing.length > 0) console.log(`  누락 id: ${missing.join(', ')}`)
  if (duplicated.length > 0) console.log(`  중복 id: ${duplicated.join(', ')}`)

  if (blocks.length !== EXPECTED_QUESTION_COUNT || missing.length > 0 || duplicated.length > 0) {
    process.exitCode = 1
  }
}

main()
