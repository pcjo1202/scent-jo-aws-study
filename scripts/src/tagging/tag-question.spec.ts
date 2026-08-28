import { describe, expect, it } from 'vitest'
import type { ChoiceKey } from '@aws-study/shared'
import type { OneLiner } from '../notes/parse-oneliner.ts'
import { buildServiceAliases, type AliasSupplements } from './service-aliases.ts'
import { tagQuestion, type TaggableQuestion } from './tag-question.ts'

const NO_SUPPLEMENTS: AliasSupplements = { roots: [], koreanAliases: [] }

function note(service: string, category: string): OneLiner {
  return { service, category, note: '설명' }
}

const NOTES = [
  note('Amazon EC2', '컴퓨트'),
  note('EC2 Spot Instance', '컴퓨트'),
  note('AWS Lambda', '컴퓨트'),
  note('S3 Standard', '스토리지'),
  note('S3 Lifecycle Policy', '스토리지'),
  note('Amazon Redshift', '데이터베이스'),
  note('Amazon Athena', '분석'),
  note('AWS Glue', '분석'),
  note('AWS Lake Formation', '분석'),
]
const ALIASES = buildServiceAliases(NOTES, NO_SUPPLEMENTS)

const CHOICE_KEYS: ChoiceKey[] = ['A', 'B', 'C', 'D', 'E', 'F']

function question(stem: string, choices: string[], answer: ChoiceKey[]): TaggableQuestion {
  return {
    stem,
    choices: choices.map((text, index) => ({ key: CHOICE_KEYS[index]!, text })),
    answer,
  }
}

describe('tagQuestion', () => {
  it('오답 선택지에만 있는 서비스는 태깅하지 않는다', () => {
    const target = question(
      '데이터를 조회하는 가장 저렴한 방법은?',
      ['Amazon Athena로 조회한다', 'Amazon Redshift 클러스터를 만든다'],
      ['A'],
    )

    const { services, categories } = tagQuestion(target, ALIASES)

    expect(services).toContain('Amazon Athena')
    expect(services).not.toContain('Amazon Redshift')
    expect(categories).not.toContain('데이터베이스')
  })

  it('지문과 정답 선택지를 함께 스캔한다', () => {
    const target = question('S3 Standard에 저장된 로그가 있다', ['AWS Glue로 카탈로그를 만든다'], ['A'])

    expect(tagQuestion(target, ALIASES).services).toEqual(
      expect.arrayContaining(['S3 Standard', 'AWS Glue']),
    )
  })

  it('최장일치를 택한다 — 긴 이름 안의 짧은 이름을 따로 세지 않는다', () => {
    const target = question('EC2 Spot Instance를 사용한다', ['그렇게 한다'], ['A'])

    const { services } = tagQuestion(target, ALIASES)

    expect(services).toEqual(['EC2 Spot Instance'])
  })

  it('단어 경계를 지킨다 — 영숫자에 붙은 이름은 매칭하지 않는다', () => {
    const target = question('EC2X와 XLambda를 검토한다', ['그렇게 한다'], ['A'])

    expect(tagQuestion(target, ALIASES).services).toEqual([])
  })

  it('한글에 바로 붙은 이름은 매칭한다', () => {
    const target = question('AWS Lambda를 사용한다', ['그렇게 한다'], ['A'])

    expect(tagQuestion(target, ALIASES).services).toEqual(['AWS Lambda'])
  })

  it('매칭이 없으면 빈 배열을 돌려준다', () => {
    const target = question('온프레미스 장비를 교체한다', ['그렇게 한다'], ['A'])

    expect(tagQuestion(target, ALIASES)).toEqual({ services: [], categories: [] })
  })

  it('카테고리는 3개를 넘지 않는다', () => {
    const target = question('Amazon EC2와 S3 Standard와 Amazon Redshift와 AWS Glue를 쓴다', ['그렇게 한다'], ['A'])

    expect(tagQuestion(target, ALIASES).categories.length).toBeLessThanOrEqual(3)
  })

  it('최상위 점수의 절반 미만인 카테고리는 배경 언급으로 버린다', () => {
    const target = question(
      'Amazon Athena와 AWS Glue와 AWS Lake Formation으로 분석하며 Amazon EC2에서 실행한다',
      ['그렇게 한다'],
      ['A'],
    )

    const { categories } = tagQuestion(target, ALIASES)

    expect(categories).toEqual(['분석'])
  })

  it('점수가 같으면 모두 남긴다', () => {
    const target = question('Amazon EC2와 Amazon Athena를 쓴다', ['그렇게 한다'], ['A'])

    expect(tagQuestion(target, ALIASES).categories).toEqual(
      expect.arrayContaining(['컴퓨트', '분석']),
    )
  })
})

describe('tagQuestion 점수', () => {
  it('반복 언급이 많은 카테고리가 상위가 된다 — 배경으로 한 번 스치는 이름을 이긴다', () => {
    const target = question(
      'S3 Standard의 객체를 S3 Lifecycle Policy로 옮긴다. S3 Standard 비용을 줄인다',
      ['Amazon EC2에서 스크립트를 돌린다'],
      ['A'],
    )

    expect(tagQuestion(target, ALIASES).categories).toEqual(['스토리지'])
  })
})
