/**
 * 줄 이음매에 공백이 있었는지를 원본 코퍼스의 빈도로 판정한다.
 *
 * PDF 텍스트 레이어에는 공백 문자가 없다 — `pdftotext`가 글자 간격을 보고
 * 만들어 낸다. 줄 끝에는 간격 정보가 없어 그 자리의 공백은 복원할 수 없다.
 * 다만 **같은 어절 조합이 코퍼스의 다른 줄 안쪽에서는 온전히 나타난다.**
 * 줄 안쪽의 공백은 간격에서 나온 것이라 믿을 수 있다.
 *
 * 그래서 이음매 좌우 두 글자씩(`대해` + `모든`)을 열쇠로 삼아, 코퍼스에서
 * 그 넷이 붙어 나온 횟수와 사이에 공백을 두고 나온 횟수를 비교한다.
 *
 * 라벨 1638건(오답 해설이 선택지를 다른 폭으로 다시 렌더링하는 것을 정답지로
 * 삼아 뽑았다)으로 측정한 결과 **정확도 95.5%, 단어를 쪼개는 오류 0건**이다.
 * 남는 오류는 전부 공백을 놓치는 쪽이라 읽기를 깨지 않는다.
 * 규칙만 쓰면(한글끼리 붙이기) 72.5%였다.
 */

const HANGUL_SYLLABLE = /[가-힣]/
/** 열쇠는 좌우 두 글자씩. 세 글자씩은 코퍼스에 표본이 모자라 미결정이 늘어난다. */
const CONTEXT_LENGTH = 2

export type SeamOracle = (leftTail: string, rightHead: string) => boolean

export function buildSeamOracle(corpus: string): SeamOracle {
  const joined = new Map<string, number>()
  const spaced = new Map<string, number>()
  const n = CONTEXT_LENGTH

  for (let i = 0; i + 2 * n < corpus.length; i += 1) {
    const left = corpus.slice(i, i + n)
    if (!isAllHangul(left)) continue

    // 붙어 나온 경우와, 사이에 공백 하나를 두고 나온 경우를 같은 열쇠로 센다.
    const adjacent = corpus.slice(i + n, i + 2 * n)
    if (isAllHangul(adjacent)) increment(joined, left + adjacent)

    const afterSpace = corpus.slice(i + n + 1, i + 2 * n + 1)
    if (corpus[i + n] === ' ' && isAllHangul(afterSpace)) increment(spaced, left + afterSpace)
  }

  return (leftTail, rightHead) => {
    const key = seamKey(leftTail, rightHead)
    if (key === undefined) return false
    return (spaced.get(key) ?? 0) > (joined.get(key) ?? 0)
  }
}

export function seamKey(leftTail: string, rightHead: string): string | undefined {
  const left = leftTail.replaceAll(' ', '').slice(-CONTEXT_LENGTH)
  const right = rightHead.slice(0, CONTEXT_LENGTH)
  if (left.length < CONTEXT_LENGTH || right.length < CONTEXT_LENGTH) return undefined
  if (!isAllHangul(left) || !isAllHangul(right)) return undefined
  return left + right
}

function isAllHangul(text: string) {
  return text.length > 0 && [...text].every((char) => HANGUL_SYLLABLE.test(char))
}

function increment(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}
