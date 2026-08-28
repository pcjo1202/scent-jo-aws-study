import type { SeamOracle } from './seam-oracle.ts'

/**
 * 작은 코퍼스에서 줄 이음매의 공백을 **코퍼스 직접 조회**로 판정한다.
 *
 * `seam-oracle.ts`는 문제은행(2.7MB)용이라 좌우 두 글자로 열쇠를 고정한다 — 표본이
 * 충분해 폭을 넓힐 이유가 없다. 노트 코퍼스는 90KB라 같은 열쇠로는 이음매 97곳 중
 * 68곳에서 근거를 못 찾고 전부 붙이는 쪽으로 떨어졌고, 그중 4곳이 실제로는 공백이
 * 있던 자리였다.
 *
 * 그래서 좌우 세 글자 → 두 글자 → 한 글자로 좁혀 가며 **근거가 나오는 첫 폭**의
 * 판정을 쓴다. 넓은 열쇠가 정확하고 좁은 열쇠가 표본이 많다. 어느 폭에서도 근거가
 * 없으면 붙인다 — 놓친 공백은 읽는 데 지장이 없지만 잘못 넣은 공백은 단어를 쪼갠다.
 *
 * 문제은행 파서는 이 모듈을 쓰지 않는다. 그쪽 정확도(라벨 1638건, 95.5%)는 두 글자
 * 열쇠로 측정한 값이라 폭을 바꾸면 그 측정이 무효가 된다.
 */

/** 넓은 쪽부터 본다. 좁힐수록 표본은 늘지만 다른 문맥이 섞인다. */
const KEY_WIDTHS = [3, 2, 1]

export function buildSeamLookup(corpus: string): SeamOracle {
  return (leftTail, rightHead) => {
    for (const width of KEY_WIDTHS) {
      const verdict = lookUp(corpus, leftTail, rightHead, width)
      if (verdict !== undefined) return verdict
    }
    return false
  }
}

/** 근거가 없으면 `undefined`. 붙은 쪽과 띄운 쪽 중 잦은 쪽을 고른다. */
function lookUp(corpus: string, leftTail: string, rightHead: string, width: number) {
  const left = leftTail.slice(-width)
  const right = rightHead.slice(0, width)
  // 공백이 섞인 열쇠는 그 자체가 다른 문자열이다. 더 좁은 폭에 맡긴다.
  if (left.length < width || right.length < width) return undefined
  if (/\s/.test(left) || /\s/.test(right)) return undefined

  const joined = occurrences(corpus, left + right)
  const spaced = occurrences(corpus, `${left} ${right}`)
  if (joined === 0 && spaced === 0) return undefined

  return spaced > joined
}

function occurrences(corpus: string, needle: string) {
  return corpus.split(needle).length - 1
}
