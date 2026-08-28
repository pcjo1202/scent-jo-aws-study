import type { ChoiceKey } from '@aws-study/shared'

/**
 * 선택지 조작 규칙 (`docs/02-features.md` 「선택 규칙」). 정답 개수가 조작 방식을 정한다.
 *
 * 화면이 아니라 여기에 두는 이유: 마우스·키보드·모바일 터치가 전부 같은 규칙을 통과해야
 * 하는데 각자 구현하면 세 벌이 갈린다. 부족·초과 제출이 서버에 도달하는 경로가 그렇게 생긴다.
 */
type SelectionRule = { answerCount: number }

/** "단일정답이란 무엇인가"를 한 곳에만 둔다 — 화면도 규칙도 이 함수를 부른다. */
export function isSingleAnswer(answerCount: number): boolean {
  return answerCount === 1
}

/**
 * 단일정답은 **교체**한다 — 이미 고른 것을 다시 눌러도 풀리지 않는다 (라디오 의미론).
 * 복수정답은 토글하되 필요 개수를 채우면 새 선택을 받지 않는다. 해제는 언제나 된다.
 */
export function toggleChoice(
  selected: ChoiceKey[],
  key: ChoiceKey,
  { answerCount }: SelectionRule,
): ChoiceKey[] {
  if (isSingleAnswer(answerCount)) return [key]

  if (selected.includes(key)) return selected.filter((chosen) => chosen !== key)
  if (selected.length >= answerCount) return selected

  return [...selected, key]
}

/** 복수정답에서 필요 개수를 채웠을 때, 아직 안 고른 선택지만 비활성이 된다. */
export function isChoiceDisabled(
  selected: ChoiceKey[],
  key: ChoiceKey,
  { answerCount }: SelectionRule,
): boolean {
  if (isSingleAnswer(answerCount)) return false

  return selected.length >= answerCount && !selected.includes(key)
}

/** 정확히 채웠을 때만 제출한다. 부족도 초과도 정상 경로로는 서버에 도달하지 않는다. */
export function canSubmit(selected: ChoiceKey[], { answerCount }: SelectionRule): boolean {
  return selected.length === answerCount
}
