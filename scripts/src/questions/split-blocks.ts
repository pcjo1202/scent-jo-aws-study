/**
 * 원본 문제은행 PDF의 `pdftotext -layout` 출력을 문항 블록으로 자른다.
 *
 * 페이지 장식(구분자·헤더·푸터)은 본문과 같은 평면에 섞여 나오므로 여기서
 * 전부 걷어낸다. 남기면 페이지 경계에 걸친 문항의 지문·해설 한가운데에
 * 푸터 한 줄이 박힌다 (`08-testing.md` 골든 픽스처 「페이지 경계에 걸친 문항」).
 */

import { stripPageBreaks } from '../text/page-decoration.ts'

/** 문항 시작. 우측 정렬된 페이지 헤더가 같은 줄에 붙어 나온다. */
const QUESTION_HEADING = /^Q\.\s*(\d{1,4})\s+SAA-C03 한국어\s*$/
/** 페이지 푸터. `AWS SAA-C03 Korean Final · <날짜>    <N> / <총쪽>` */
const PAGE_FOOTER = /^AWS SAA-C03 Korean Final · /

export type QuestionBlock = {
  id: number
  /** 문항 시작 줄을 제외한 본문. 앞뒤 빈 줄은 제거돼 있다. */
  lines: string[]
}

export function splitQuestionBlocks(rawText: string): QuestionBlock[] {
  const blocks: QuestionBlock[] = []
  let current: QuestionBlock | undefined

  for (const line of stripPageBreaks(rawText).split('\n')) {
    if (PAGE_FOOTER.test(line)) continue

    const heading = QUESTION_HEADING.exec(line)
    if (heading) {
      current = { id: Number(heading[1]), lines: [] }
      blocks.push(current)
      continue
    }

    // 첫 문항 앞에 표지가 있으면 여기로 온다. 버린다.
    if (!current) continue
    current.lines.push(line.trimEnd())
  }

  for (const block of blocks) block.lines = trimBlankEdges(block.lines)
  return blocks
}

function trimBlankEdges(lines: string[]) {
  let start = 0
  let end = lines.length
  while (start < end && lines[start]?.trim() === '') start += 1
  while (end > start && lines[end - 1]?.trim() === '') end -= 1
  return lines.slice(start, end)
}
