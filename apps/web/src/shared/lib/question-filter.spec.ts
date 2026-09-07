import { describe, expect, it } from 'vitest'

import type { IndexEntry, QuestionStatesResponse } from '@aws-study/shared'

import {
  activeFilterCount,
  filterQuestions,
  hasActiveFilter,
  NO_FILTER,
  toFilterOptions,
  type QuestionFilter,
} from './question-filter'

function entry(fields: Partial<IndexEntry> & Pick<IndexEntry, 'id'>): IndexEntry {
  return {
    chunk: 1,
    categories: [],
    services: [],
    answer: ['A'],
    choiceCount: 4,
    ...fields,
  }
}

/**
 * 코퍼스의 성질을 하나씩 담는다 — 특히 `TAGLESS`가 실제로 존재하는 6문항(233 · 454 · 554 ·
 * 624 · 761 · 797)의 대역이다 (`docs/02-features.md` 「필터」).
 */
const SINGLE_CATEGORY = entry({ id: 1, categories: ['컴퓨트'], services: ['Amazon EC2'] })
const MULTI_CATEGORY = entry({
  id: 2,
  categories: ['컴퓨트', '스토리지'],
  services: ['Amazon EC2', 'Amazon S3'],
  answer: ['A', 'B'],
})
const STORAGE_ONLY = entry({ id: 3, categories: ['스토리지'], services: ['Amazon S3'] })
const TAGLESS = entry({ id: 4 })
const TRIPLE_ANSWER = entry({
  id: 5,
  categories: ['네트워크'],
  services: ['Amazon VPC'],
  answer: ['A', 'B', 'C'],
})

const ENTRIES = [SINGLE_CATEGORY, MULTI_CATEGORY, STORAGE_ONLY, TAGLESS, TRIPLE_ANSWER]

const ALL_CATEGORIES = ['컴퓨트', '스토리지', '네트워크']

const STATES: QuestionStatesResponse['states'] = { 1: 'correct', 3: 'wrong' }

function idsOf(filter: Partial<QuestionFilter>) {
  return filterQuestions(ENTRIES, { ...NO_FILTER, ...filter }, STATES).map((found) => found.id)
}

describe('필터 없음', () => {
  it('아무것도 고르지 않으면 전체다', () => {
    expect(idsOf({})).toEqual([1, 2, 3, 4, 5])
  })

  it('태그가 없는 문항도 필터 없음에서는 든다', () => {
    expect(idsOf({})).toContain(TAGLESS.id)
  })
})

describe('같은 필터 안은 OR', () => {
  it('둘 중 하나라도 맞으면 든다', () => {
    expect(idsOf({ categories: ['컴퓨트', '네트워크'] })).toEqual([1, 2, 5])
  })

  it('고르지 않은 카테고리만 가진 문항은 걸러진다', () => {
    expect(idsOf({ categories: ['컴퓨트'] })).not.toContain(STORAGE_ONLY.id)
  })
})

describe('필터 간은 AND', () => {
  it('두 조건을 모두 만족해야 든다', () => {
    expect(idsOf({ categories: ['컴퓨트'], answerCounts: ['multiple'] })).toEqual([2])
  })

  it('한쪽만 맞으면 걸러진다', () => {
    expect(idsOf({ categories: ['네트워크'], answerCounts: ['single'] })).toEqual([])
  })
})

describe('카테고리·서비스는 교집합 매칭', () => {
  it('다중 카테고리 문항은 그중 하나만 골라도 든다', () => {
    expect(idsOf({ categories: ['컴퓨트'] })).toContain(MULTI_CATEGORY.id)
  })

  it('정확히 일치를 요구하지 않는다 — 문항이 더 가진 카테고리는 탈락 사유가 아니다', () => {
    expect(idsOf({ categories: ['스토리지'] })).toEqual([2, 3])
  })

  it('부분집합을 요구하지 않는다 — 둘을 골라도 하나만 가진 문항이 든다', () => {
    expect(idsOf({ categories: ['컴퓨트', '스토리지'] })).toEqual([1, 2, 3])
  })

  it('서비스도 같은 규칙이다', () => {
    expect(idsOf({ services: ['Amazon S3'] })).toEqual([2, 3])
  })
})

describe('정답 개수', () => {
  it('단일정답만', () => {
    expect(idsOf({ answerCounts: ['single'] })).toEqual([1, 3, 4])
  })

  it('복수정답은 2개와 3개를 함께 잡는다', () => {
    expect(idsOf({ answerCounts: ['multiple'] })).toEqual([2, 5])
  })
})

describe('풀이 상태', () => {
  it('안 푼 것은 맵에 키가 없는 문항이다', () => {
    expect(idsOf({ solveStates: ['unsolved'] })).toEqual([2, 4, 5])
  })

  it('오답과 정답을 가른다', () => {
    expect(idsOf({ solveStates: ['wrong'] })).toEqual([3])
    expect(idsOf({ solveStates: ['correct'] })).toEqual([1])
  })

  it('셋을 다 고르면 필터 없음과 같다 — 문항마다 값이 정확히 하나다', () => {
    expect(idsOf({ solveStates: ['unsolved', 'wrong', 'correct'] })).toEqual(idsOf({}))
  })
})

describe('「전부 고름」에 특별한 의미를 주지 않는다', () => {
  it('카테고리를 전부 골라도 태그 0개 문항은 빠진다', () => {
    expect(idsOf({ categories: ALL_CATEGORIES })).toEqual([1, 2, 3, 5])
    expect(idsOf({ categories: ALL_CATEGORIES })).not.toEqual(idsOf({}))
  })

  it('서비스도 같다', () => {
    const { services } = toFilterOptions(ENTRIES)

    expect(idsOf({ services })).not.toContain(TAGLESS.id)
  })

  it('값이 문항당 하나인 필터에서만 필터 없음과 같아진다', () => {
    expect(idsOf({ answerCounts: ['single', 'multiple'] })).toEqual(idsOf({}))
  })
})

describe('배지는 선택된 값의 총 개수다', () => {
  it('필터 종류 수가 아니다', () => {
    expect(
      activeFilterCount({
        ...NO_FILTER,
        categories: ['컴퓨트', '스토리지'],
        answerCounts: ['single'],
      }),
    ).toBe(3)
  })

  it('아무것도 안 고르면 0이다', () => {
    expect(activeFilterCount(NO_FILTER)).toBe(0)
    expect(hasActiveFilter(NO_FILTER)).toBe(false)
  })
})

describe('필터 목록은 인덱스에서 도출한다', () => {
  it('카테고리는 문항이 많은 순이다', () => {
    expect(toFilterOptions(ENTRIES).categories).toEqual(['컴퓨트', '스토리지', '네트워크'])
  })

  it('서비스는 이름순이다', () => {
    expect(toFilterOptions(ENTRIES).services).toEqual(['Amazon EC2', 'Amazon S3', 'Amazon VPC'])
  })

  it('문항에 안 붙은 값은 목록에 없다', () => {
    expect(toFilterOptions(ENTRIES).services).not.toContain('Amazon EFS')
  })
})
