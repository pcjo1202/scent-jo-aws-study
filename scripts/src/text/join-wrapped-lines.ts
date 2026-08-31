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
 *
 * **줄 끝 하이픈만 예외다.** 거기서는 줄바꿈이 단어 경계가 아니라 토큰 안쪽이다.
 */

import type { SeamOracle } from './seam-oracle.ts'

const HANGUL_SYLLABLE = /[가-힣]/
/**
 * 줄 끝 하이픈은 토큰이 이어진다는 뜻이다 — PDF가 `ap-`+`northeast-2`,
 * `S3 Standard-`+`Infrequent Access`, `(SSE-`+`KMS)` 처럼 하이픈에서 접는다.
 *
 * 코퍼스의 하이픈 줄바꿈 50자리가 전부 이 형태다 (2026-08-31 전수, SJO-7 내용
 * 정확도 검수). 띄우면 서비스명이 쪼개져 읽기와 태깅이 함께 깨진다. 골든
 * 픽스처는 공백을 지우고 비교하므로 이 자리를 못 잡는다 (`08-testing.md`).
 */
const CONTINUES_TOKEN = /-$/
/**
 * IAM 정책 같은 코드 블록. 들여쓰기가 곧 의미라 줄을 잇지 않는다.
 *
 * 느슨한 판정이다 — `"`로 시작하는 **산문** 줄도 걸린다. 현 코퍼스에서는 매칭
 * 262줄이 전부 코드 블록을 가진 7문항 안에 있어 오인이 0건이다. v2에서 원본이
 * 바뀌면 이 수를 다시 센다.
 */
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

function needsSpace(left: string, right: string, seamHasSpace: SeamOracle) {
  if (CONTINUES_TOKEN.test(left)) return false

  const isHangulSeam = HANGUL_SYLLABLE.test(left.at(-1)!) && HANGUL_SYLLABLE.test(right[0]!)
  return isHangulSeam ? seamHasSpace(left, right) : true
}

function neverSpace() {
  return false
}

function isCodeLine(line: string) {
  return CODE_LINE.test(line.trim())
}

/** 코드 줄의 절대 들여쓰기는 PDF 여백에서 온 값이라 의미가 없다. 상대 구조만 남긴다. */
function minimumCodeIndent(lines: string[]) {
  const indents = lines.filter(isCodeLine).map(indentOf)
  return indents.length === 0 ? 0 : Math.min(...indents)
}

function indentOf(line: string) {
  return line.length - line.trimStart().length
}
