import type { ChoiceKey } from '@aws-study/shared'

/** `02-features.md` 「모의고사」. 실제 시험과 같은 문항 수다. */
export const EXAM_QUESTION_COUNT = 65

/**
 * 순서를 보지 않고, 부분정답도 초과 선택도 오답이다 (`08-testing.md` 「2. 채점 로직」).
 *
 * 중복을 먼저 거르는 이유는 집합만 비교하면 `['A','A']`가 `['A']`와 같아지기 때문이다.
 * 선택지 키가 그 문항에 실재하는지는 여기서 보지 않는다 — `choiceCount`로 400을 만드는
 * 것이 컨트롤러의 몫이다 (`05-database.md` 「오류 응답」).
 */
export function grade(selected: ChoiceKey[], answer: ChoiceKey[]): boolean {
  const unique = new Set(selected)
  if (unique.size !== selected.length) return false
  if (unique.size !== answer.length) return false

  return answer.every((key) => unique.has(key))
}

/**
 * 균등 무작위로 중복 없이 뽑는다 (`02-features.md` 「모의고사」 — 가중 추첨은 v1 제외).
 *
 * 뽑은 것을 풀에서 빼므로 중복이 구조적으로 불가능하다. 정렬 셔플(`sort(() => random())`)은
 * 코드가 더 짧지만 균등하지 않다.
 */
export function pickExamQuestions(questionIds: number[]): number[] {
  if (questionIds.length < EXAM_QUESTION_COUNT) {
    throw new Error(`추첨할 문항이 ${EXAM_QUESTION_COUNT}개보다 적다: ${questionIds.length}개`)
  }

  const pool = [...questionIds]
  const picked: number[] = []

  while (picked.length < EXAM_QUESTION_COUNT) {
    picked.push(...pool.splice(Math.floor(Math.random() * pool.length), 1))
  }

  return picked
}
