import { describe, expect, it } from 'vitest'
import type { OneLiner } from '../notes/parse-oneliner.ts'
import { buildServiceAliases, type AliasSupplements } from './service-aliases.ts'

const NO_SUPPLEMENTS: AliasSupplements = { roots: [], koreanAliases: [] }

function note(service: string, category: string): OneLiner {
  return { service, category, note: '설명' }
}

function aliasesOf(items: OneLiner[], service: string, supplements = NO_SUPPLEMENTS) {
  return buildServiceAliases(items, supplements)
    .filter((entry) => entry.service === service)
    .map((entry) => entry.alias)
}

describe('buildServiceAliases', () => {
  it('노트의 모든 서비스가 사전에 들어간다', () => {
    const items = [note('Amazon EC2', '컴퓨트'), note('Amazon SQS', '메시징'), note('AWS WAF', '보안')]

    const services = new Set(buildServiceAliases(items, NO_SUPPLEMENTS).map((entry) => entry.service))

    expect(services.size).toBe(3)
  })

  it('벤더 접두사를 뗀 이름도 별칭이다', () => {
    expect(aliasesOf([note('Amazon EC2', '컴퓨트')], 'Amazon EC2')).toEqual(
      expect.arrayContaining(['Amazon EC2', 'EC2']),
    )
    expect(aliasesOf([note('AWS Lambda', '컴퓨트')], 'AWS Lambda')).toEqual(
      expect.arrayContaining(['AWS Lambda', 'Lambda']),
    )
  })

  it('괄호 안의 이름을 별칭으로 남긴다', () => {
    const items = [note('Amazon ECR (Elastic Container Registry)', '컴퓨트')]

    expect(aliasesOf(items, 'Amazon ECR (Elastic Container Registry)')).toEqual(
      expect.arrayContaining(['Amazon ECR', 'ECR', 'Elastic Container Registry']),
    )
  })

  it('괄호 안의 「기존」 표기를 떼고 옛 이름을 별칭으로 남긴다', () => {
    const items = [note('Amazon Data Firehose (기존 Kinesis Data Firehose)', '메시징')]

    expect(aliasesOf(items, 'Amazon Data Firehose (기존 Kinesis Data Firehose)')).toEqual(
      expect.arrayContaining(['Amazon Data Firehose', 'Data Firehose', 'Kinesis Data Firehose']),
    )
  })

  it('대시로 가른 이름은 대시 없는 표기도 별칭이다', () => {
    const items = [note('Route 53 - Latency Routing', '네트워크')]

    expect(aliasesOf(items, 'Route 53 - Latency Routing')).toEqual(
      expect.arrayContaining(['Route 53 - Latency Routing', 'Route 53 Latency Routing']),
    )
  })

  it('슬래시로 묶인 이름은 각각이 별칭이다', () => {
    const items = [note('IAM User / IAM Group', '보안')]

    expect(aliasesOf(items, 'IAM User / IAM Group')).toEqual(
      expect.arrayContaining(['IAM User', 'IAM Group']),
    )
  })

  it('한 서비스가 카테고리 둘에 실리면 별칭이 둘을 모두 갖는다', () => {
    const service = 'Amazon Managed Service for Apache Flink'
    const items = [note(service, '메시징'), note(service, '분석')]

    const entry = buildServiceAliases(items, NO_SUPPLEMENTS).find((it) => it.alias === service)

    expect(entry?.categories).toEqual(expect.arrayContaining(['메시징', '분석']))
    expect(entry?.categories).toHaveLength(2)
  })

  it('루트 별칭의 카테고리를 자식 항목에서 끌어온다 — 하드코딩하지 않는다', () => {
    const items = [
      note('S3 Standard', '스토리지'),
      note('S3 Lifecycle Policy', '스토리지'),
      note('S3 Bucket Policy', '보안'),
    ]
    const supplements: AliasSupplements = {
      roots: [{ root: 'S3', service: 'Amazon S3' }],
      koreanAliases: [],
    }

    const entry = buildServiceAliases(items, supplements).find((it) => it.alias === 'S3')

    expect(entry?.service).toBe('Amazon S3')
    expect(entry?.categories).toEqual(['스토리지'])
  })

  it('자식이 없는 루트는 던진다 — 카테고리를 지어내지 않는다', () => {
    const supplements: AliasSupplements = {
      roots: [{ root: 'S3', service: 'Amazon S3' }],
      koreanAliases: [],
    }

    expect(() => buildServiceAliases([note('Amazon EC2', '컴퓨트')], supplements)).toThrow('S3')
  })

  it('한글 별칭이 가리키는 서비스가 노트에 없으면 던진다', () => {
    const supplements: AliasSupplements = {
      roots: [],
      koreanAliases: [{ alias: '보안 그룹', service: 'Security Group' }],
    }

    expect(() => buildServiceAliases([note('Amazon EC2', '컴퓨트')], supplements)).toThrow(
      'Security Group',
    )
  })

  it('서로 다른 서비스가 같은 별칭을 만들면 던진다', () => {
    const items = [note('Amazon Athena', '분석'), note('AWS Athena', '운영')]

    expect(() => buildServiceAliases(items, NO_SUPPLEMENTS)).toThrow('Athena')
  })

  it('길이가 같은 별칭은 이름순으로 갈라 순서를 노트 입력 순서에서 떼어 놓는다', () => {
    const items = [note('AWS WAF', '보안'), note('Amazon EMR', '분석'), note('Amazon ECS', '컴퓨트')]

    const threeLetter = buildServiceAliases(items, NO_SUPPLEMENTS)
      .filter((entry) => entry.alias.length === 3)
      .map((entry) => entry.alias)

    expect(threeLetter).toEqual([...threeLetter].sort((a, b) => a.localeCompare(b)))
  })

  it('긴 별칭이 먼저 오도록 정렬한다 — 최장일치의 근거다', () => {
    const items = [note('Amazon EC2', '컴퓨트'), note('EC2 Spot Instance', '컴퓨트')]

    const lengths = buildServiceAliases(items, NO_SUPPLEMENTS).map((entry) => entry.alias.length)

    expect(lengths).toEqual([...lengths].sort((a, b) => b - a))
  })
})
