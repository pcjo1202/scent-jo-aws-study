import { describe, expect, it } from 'vitest'

import { toCategoryStats } from './stats.service'

import type { IndexEntry } from '@aws-study/shared'
import type { QuestionState } from '../progress/progress.repository'

function entry(id: number, categories: string[]): IndexEntry {
  return { id, chunk: 1, categories, services: [], answer: ['A'], choiceCount: 4 }
}

/** 1번은 두 영역에 걸치고, 4번은 태그가 없다 (`04-data-model.md` — categories는 0~3개). */
const ENTRIES: IndexEntry[] = [
  entry(1, ['네트워크', '보안']),
  entry(2, ['보안']),
  entry(3, ['컴퓨트']),
  entry(4, []),
]

function statsOf(states: QuestionState[]) {
  return new Map(toCategoryStats(ENTRIES, states).map((row) => [row.category, row]))
}

describe('GET /stats — 카테고리 산입', () => {
  it('카테고리 여러 개인 문항은 막대 각각에 든다', () => {
    const stats = statsOf([])

    expect(stats.get('네트워크')?.total).toBe(1)
    expect(stats.get('보안')?.total).toBe(2)
  })

  it('total 합계가 문항 수보다 크다 — 중복 산입이라 정상이다', () => {
    const total = toCategoryStats(ENTRIES, []).reduce((sum, row) => sum + row.total, 0)

    expect(total).toBe(4)
    expect(total).toBeGreaterThan(ENTRIES.filter((item) => item.categories.length > 0).length)
  })

  it('카테고리가 없는 문항은 어느 막대에도 들지 않는다', () => {
    const stats = statsOf([{ questionId: 4, isCorrect: true }])

    expect([...stats.keys()]).toEqual(['네트워크', '보안', '컴퓨트'])
  })
})

describe('GET /stats — 정답률', () => {
  it('한 문항의 정오가 걸친 카테고리 전부에 반영된다', () => {
    const stats = statsOf([{ questionId: 1, isCorrect: false }])

    expect(stats.get('네트워크')).toMatchObject({ total: 1, solved: 1, correct: 0, accuracy: 0 })
    expect(stats.get('보안')).toMatchObject({ total: 2, solved: 1, correct: 0, accuracy: 0 })
  })

  it('분모는 푼 수다 — 안 푼 문항은 정답률을 깎지 않는다', () => {
    const stats = statsOf([{ questionId: 1, isCorrect: true }])

    expect(stats.get('보안')).toMatchObject({ total: 2, solved: 1, correct: 1, accuracy: 1 })
  })

  it('한 번도 안 푼 카테고리는 accuracy가 0이다 — 화면이 정렬에서 뺀다', () => {
    expect(statsOf([]).get('컴퓨트')).toMatchObject({ solved: 0, correct: 0, accuracy: 0 })
  })

  it('빈 인덱스는 빈 목록이다', () => {
    expect(toCategoryStats([], [])).toEqual([])
  })
})
