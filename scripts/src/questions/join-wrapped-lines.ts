/**
 * PDF의 시각적 줄바꿈을 되돌려 한 문단으로 잇는다.
 *
 * 원본 PDF의 텍스트 레이어에는 공백 문자가 없다 — `pdftotext`가 글자 사이
 * 간격을 보고 공백을 만들어 낸다. 줄이 끝나는 자리에는 간격 정보가 없으므로
 * 그 자리에 공백이 있었는지는 원리적으로 복원할 수 없다.
 *
 * 한쪽이라도 한글이 아니면 띄운다 — 라틴·숫자는 줄바꿈이 곧 단어 경계다.
 * 한글끼리 만나는 자리만 애매하고, 그건 `seam-oracle.ts`가 코퍼스 빈도로
 * 판정한다. 오라클을 주지 않으면 붙이는 쪽으로 간다 — 놓친 공백
 * ("업로드를사용하여")은 읽는 데 지장이 없지만, 잘못 넣은 공백은 단어를
 * 쪼개("데이 터") 읽기와 서비스명 매칭을 함께 깨뜨린다.
 */

import type { SeamOracle } from './seam-oracle.ts'

const HANGUL_SYLLABLE = /[가-힣]/
/** IAM 정책 같은 코드 블록. 7문항에 들어 있고 들여쓰기가 곧 의미다. */
const CODE_LINE = /^[{}[\]"]/

export function joinWrappedLines(lines: string[], seamHasSpace: SeamOracle = neverSpace): string {
  const present = lines.filter((line) => line.trim())
  const codeIndent = minimumCodeIndent(present)
  const chunks: string[] = []

  for (const line of present) {
    if (isCodeLine(line)) {
      chunks.push(line.slice(Math.min(codeIndent, indentOf(line))).trimEnd())
      continue
    }

    const part = line.trim()
    const previous = chunks.at(-1)
    if (previous === undefined || isCodeLine(previous)) {
      chunks.push(part)
      continue
    }
    const separator = needsSpace(previous, part, seamHasSpace) ? ' ' : ''
    chunks[chunks.length - 1] = previous + separator + part
  }

  return chunks.join('\n')
}

function needsSpace(left: string, right: string, seamHasSpace: SeamOracle): boolean {
  const isHangulSeam = HANGUL_SYLLABLE.test(left.at(-1)!) && HANGUL_SYLLABLE.test(right[0]!)
  return isHangulSeam ? seamHasSpace(left, right) : true
}

function neverSpace(): boolean {
  return false
}

function isCodeLine(line: string): boolean {
  return CODE_LINE.test(line.trim())
}

/** 코드 줄의 절대 들여쓰기는 PDF 여백에서 온 값이라 의미가 없다. 상대 구조만 남긴다. */
function minimumCodeIndent(lines: string[]): number {
  const indents = lines.filter(isCodeLine).map(indentOf)
  return indents.length === 0 ? 0 : Math.min(...indents)
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length
}
