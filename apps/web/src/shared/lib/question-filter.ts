import type { IndexEntry, QuestionStatesResponse } from '@aws-study/shared'

import { STUDY_SERVICE_PARAM } from '@/shared/config/study'
import { isSingleAnswer } from '@/shared/lib/choice-selection'

/**
 * 필터 규칙 (`docs/02-features.md` 「필터」). 같은 필터 안은 OR, 필터 간은 AND이고,
 * 아무것도 고르지 않은 그룹은 통과다.
 *
 * 화면이 아니라 여기에 두는 이유는 `choice-selection.ts`와 같다 — `/study`와 `/review`가
 * 같은 규칙을 통과해야 하는데 각자 구현하면 두 벌이 갈린다.
 */
export type AnswerCountKind = 'single' | 'multiple'

export type SolveState = 'unsolved' | 'wrong' | 'correct'

export type QuestionFilter = {
  categories: string[]
  services: string[]
  answerCounts: AnswerCountKind[]
  solveStates: SolveState[]
}

/**
 * 필터 패널이 그릴 수 있는 그룹. 이름을 `QuestionFilter`의 키로 맞춰 뒀다 — 갈리면 그리는
 * 그룹과 거르는 값이 어긋난다.
 *
 * **`/study`는 넷 전부, `/review`는 `categories` 하나다** — 오답 세트는 정의상 전부 오답이라
 * 「풀이 상태」가 성립하지 않는다 (`docs/02-features.md` 「`/review` 오답 복습」 ·
 * `DESIGN.md` 「필터 패널」).
 */
export const FILTER_GROUPS = ['categories', 'services', 'answerCounts', 'solveStates'] as const

export type FilterGroup = (typeof FILTER_GROUPS)[number]

export const NO_FILTER: QuestionFilter = {
  categories: [],
  services: [],
  answerCounts: [],
  solveStates: [],
}

/**
 * `/study`의 **초기** 필터를 URL에서 읽는다 — `/notes`의 「이 서비스가 나온 문제 보기」가
 * 그 자리다 (`docs/02-features.md` 「한줄노트」).
 *
 * **초기값이지 상태가 아니다.** 화면에 들어온 뒤의 필터는 `useState`가 소유하고 URL을
 * 되쓰지 않는다 — 「필터 모드를 저장하지 않는다」(`docs/02` 「필터」)와 같은 방향이다.
 * 딥링크는 여는 문이고 저장소가 아니다.
 *
 * **값이 인덱스에 있는지 여기서 보지 않는다.** 없는 서비스명이 오면 세트가 0건이 되고
 * 「조건에 맞는 문제 없음」 + 「필터 해제」가 받는다 — `/study`가 이미 가진 경로다. 여기서
 * 걸러 조용히 필터를 지우면 「필터를 걸었는데 안 걸린 화면」이 되어 더 나쁘다.
 */
export function toInitialFilter(
  searchParams: Record<string, string | string[] | undefined>,
): QuestionFilter {
  const raw = searchParams[STUDY_SERVICE_PARAM]
  // 같은 키가 여러 번 오면 Next가 배열을 준다. 첫 값만 쓴다 — 다중 선택을 URL로 열지 않았다.
  const service = (Array.isArray(raw) ? raw[0] : raw)?.trim()
  if (!service) return NO_FILTER

  return { ...NO_FILTER, services: [service] }
}

/**
 * 화면 문구는 `DESIGN.md` 「Content design」 용어표를 따른다. **타입에서 여기 두는 이유는
 * 두 곳이 읽기 때문이다** — 필터 패널의 칩과 본문 상단의 적용된 필터 칩이 같은 값을 다른
 * 자리에 그린다. 복제하면 한쪽만 고쳐도 화면이 멀쩡하다 (`.claude/rules/code-conventions.md`
 * 「SSOT」).
 *
 * `Record`로 못 박아 두면 값이 늘 때 컴파일러가 빠진 라벨을 잡는다.
 */
export const ANSWER_COUNT_LABEL: Record<AnswerCountKind, string> = {
  single: '단일정답',
  multiple: '복수정답',
}

export const SOLVE_STATE_LABEL: Record<SolveState, string> = {
  unsolved: '안 푼 것',
  wrong: '오답',
  correct: '정답',
}

/**
 * **빈 그룹은 통과다.** 고르지 않은 것과 「전부 고름」은 다르다 — 후자는 그냥 그 값들의
 * OR이라, 카테고리·서비스가 비어 있는 문항 6개는 11개를 전부 골라도 걸리지 않는다
 * (`docs/02-features.md` 「필터」).
 */
function passesGroup(values: readonly string[], selected: readonly string[]): boolean {
  if (selected.length === 0) return true

  return values.some((value) => selected.includes(value))
}

/** 값이 문항당 정확히 하나인 그룹. 여기서는 빈 선택과 전부 선택이 실제로 같아진다. */
function passesValue<T extends string>(value: T, selected: readonly T[]): boolean {
  if (selected.length === 0) return true

  return selected.includes(value)
}

export function toAnswerCountKind(answerCount: number): AnswerCountKind {
  return isSingleAnswer(answerCount) ? 'single' : 'multiple'
}

/** 안 푼 문항은 맵에 키가 없다 (`docs/05-database.md` 「GET /me/question-states」). */
export function toSolveState(
  questionId: number,
  states: QuestionStatesResponse['states'],
): SolveState {
  return states[questionId] ?? 'unsolved'
}

export function filterQuestions(
  entries: readonly IndexEntry[],
  filter: QuestionFilter,
  states: QuestionStatesResponse['states'],
): IndexEntry[] {
  return entries.filter(
    (entry) =>
      passesGroup(entry.categories, filter.categories) &&
      passesGroup(entry.services, filter.services) &&
      passesValue(toAnswerCountKind(entry.answer.length), filter.answerCounts) &&
      passesValue(toSolveState(entry.id, states), filter.solveStates),
  )
}

/** 앱바 배지는 **선택된 값의 총 개수**다. 필터 종류 수가 아니다 (`DESIGN.md` 「화면별 우측 액션」). */
export function activeFilterCount(filter: QuestionFilter): number {
  return (
    filter.categories.length +
    filter.services.length +
    filter.answerCounts.length +
    filter.solveStates.length
  )
}

export function hasActiveFilter(filter: QuestionFilter): boolean {
  return activeFilterCount(filter) > 0
}

function countValues(
  entries: readonly IndexEntry[],
  pick: (entry: IndexEntry) => readonly string[],
): Array<[string, number]> {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    for (const value of pick(entry)) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
}

/**
 * **필터 목록은 인덱스에서 도출한다.** 한줄노트의 202개를 쓰면 문항에 안 붙은 66개가
 * 고르는 즉시 0건이 된다 (`docs/02-features.md` 「필터」).
 */
export function toFilterOptions(entries: readonly IndexEntry[]): {
  categories: string[]
  services: string[]
} {
  return {
    // 칩 11개를 접지 않고 한 번에 보여주므로 목록 순서가 곧 눈에 걸리는 순서다.
    categories: countValues(entries, (entry) => entry.categories)
      .sort(([, a], [, b]) => b - a)
      .map(([value]) => value),
    // 서비스는 검색형이라 이름순이다 (`DESIGN.md` 「화면 보조 패널」).
    services: countValues(entries, (entry) => entry.services)
      .map(([value]) => value)
      .sort((a, b) => a.localeCompare(b)),
  }
}
