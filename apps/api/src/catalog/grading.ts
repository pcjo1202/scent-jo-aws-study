import type { ChoiceKey } from '@aws-study/shared'

/** `02-features.md` 「모의고사」. 실제 시험과 같은 문항 수다. */
export const EXAM_QUESTION_COUNT = 65

/** 원본 문제은행이 A~F를 쓴다 (`01-requirements.md` 「문제은행」). 순서가 곧 선택지 위치다. */
const CHOICE_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

/**
 * 그 문항에 실재하는 선택지 키만 골랐는가 (`IndexEntry.choiceCount`는 4~6).
 *
 * `grade()`가 이걸 보지 않는 이유는 범위 밖 키가 **오답이 아니라 잘못된 요청**이기
 * 때문이다 — 조용히 오답으로 기록하면 그 한 건이 통계에 영구히 남는다. 400으로 거른다
 * (`05-database.md` 「오류 응답」, SJO-30 E1 결정).
 */
export function hasOnlyExistingChoices(selected: ChoiceKey[], choiceCount: number): boolean {
  return selected.every((key) => {
    const position = CHOICE_KEYS.indexOf(key)

    return position >= 0 && position < choiceCount
  })
}

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
 *
 * `count`를 받는 이유는 「안 푼 문항 우선」이 **모자란 만큼만** 푼 문항에서 채우기 때문이다
 * (`05-database.md` 「POST /exams」). 풀 크기와 `count`가 같으면 결과는 그 풀의 셔플이고,
 * 안 푼 것과 채운 것을 합쳐 다시 섞는 데 그 성질을 쓴다 — 안 푼 문항이 앞에 몰리면
 * 화면이 문항 순서만으로 「이건 처음 보는 문제」를 알려 준다.
 */
export function pickExamQuestions(questionIds: number[], count = EXAM_QUESTION_COUNT): number[] {
  if (questionIds.length < count) {
    throw new Error(`추첨할 문항이 ${count}개보다 적다: ${questionIds.length}개`)
  }

  const pool = [...questionIds]
  const picked: number[] = []

  while (picked.length < count) {
    picked.push(...pool.splice(Math.floor(Math.random() * pool.length), 1))
  }

  return picked
}
