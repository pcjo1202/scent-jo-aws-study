import type { ChoiceKey } from '@aws-study/shared'

/**
 * 채점 후 선택지 하나가 놓이는 네 자리 (`DESIGN.md` 「채점 결과 · 선택지 표시」).
 * **배경 채움은 "내가 관여했다", 테두리는 "정답인데 안 골랐다"**를 뜻한다.
 */
export type ChoiceResult = 'chosen-correct' | 'chosen-wrong' | 'missed-correct' | 'unchosen-wrong'

/**
 * `answer`는 서버가 준 정답이다. 화면이 정오를 계산하지 않는다 — 채점은 서버가 한다
 * (루트 `CLAUDE.md`). 이 함수는 이미 나온 판정을 **어느 칸에 그릴지**만 고른다.
 */
export function toChoiceResult(
  key: ChoiceKey,
  { selected, answer }: { selected: ChoiceKey[]; answer: ChoiceKey[] },
): ChoiceResult {
  const isChosen = selected.includes(key)
  const isAnswer = answer.includes(key)

  if (isChosen && isAnswer) return 'chosen-correct'
  if (isChosen) return 'chosen-wrong'
  if (isAnswer) return 'missed-correct'

  return 'unchosen-wrong'
}
