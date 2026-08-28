import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseQuestion, stripRestatedChoice, type ParsedQuestion } from './parse-question.ts'

/**
 * 골든 픽스처 (`08-testing.md` 「1. 추출 파서」).
 *
 * 입력은 원본에서 잘라낸 문항 블록이고, 기대 출력은 그 원문을 읽고 손으로 적었다.
 * 파서가 뱉은 값을 붙여넣지 않는다 — 그러면 버그까지 기대값으로 굳는다.
 *
 * 비교는 **공백을 지우고** 한다. 줄 이음매의 공백은 PDF에 정보가 남아 있지 않아
 * `seam-oracle.ts`가 코퍼스 빈도로 추정하는 값이고, 그 정확도는 라벨 1638건으로
 * 따로 측정한다. 여기서 지키려는 것은 구조다 — 잘림·누락·절 침범·재기술 잔류.
 * 줄바꿈은 지우지 않는다. 코드 블록의 줄 구조가 살아 있어야 하기 때문이다.
 *
 * 픽스처는 저작권 자료라 gitignored다. 없으면 `pnpm data:pull`로 복구한다.
 */

const FIXTURE_DIR = fileURLToPath(new URL('../../../tests/fixtures/questions/', import.meta.url))

describe('parseQuestion — 골든 픽스처', () => {
  const ids = readFixtureIds()

  it('픽스처가 있다', () => {
    expect(ids.length).toBeGreaterThan(0)
  })

  it.each(ids)('Q.%s', (id) => {
    const lines = readFileSync(`${FIXTURE_DIR}${id}.txt`, 'utf8').split('\n')
    const expected = JSON.parse(readFileSync(`${FIXTURE_DIR}${id}.json`, 'utf8')) as ParsedQuestion

    expect(normalize(parseQuestion({ id: expected.id, lines }))).toEqual(normalize(expected))
  })
})

function readFixtureIds(): string[] {
  return readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace('.json', ''))
    .sort()
}

/** 공백·탭만 지운다. 줄바꿈은 코드 블록의 구조라 남긴다. */
function normalize(question: ParsedQuestion): ParsedQuestion {
  const strip = (text: string): string => text.replaceAll(/[ \t]/g, '')
  return {
    ...question,
    stem: strip(question.stem),
    choices: question.choices.map(({ key, text }) => ({ key, text: strip(text) })),
    requirements: question.requirements.map(strip),
    explanation: strip(question.explanation),
    rebuttals: question.rebuttals.map(({ key, text }) => ({ key, text: strip(text) })),
  }
}

/**
 * 골든 픽스처가 덮지 못하는 분기. 합성 입력이라 저작권 자료가 없고, 원본 코퍼스에
 * 표본이 하나뿐인 형태(키만 있는 선택지 줄)도 여기서 고정한다.
 */
describe('parseQuestion — 합성 입력', () => {
  function block(lines: string[]) {
    return parseQuestion({ id: 1, lines })
  }

  it('키만 있고 본문이 다음 줄부터인 선택지를 잡는다', () => {
    const parsed = block([
      '지문이다.',
      '  A.',
      '     첫째 안',
      '  B. 둘째 안',
      '   정답: A / 정답 및 해설',
      '   정답 해설',
      '   첫째가 맞다.',
    ])

    expect(parsed.choices).toEqual([
      { key: 'A', text: '첫째 안' },
      { key: 'B', text: '둘째 안' },
    ])
  })

  it('들여쓰기가 흔들려도 선택지로 읽는다', () => {
    const parsed = block([
      '지문이다.',
      ' A. 첫째 안',
      '    B. 둘째 안',
      '   정답: B / 정답 및 해설',
      '   정답 해설',
      '   둘째가 맞다.',
    ])

    expect(parsed.choices.map((choice) => choice.key)).toEqual(['A', 'B'])
  })

  it('코드 블록은 줄바꿈과 상대 들여쓰기를 남긴다', () => {
    const parsed = block([
      '아래 정책을 보라:',
      '   {',
      '       "Effect": "Allow",',
      '       "Action": [',
      '         "s3:GetObject"',
      '       ]',
      '   }',
      '무엇이 문제인가?',
      '  A. 첫째 안',
      '  B. 둘째 안',
      '   정답: A / 정답 및 해설',
      '   정답 해설',
      '   첫째가 맞다.',
    ])

    // 절대 들여쓰기는 PDF 여백에서 온 값이라 버리고, 상대 구조만 남는다.
    expect(parsed.stem).toBe(
      [
        '아래 정책을 보라:',
        '{',
        '    "Effect": "Allow",',
        '    "Action": [',
        '      "s3:GetObject"',
        '    ]',
        '}',
        '무엇이 문제인가?',
      ].join('\n'),
    )
  })

  it('절이 빠져도 앞뒤 절이 서로 먹지 않는다', () => {
    const parsed = block([
      '지문이다.',
      '  A. 첫째 안',
      '  B. 둘째 안',
      '   정답: A / 정답 및 해설',
      '   정답 해설',
      '   첫째가 맞다.',
    ])

    expect(parsed.requirements).toEqual([])
    expect(parsed.rebuttals).toEqual([])
    expect(parsed.explanation).toBe('첫째가 맞다.')
  })
})

describe('stripRestatedChoice', () => {
  it('선택지 재기술을 떼고 반박만 남긴다', () => {
    expect(stripRestatedChoice('첫째 안이다. 그래서 틀렸다.', '첫째 안이다.')).toBe(
      '그래서 틀렸다.',
    )
  })

  it('줄바꿈과 공백이 어긋나도 뗀다 — 두 곳의 줄바꿈 위치가 다르다', () => {
    expect(stripRestatedChoice('첫째\n안이다. 그래서 틀렸다.', '첫째 안이다.')).toBe(
      '그래서 틀렸다.',
    )
  })

  it('재기술이 어긋나면 원문을 그대로 둔다 — 지우는 것보다 낫다', () => {
    expect(stripRestatedChoice('다른 문장이다.', '첫째 안이다.')).toBe('다른 문장이다.')
  })

  it('선택지를 모르면 손대지 않는다', () => {
    expect(stripRestatedChoice('반박이다.', undefined)).toBe('반박이다.')
  })
})
