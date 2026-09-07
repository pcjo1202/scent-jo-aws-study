import type { ChoiceKey } from '@aws-study/shared'
import { expect, it } from 'vitest'

import { EXAM_QUESTION_COUNT, grade, hasOnlyExistingChoices, pickExamQuestions } from './grading'

/** `08-testing.md` 「2. 채점 로직」의 7케이스. 순서 무관과 부분정답 불인정이 핵심이다. */
const GRADING_CASES: Array<{ selected: ChoiceKey[]; answer: ChoiceKey[]; expected: boolean }> = [
  { selected: ['A'], answer: ['A'], expected: true },
  { selected: ['A'], answer: ['B'], expected: false },
  { selected: ['A', 'C'], answer: ['C', 'A'], expected: true },
  { selected: ['A'], answer: ['A', 'C'], expected: false },
  { selected: ['A', 'B', 'C'], answer: ['A', 'C'], expected: false },
  { selected: [], answer: ['A'], expected: false },
  { selected: ['A', 'A'], answer: ['A'], expected: false },
]

/** `MEMORY.md` 「확인된 사실」 — 원본 문항 수. */
const TOTAL_QUESTION_COUNT = 1019
const ALL_QUESTION_IDS = Array.from({ length: TOTAL_QUESTION_COUNT }, (_, index) => index + 1)

it.each(GRADING_CASES)(
  'grade([$selected]) vs [$answer] → $expected',
  ({ selected, answer, expected }) => {
    expect(grade(selected, answer)).toBe(expected)
  },
)

it('pickExamQuestions는 정확히 65개를 준다', () => {
  expect(pickExamQuestions(ALL_QUESTION_IDS)).toHaveLength(EXAM_QUESTION_COUNT)
})

it('pickExamQuestions에 중복이 없다', () => {
  const picked = pickExamQuestions(ALL_QUESTION_IDS)

  expect(new Set(picked).size).toBe(picked.length)
})

it('pickExamQuestions는 1~1019 범위 안에서만 고른다', () => {
  const picked = pickExamQuestions(ALL_QUESTION_IDS)

  expect(picked.every((id) => Number.isInteger(id) && id >= 1 && id <= TOTAL_QUESTION_COUNT)).toBe(
    true,
  )
})

/** `choiceCount`(4~6)가 문항별 상한이다. 범위 밖 키는 오답이 아니라 400이다. */
const CHOICE_RANGE_CASES: Array<{
  selected: ChoiceKey[]
  choiceCount: number
  expected: boolean
}> = [
  { selected: ['A'], choiceCount: 4, expected: true },
  { selected: ['D'], choiceCount: 4, expected: true },
  { selected: ['E'], choiceCount: 4, expected: false },
  { selected: ['F'], choiceCount: 5, expected: false },
  { selected: ['F'], choiceCount: 6, expected: true },
  { selected: ['A', 'E'], choiceCount: 4, expected: false },
  { selected: ['Z' as ChoiceKey], choiceCount: 6, expected: false },
]

it.each(CHOICE_RANGE_CASES)(
  'hasOnlyExistingChoices([$selected], $choiceCount) → $expected',
  ({ selected, choiceCount, expected }) => {
    expect(hasOnlyExistingChoices(selected, choiceCount)).toBe(expected)
  },
)
