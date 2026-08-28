import { describe, expect, it } from 'vitest'
import type { QuestionTopics } from './tag-question.ts'
import { findTaggingAnomalies } from './tagging-anomalies.ts'

const KNOWN = new Set(['컴퓨트', '스토리지', '네트워크', '보안'])
const TOTAL = 1019

/** 실제 산출과 같은 규모로 만든다 — 상한이 비율이라 작은 표본에서는 뜻이 다르다. */
function corpus(shape: (index: number) => QuestionTopics): QuestionTopics[] {
  return Array.from({ length: TOTAL }, (_, index) => shape(index))
}

function topics(categories: string[], services = ['Amazon EC2']): QuestionTopics {
  return { services, categories }
}

function total(anomalies: ReturnType<typeof findTaggingAnomalies>) {
  return Object.values(anomalies.counts).reduce((sum, count) => sum + count, 0)
}

describe('findTaggingAnomalies', () => {
  it('실측과 같은 분포는 통과한다 — 오탐이 없다', () => {
    // 컴퓨트 41% · 스토리지 35% · 네트워크 23% (2026-08-28 실측 근사)
    const questions = corpus((index) => {
      const categories = ['컴퓨트']
      if (index % 100 < 35) categories.push('스토리지')
      if (index % 100 < 23) categories.push('네트워크')
      return topics(index % 100 < 41 ? categories : categories.slice(1))
    })

    expect(total(findTaggingAnomalies(questions, KNOWN))).toBe(0)
  })

  it('한 카테고리가 절반을 넘으면 잡는다 — 사전·롤업이 무너진 모양', () => {
    const questions = corpus(() => topics(['컴퓨트']))

    const anomalies = findTaggingAnomalies(questions, KNOWN)

    expect(anomalies.overweight).toEqual([['컴퓨트', TOTAL]])
    expect(anomalies.counts['카테고리 편중']).toBe(1)
  })

  it('상한을 한 문항 넘긴 편중도 잡는다 — 경계에서 새지 않는다', () => {
    const limit = Math.floor(TOTAL * 0.5)
    const questions = corpus((index) => topics(index <= limit ? ['컴퓨트'] : ['스토리지']))

    expect(findTaggingAnomalies(questions, KNOWN).counts['카테고리 편중']).toBe(1)
  })

  it('상한과 정확히 같으면 통과한다', () => {
    const limit = Math.floor(TOTAL * 0.5)
    // 나머지를 둘로 갈라 다른 카테고리가 대신 상한을 넘지 않게 한다.
    const questions = corpus((index) => {
      if (index < limit) return topics(['컴퓨트'])
      return topics(index % 2 === 0 ? ['스토리지'] : ['네트워크'])
    })

    const anomalies = findTaggingAnomalies(questions, KNOWN)

    expect(anomalies.countsByCategory).toContainEqual(['컴퓨트', limit])
    expect(anomalies.counts['카테고리 편중']).toBe(0)
  })

  it('카테고리가 4개인 문항을 잡는다', () => {
    const questions = corpus((index) =>
      index === 0 ? topics(['컴퓨트', '스토리지', '네트워크', '보안']) : topics(['스토리지']),
    )

    expect(findTaggingAnomalies(questions, KNOWN).counts['카테고리 상한 초과 문항']).toBe(1)
  })

  it('노트에 없는 카테고리를 잡는다 — 롤업이 값을 지어낸 모양', () => {
    const questions = corpus((index) => (index === 0 ? topics(['서버리스']) : topics(['스토리지'])))

    expect(findTaggingAnomalies(questions, KNOWN).counts['노트에 없는 카테고리']).toBe(1)
  })

  it('같은 카테고리가 두 번 붙은 문항을 잡는다', () => {
    const questions = corpus((index) =>
      index === 0 ? topics(['스토리지', '스토리지']) : topics(['스토리지']),
    )

    expect(findTaggingAnomalies(questions, KNOWN).counts['카테고리가 중복된 문항']).toBe(1)
  })

  it('서비스가 없는데 카테고리가 붙은 문항을 잡는다 — 카테고리는 서비스에서만 나온다', () => {
    const questions = corpus((index) =>
      index === 0 ? topics(['스토리지'], []) : topics(['스토리지']),
    )

    expect(findTaggingAnomalies(questions, KNOWN).counts['서비스가 없는데 카테고리가 붙은 문항']).toBe(1)
  })

  it('미태깅 문항만 있는 결과는 이상치가 아니다 — 비율은 사람이 본다', () => {
    const questions = corpus(() => topics([], []))

    expect(total(findTaggingAnomalies(questions, KNOWN))).toBe(0)
  })
})
