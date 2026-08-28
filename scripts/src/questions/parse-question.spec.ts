import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseQuestion, type ParsedQuestion } from './parse-question.ts'

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
