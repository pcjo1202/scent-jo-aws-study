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
 * **예외는 줄바꿈이 단어 경계가 아닌 자리다** — 줄 끝의 하이픈·슬래시, 그리고
 * 가운뎃점, 그리고 다음 줄이 조사로 시작하는 자리. 전부 토큰 안쪽이라 띄우면
 * 어절이 갈라진다.
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
/**
 * 슬래시는 **앞 글자에 붙어 있을 때만** 토큰 안쪽이다 — `내구성/`+`고가용성`.
 * 비교노트의 `신호 하나 /`처럼 띄어 쓴 슬래시는 구분자라 그대로 띄운다.
 * 하이픈은 반대로 앞이 공백이어도 잇는다 — 코퍼스의 유일한 사례가 `-`+`>`다.
 */
const CONTINUES_TOKEN = /[-·]$|\S\/$/
/** 가운뎃점으로 시작하는 줄도 앞 낱말에 붙는다. 원문에 띄운 가운뎃점은 0건이다. */
const CONTINUES_FROM_LEFT = /^·/
/**
 * 다음 줄이 조사 하나로 시작하면 앞말에 붙는다 — `Amazon EC2`+`를`, `(ARN)`+`이`.
 * 조사는 앞말과 띄어 쓰지 않으므로 여기서 띄우면 어절이 갈라진다.
 *
 * 조사가 **어절 전체**일 때만 본다. `EC2`+`인스턴스를`처럼 조사로 시작하는 낱말은
 * 띄우는 것이 맞다. 열거에서 **`이`를 뺀 것은 지시관형사와 겹치기 때문**이다 —
 * 코퍼스 10자리 중 셋이 "이 요구사항"류라 붙이면 오히려 틀린다 (2026-09-01 전수,
 * SJO-7).
 *
 * `보다`처럼 부사와 겹치는 것도 있다. 그쪽은 목록에서 빼는 대신 `SENTENCE_END`로
 * 가른다 — 조사는 문장이 끝난 자리에 올 수 없다. 코퍼스의 조사 이음매 1090자리
 * 중 문장부호 뒤는 1자리뿐이고, 그 하나가 부사였다.
 */
/** 조사는 앞 문장에 붙을 수 없다. 여기서 조사처럼 보이는 것은 다음 문장의 부사다. */
const SENTENCE_END = /[.?!]$/
const LEADING_PARTICLE =
  /^(을|를|가|은|는|에|의|와|과|로|으로|에서|에게|부터|까지|만|도|보다|처럼|이나|이며|이고|와의|과의)(?=[\s,.·)]|$)/
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
  if (CONTINUES_FROM_LEFT.test(right)) return false
  if (!SENTENCE_END.test(left) && LEADING_PARTICLE.test(right)) return false

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
