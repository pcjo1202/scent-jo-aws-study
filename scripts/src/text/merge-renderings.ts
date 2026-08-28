/**
 * 같은 문장을 다른 폭으로 렌더링한 두 판본을 합쳐 공백을 **복원**한다.
 *
 * PDF 텍스트 레이어에는 공백 문자가 없다 — `pdftotext`가 글자 간격을 보고 만든다.
 * 줄이 끝나는 자리에는 간격 정보가 없어 그 자리의 공백은 그 판본만으로는 알 수
 * 없다. 하지만 **줄 안쪽의 공백은 확정적이다.** 두 판본은 줄을 접는 자리가 서로
 * 달라, 한쪽의 이음매가 다른 쪽에서는 줄 안쪽에 온다.
 *
 * 그래서 `seam-oracle.ts`의 빈도 추정과 달리 여기서는 **추정하지 않는다.** 어느
 * 판본에서도 줄 끝이었던 자리만 미결로 남고, 그 수를 함께 돌려준다 — 0이면 원문의
 * 공백을 그대로 복원한 것이다.
 *
 * 판본들이 어긋나면 던진다 — 공백을 지운 문자열이 다를 때는 물론, 같은 자리를 한쪽은
 * 공백으로 다른 쪽은 붙은 것으로 읽었을 때도 그렇다. 후자를 다수결로 넘기면 이 모듈이
 * 내건 "추정하지 않는다"가 깨지고, 하필 잘못 넣은 공백(단어를 쪼갠다) 쪽으로 기운다.
 * 그 대조 자체가 두 판본을 서로의 정답지로 쓰는 검증이다.
 */

export type MergedText = {
  text: string
  /** 어느 판본에서도 줄 끝이라 공백 여부를 알 수 없었던 자리. 붙이는 쪽으로 처리했다. */
  unknownSeams: number
}

/** 문자 사이의 공백 여부. `undefined`는 그 판본에서 줄 끝이라 모른다는 뜻이다. */
type Separators = Array<boolean | undefined>

export function mergeRenderings(renderings: string[][]): MergedText {
  const read = renderings.map(readRendering)
  const [first, ...rest] = read
  if (first === undefined) throw new Error('합칠 판본이 없다')

  for (const other of rest) {
    if (other.chars === first.chars) continue
    throw new Error(`판본이 서로 다른 내용을 읽었다:\n  ${first.chars}\n  ${other.chars}`)
  }

  const chars = [...first.chars]
  let text = chars[0] ?? ''
  let unknownSeams = 0

  for (let i = 0; i + 1 < chars.length; i += 1) {
    const votes = read.map((rendering) => rendering.separators[i])
    const hasSpace = votes.includes(true)
    if (hasSpace && votes.includes(false)) {
      throw new Error(`판본이 같은 자리를 다르게 읽었다 (${i}번째 글자 뒤)`)
    }
    if (!hasSpace && !votes.includes(false)) unknownSeams += 1

    text += (hasSpace ? ' ' : '') + chars[i + 1]
  }

  return { text, unknownSeams }
}

function readRendering(lines: string[]) {
  const chars: string[] = []
  const separators: Separators = []

  for (const line of lines) {
    const words = line.trim().split(/\s+/).filter(Boolean)

    for (const [index, word] of words.entries()) {
      // 줄이 바뀌는 자리만 모른다. 같은 줄 안에서 벌어진 자리는 공백이 확실하다.
      if (chars.length > 0) separators.push(index === 0 ? undefined : true)

      for (const [offset, char] of [...word].entries()) {
        if (offset > 0) separators.push(false)
        chars.push(char)
      }
    }
  }

  return { chars: chars.join(''), separators }
}
