import type { Question } from '@aws-study/shared'
import { describe, expect, it } from 'vitest'
import { buildIndex, CHUNK_SIZE, chunkFileName, chunkQuestions } from './build-chunks.ts'

const TOTAL = 1019

/** 실측과 같은 규모로 만든다 — 마지막 청크가 19문항인 것이 경계다. */
function corpus(shape: (id: number) => Partial<Question> = () => ({})): Question[] {
  return Array.from({ length: TOTAL }, (_, index) => question(index + 1, shape(index + 1)))
}

function question(id: number, overrides: Partial<Question> = {}): Question {
  return {
    id,
    stem: `지문 ${id}`,
    choices: [
      { key: 'A', text: 'a' },
      { key: 'B', text: 'b' },
      { key: 'C', text: 'c' },
      { key: 'D', text: 'd' },
    ],
    answer: ['A'],
    requirements: [],
    explanation: `해설 ${id}`,
    rebuttals: [],
    categories: ['컴퓨트'],
    services: ['Amazon EC2'],
    ...overrides,
  }
}

describe('chunkQuestions', () => {
  it('1019문항을 11청크로 자르고 마지막만 19문항이다', () => {
    const chunks = chunkQuestions(corpus())

    expect(chunks).toHaveLength(11)
    expect(chunks.slice(0, 10).map((chunk) => chunk.questions.length)).toEqual(
      Array(10).fill(CHUNK_SIZE),
    )
    expect(chunks[10]!.questions).toHaveLength(19)
  })

  it('청크 번호는 1부터, from·to는 실제 문항 id다', () => {
    const chunks = chunkQuestions(corpus())

    expect(chunks.map((chunk) => chunk.chunk)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(chunks[0]!).toMatchObject({ from: 1, to: 100 })
    expect(chunks[10]!).toMatchObject({ from: 1001, to: 1019 })
  })

  it('입력 순서가 섞여도 id 순으로 자른다 — 두 PDF를 이어 읽는다', () => {
    const chunks = chunkQuestions([...corpus()].reverse())

    expect(chunks[0]!.from).toBe(1)
    expect(chunks[10]!.to).toBe(TOTAL)
    expect(chunks.flatMap((chunk) => chunk.questions).map((q) => q.id)).toEqual(
      Array.from({ length: TOTAL }, (_, index) => index + 1),
    )
  })

  it('문항을 잃지 않는다', () => {
    const chunks = chunkQuestions(corpus())

    expect(chunks.reduce((sum, chunk) => sum + chunk.questions.length, 0)).toBe(TOTAL)
  })
})

describe('buildIndex', () => {
  it('문항 수만큼 행을 만들고 청크 번호를 달아 준다', () => {
    const entries = buildIndex(chunkQuestions(corpus()))

    expect(entries).toHaveLength(TOTAL)
    expect(entries[0]!).toEqual({
      id: 1,
      chunk: 1,
      categories: ['컴퓨트'],
      services: ['Amazon EC2'],
      answer: ['A'],
      choiceCount: 4,
    })
    expect(entries[100]!.chunk).toBe(2)
    expect(entries[TOTAL - 1]!).toMatchObject({ id: TOTAL, chunk: 11 })
  })

  it('태깅되지 않은 문항의 빈 배열을 그대로 옮긴다 — 실측 6문항', () => {
    const entries = buildIndex(
      chunkQuestions(corpus((id) => (id <= 6 ? { categories: [], services: [] } : {}))),
    )

    expect(entries.filter((entry) => entry.categories.length === 0)).toHaveLength(6)
    expect(entries[0]!.services).toEqual([])
  })

  it('choiceCount가 선택지 수를 그대로 따른다 — 4~6', () => {
    const keys = ['A', 'B', 'C', 'D', 'E', 'F'] as const
    const entries = buildIndex(
      chunkQuestions(
        corpus((id) => ({
          choices: keys.slice(0, 4 + (id % 3)).map((key) => ({ key, text: key })),
        })),
      ),
    )

    expect(new Set(entries.map((entry) => entry.choiceCount))).toEqual(new Set([4, 5, 6]))
    expect(entries[0]!.choiceCount).toBe(5)
  })

  it('정답을 그대로 옮긴다 — 채점이 이 값을 쓴다', () => {
    const entries = buildIndex(
      chunkQuestions(corpus((id) => (id === 3 ? { answer: ['B', 'D'] } : {}))),
    )

    expect(entries[2]!.answer).toEqual(['B', 'D'])
  })
})

describe('chunkFileName', () => {
  it('세 자리로 채워 정렬 순서가 청크 순서가 된다', () => {
    expect([1, 11].map(chunkFileName)).toEqual(['chunk-001.json', 'chunk-011.json'])
  })
})
