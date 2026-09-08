import { describe, expect, it } from 'vitest'

import type { Comparison, OneLiner } from '@aws-study/shared'

import { groupByCategory, searchOneLiners, sortByImportance } from './notes-index'

function oneLiner(service: string, category: string, note = '설명'): OneLiner {
  return { service, category, note }
}

function comparison(title: string, importance: number): Comparison {
  return { title, importance, members: [] }
}

/**
 * 실데이터(`data/`)를 읽지 않는다 — gitignore이고 CI가 없어 있는 기기와 없는 기기가 갈린다.
 * 대신 실측에서 확인한 **성질**만 픽스처로 옮겼다: 카테고리가 둘인 서비스가 하나 있고,
 * 그 둘의 `note`가 서로 다르다 (`docs/04` 「oneliners.json」).
 */
const FLINK = 'Amazon Managed Service for Apache Flink (기존 Kinesis Data Analytics)'

describe('searchOneLiners', () => {
  it('서비스명 부분일치이고 대소문자를 가리지 않는다', () => {
    const items = [oneLiner('Amazon S3', '스토리지'), oneLiner('Amazon EC2', '컴퓨트')]

    expect(searchOneLiners(items, 's3').map((item) => item.service)).toEqual(['Amazon S3'])
    expect(searchOneLiners(items, 'AMAZON').map((item) => item.service)).toEqual([
      'Amazon S3',
      'Amazon EC2',
    ])
  })

  it('빈 검색어와 공백만 있는 검색어는 전부 통과다', () => {
    const items = [oneLiner('Amazon S3', '스토리지'), oneLiner('Amazon EC2', '컴퓨트')]

    expect(searchOneLiners(items, '')).toHaveLength(2)
    expect(searchOneLiners(items, '   ')).toHaveLength(2)
  })

  it('맞는 것이 없으면 0건이다 — 빈 상태가 그때 선다', () => {
    expect(searchOneLiners([oneLiner('Amazon S3', '스토리지')], 'zzz')).toEqual([])
  })

  it('카테고리는 검색어에 걸지 않는다', () => {
    const items = [oneLiner('Amazon Athena', '분석'), oneLiner('분석기', '운영')]

    expect(searchOneLiners(items, '분석').map((item) => item.service)).toEqual(['분석기'])
  })
})

describe('groupByCategory', () => {
  it('카테고리 가나다순으로 서고 그룹 안은 원본 순서다', () => {
    const items = [
      oneLiner('Amazon EC2', '컴퓨트'),
      oneLiner('Amazon S3', '스토리지'),
      oneLiner('AWS Lambda', '컴퓨트'),
      oneLiner('Amazon RDS', '데이터베이스'),
    ]

    expect(groupByCategory(items)).toEqual([
      { category: '데이터베이스', items: [oneLiner('Amazon RDS', '데이터베이스')] },
      { category: '스토리지', items: [oneLiner('Amazon S3', '스토리지')] },
      {
        category: '컴퓨트',
        items: [oneLiner('Amazon EC2', '컴퓨트'), oneLiner('AWS Lambda', '컴퓨트')],
      },
    ])
  })

  it('영문 카테고리는 한글 **뒤**에 선다 — ko 콜레이션이 그렇다', () => {
    const groups = groupByCategory([
      oneLiner('Amazon SageMaker', 'AI/ML'),
      oneLiner('Amazon EC2', '컴퓨트'),
    ])

    expect(groups.map((group) => group.category)).toEqual(['컴퓨트', 'AI/ML'])
  })

  it('카테고리가 둘인 서비스는 두 그룹에 각각 남고 note도 각자 것이다', () => {
    const groups = groupByCategory([
      oneLiner(FLINK, '메시징', '메시징 쪽 설명'),
      oneLiner(FLINK, '분석', '분석 쪽 설명'),
    ])

    expect(groups.map((group) => group.category)).toEqual(['메시징', '분석'])
    expect(groups.flatMap((group) => group.items.map((item) => item.note))).toEqual([
      '메시징 쪽 설명',
      '분석 쪽 설명',
    ])
  })

  it('(service, category) 쌍이 그룹 안에서 유일하다 — React key의 근거다', () => {
    const groups = groupByCategory([
      oneLiner(FLINK, '메시징'),
      oneLiner(FLINK, '분석'),
      oneLiner('Amazon S3', '스토리지'),
    ])

    for (const group of groups) {
      const services = group.items.map((item) => item.service)
      expect(new Set(services).size).toBe(services.length)
    }
  })

  it('0건이면 그룹도 0개다 — 빈 제목이 서지 않는다', () => {
    expect(groupByCategory([])).toEqual([])
  })
})

describe('sortByImportance', () => {
  it('중요도 내림차순이다', () => {
    const sorted = sortByImportance([comparison('a', 1), comparison('b', 3), comparison('c', 2)])

    expect(sorted.map((item) => item.title)).toEqual(['b', 'c', 'a'])
  })

  it('같은 중요도 안은 원본 순서다 — 안정 정렬에 기댄다', () => {
    const sorted = sortByImportance([
      comparison('첫째', 3),
      comparison('둘째', 3),
      comparison('셋째', 3),
      comparison('넷째', 1),
    ])

    expect(sorted.map((item) => item.title)).toEqual(['첫째', '둘째', '셋째', '넷째'])
  })

  it('원본 배열을 건드리지 않는다', () => {
    const items = [comparison('a', 1), comparison('b', 3)]
    sortByImportance(items)

    expect(items.map((item) => item.title)).toEqual(['a', 'b'])
  })
})
